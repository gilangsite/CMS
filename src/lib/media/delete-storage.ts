import fs from 'fs/promises'
import path from 'path'
import { del } from '@vercel/blob'

interface StoredMedia {
  fileUrl: string
  thumbnailUrl: string | null
  storageProvider: string | null
}

function isVercelBlobUrl(value: string | null): value is string {
  if (!value) return false
  try {
    return new URL(value).hostname.endsWith('.blob.vercel-storage.com')
  } catch {
    return false
  }
}

async function deleteLocalUpload(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith('/uploads/')) return
  const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads')
  const filePath = path.resolve(process.cwd(), 'public', fileUrl.slice(1))
  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error('The local media path is outside the permitted upload directory.')
  }
  try {
    await fs.unlink(filePath)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

/**
 * Removes every stored object owned by one media record. Blob deletion is
 * idempotent, so callers can safely retry when a later database operation fails.
 */
export async function deleteMediaStorage(asset: StoredMedia): Promise<void> {
  const blobUrls = [...new Set([asset.fileUrl, asset.thumbnailUrl].filter(isVercelBlobUrl))]
  if (blobUrls.length > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is not configured; Blob cleanup will retry later.')
    }
    await del(blobUrls)
  }

  if (asset.storageProvider === 'local') {
    await deleteLocalUpload(asset.fileUrl)
  }
}
