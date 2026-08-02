import { put } from '@vercel/blob'
import sharp from 'sharp'
import prisma from '@/lib/db/prisma'
import fs from 'fs/promises'
import path from 'path'

const MAX_INSTAGRAM_IMAGE_BYTES = 8 * 1024 * 1024
const MIN_FEED_RATIO = 4 / 5
const MAX_FEED_RATIO = 1.91
const MAX_SOURCE_BYTES = 40 * 1024 * 1024

interface InstagramSourceAsset {
  id: string
  workspaceId: string
  fileUrl: string
  thumbnailUrl: string | null
  mimeType: string | null
  fileSize: bigint | null
  width: number | null
  height: number | null
  storageProvider: string | null
}

export interface PreparedMedia {
  url: string
  mimeType: string
  fileSize?: number
}

function publicHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function isValidFeedRatio(width: number | null, height: number | null): boolean {
  if (!width || !height) return false
  const ratio = width / height
  return ratio >= MIN_FEED_RATIO && ratio <= MAX_FEED_RATIO
}

async function readSource(asset: InstagramSourceAsset): Promise<Buffer> {
  if (publicHttpsUrl(asset.fileUrl)) {
    const response = await fetch(asset.fileUrl)
    if (!response.ok) {
      throw new Error(
        `Unable to prepare Instagram media (source returned HTTP ${response.status}).`
      )
    }
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_SOURCE_BYTES) {
      throw new Error('Instagram source media must be 40 MB or smaller before conversion.')
    }
    const source = Buffer.from(await response.arrayBuffer())
    if (source.byteLength > MAX_SOURCE_BYTES) {
      throw new Error('Instagram source media must be 40 MB or smaller before conversion.')
    }
    return source
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    asset.storageProvider === 'local' &&
    asset.fileUrl.startsWith('/uploads/')
  ) {
    const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads')
    const sourcePath = path.resolve(process.cwd(), 'public', asset.fileUrl.slice(1))
    if (!sourcePath.startsWith(`${uploadsRoot}${path.sep}`)) {
      throw new Error('The local media path is outside the permitted upload directory.')
    }
    const stats = await fs.stat(sourcePath)
    if (stats.size > MAX_SOURCE_BYTES) {
      throw new Error('Instagram source media must be 40 MB or smaller before conversion.')
    }
    return fs.readFile(sourcePath)
  }

  throw new Error(
    'Instagram requires media from a public HTTPS URL. Upload the file again after configuring public media storage.'
  )
}

/**
 * Meta imports image posts from a public URL and has stricter image
 * requirements than the CMS uploader. Keep the original asset for the media
 * library, but create and cache a JPEG publishing rendition when needed.
 */
export async function ensureInstagramCompatibleMedia(
  asset: InstagramSourceAsset,
  destination: string
): Promise<PreparedMedia> {
  const mimeType = asset.mimeType ?? ''
  if (mimeType.startsWith('video/')) {
    if (!publicHttpsUrl(asset.fileUrl)) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Error(
          'Public media storage is not configured. Add BLOB_READ_WRITE_TOKEN to .env.local, restart npm run dev, then retry.'
        )
      }
      const source = await readSource(asset)
      const extension = mimeType === 'video/quicktime' ? 'mov' : mimeType === 'video/webm' ? 'webm' : 'mp4'
      const blob = await put(
        `cms/${asset.workspaceId}/instagram/${asset.id}-${Date.now()}.${extension}`,
        source,
        {
          access: 'public',
          contentType: mimeType,
        }
      )
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { fileUrl: blob.url, storageProvider: 'vercel_blob' },
      })
      return {
        url: blob.url,
        mimeType,
        fileSize: source.byteLength,
      }
    }
    return {
      url: asset.fileUrl,
      mimeType,
      fileSize: asset.fileSize === null ? undefined : Number(asset.fileSize),
    }
  }
  if (!mimeType.startsWith('image/')) {
    return { url: asset.fileUrl, mimeType }
  }

  const isStory = destination === 'instagram_story'
  const originalSize = asset.fileSize === null ? undefined : Number(asset.fileSize)
  const originalAlreadyCompatible =
    mimeType === 'image/jpeg' &&
    publicHttpsUrl(asset.fileUrl) &&
    (originalSize === undefined || originalSize <= MAX_INSTAGRAM_IMAGE_BYTES) &&
    (isStory || isValidFeedRatio(asset.width, asset.height))

  if (originalAlreadyCompatible) {
    return { url: asset.fileUrl, mimeType, fileSize: originalSize }
  }
  const thumbnailUrl = asset.thumbnailUrl
  if (
    thumbnailUrl &&
    publicHttpsUrl(thumbnailUrl) &&
    new URL(thumbnailUrl).pathname.includes('/instagram/')
  ) {
    return { url: thumbnailUrl, mimeType: 'image/jpeg' }
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'Public media storage is not configured. Add BLOB_READ_WRITE_TOKEN to .env.local, restart npm run dev, then retry.'
    )
  }
  const source = await readSource(asset)

  let rendition = await sharp(source, { animated: false })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({
      width: isStory ? 1080 : 1440,
      height: isStory ? 1920 : 1800,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90, chromaSubsampling: '4:2:0' })
    .toBuffer({ resolveWithObject: true })

  if (!isStory) {
    const ratio = rendition.info.width / rendition.info.height
    if (ratio < MIN_FEED_RATIO || ratio > MAX_FEED_RATIO) {
      const targetWidth =
        ratio < MIN_FEED_RATIO
          ? Math.ceil(rendition.info.height * MIN_FEED_RATIO)
          : rendition.info.width
      const targetHeight =
        ratio > MAX_FEED_RATIO
          ? Math.ceil(rendition.info.width / MAX_FEED_RATIO)
          : rendition.info.height
      rendition = await sharp(rendition.data)
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'contain',
          background: '#ffffff',
        })
        .jpeg({ quality: 90, chromaSubsampling: '4:2:0' })
        .toBuffer({ resolveWithObject: true })
    }
  }

  if (rendition.data.byteLength > MAX_INSTAGRAM_IMAGE_BYTES) {
    throw new Error('The prepared Instagram image is larger than 8 MB. Use a smaller source image.')
  }

  const blob = await put(
    `cms/${asset.workspaceId}/instagram/${asset.id}-${Date.now()}.jpg`,
    rendition.data,
    {
      access: 'public',
      contentType: 'image/jpeg',
    }
  )
  await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: { thumbnailUrl: blob.url },
  })

  return {
    url: blob.url,
    mimeType: 'image/jpeg',
    fileSize: rendition.data.byteLength,
  }
}
