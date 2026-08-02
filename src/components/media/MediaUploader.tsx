'use client'

/* eslint-disable @next/next/no-img-element -- CMS previews must render arbitrary authenticated upload URLs. */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { upload } from '@vercel/blob/client'
import { X, ImageIcon, Film, Loader2, GripVertical } from 'lucide-react'

interface MediaAsset {
  id: string
  fileUrl: string
  thumbnailUrl: string | null
  fileName: string | null
  mimeType: string | null
  fileSize?: string | number | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  createdAt?: string
}

interface MediaUploaderProps {
  workspaceId: string
  media: MediaAsset[]
  onMediaChange: (media: MediaAsset[]) => void
  maxFiles?: number
}

export function MediaUploader({ workspaceId, media, onMediaChange, maxFiles = 10 }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const reorderMedia = (from: number, to: number) => {
    if (from === to) return
    const next = [...media]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onMediaChange(next)
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true)
      setUploadError(null)
      setUploadProgress(0)

      const uploaded: MediaAsset[] = []

      for (const file of acceptedFiles) {
        try {
          let data: { success?: boolean; data?: MediaAsset; error?: string }
          let blobUpload:
            | { url: string }
            | null = null
          try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
            blobUpload = await upload(`cms/${workspaceId}/${Date.now()}-${safeName}`, file, {
              access: 'public',
              handleUploadUrl: '/api/media/client-upload',
              clientPayload: workspaceId,
              contentType: file.type,
              multipart: file.size > 10 * 1024 * 1024,
              onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(percentage)),
            })
          } catch (clientUploadError) {
            // Local development works without a Blob store. Production video
            // uploads use the direct multipart path above to avoid serverless
            // request-size limits.
            if (file.size > 4 * 1024 * 1024) throw clientUploadError
          }

          if (blobUpload) {
            const metadata = await readMediaMetadata(file)
            const registerRes = await fetch('/api/media/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                workspaceId,
                fileUrl: blobUpload.url,
                fileName: file.name,
                ...metadata,
              }),
            })
            data = await registerRes.json()
          } else {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('workspaceId', workspaceId)
            const fallbackRes = await fetch('/api/media/upload', {
              method: 'POST',
              body: formData,
            })
            data = await fallbackRes.json()
          }

          if (data.success && data.data) {
            uploaded.push(data.data)
          } else {
            setUploadError(data.error ?? 'Upload failed')
          }
        } catch {
          setUploadError('Network error during upload')
        }
      }

      onMediaChange([...media, ...uploaded])
      setUploading(false)
      setUploadProgress(0)
    },
    [media, onMediaChange, workspaceId]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/gif': [],
      'video/mp4': [], 'video/quicktime': [], 'video/webm': [],
    },
    maxFiles: maxFiles - media.length,
    disabled: uploading || media.length >= maxFiles,
  })

  const removeMedia = (id: string) => {
    onMediaChange(media.filter((m) => m.id !== id))
  }

  return (
    <div className="space-y-3">
      {/* Media grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {media.map((asset, i) => {
            const isVideo = asset.mimeType?.startsWith('video')
            return (
              <div
                key={asset.id}
                draggable={media.length > 1}
                onDragStart={() => setDragIndex(i)}
                onDragEnter={() => setDragOverIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndex !== null) reorderMedia(dragIndex, i)
                  setDragIndex(null)
                  setDragOverIndex(null)
                }}
                onDragEnd={() => {
                  setDragIndex(null)
                  setDragOverIndex(null)
                }}
                className={`relative aspect-square rounded-lg overflow-hidden bg-surface-strong group border transition-colors ${
                  dragOverIndex === i && dragIndex !== null && dragIndex !== i
                    ? 'border-accent-primary'
                    : 'border-border-default'
                } ${dragIndex === i ? 'opacity-40' : ''} ${media.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {isVideo ? (
                  <video src={asset.fileUrl} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={asset.thumbnailUrl ?? asset.fileUrl} alt={asset.fileName ?? ''} className="w-full h-full object-cover" />
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-between p-1">
                  {media.length > 1 ? (
                    <span className="w-5 h-5 bg-surface-strong/80 rounded-full flex items-center justify-center">
                      <GripVertical size={12} className="text-text-primary" />
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => removeMedia(asset.id)}
                    className="w-5 h-5 bg-surface-strong rounded-full flex items-center justify-center shadow-sm hover:bg-danger/20 transition-colors"
                  >
                    <X size={10} className="text-text-primary" />
                  </button>
                </div>
                {isVideo && (
                  <div className="absolute bottom-1 left-1">
                    <Film size={10} className="text-text-primary drop-shadow" />
                  </div>
                )}
                {i === 0 && (
                  <div className="absolute bottom-1 right-1 bg-black/70 text-text-primary text-[8px] px-1 py-0.5 rounded">Cover</div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {media.length > 1 && (
        <p className="text-[11px] text-text-tertiary -mt-1">
          Drag images to reorder the carousel. The first image is used as the cover.
        </p>
      )}

      {/* Drop zone */}
      {media.length < maxFiles && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-accent-primary bg-surface-hover'
              : uploading
              ? 'border-border-default bg-surface-subtle cursor-not-allowed'
              : 'border-border-default hover:border-border-strong hover:bg-surface-subtle'
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="text-text-secondary animate-spin" />
              <p className="text-sm text-text-secondary">
                Uploading{uploadProgress ? ` ${uploadProgress}%` : '…'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-text-tertiary">
                <ImageIcon size={20} />
                <Film size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  {isDragActive ? 'Drop files here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">JPEG, PNG, WebP, MP4, MOV up to 500MB</p>
              </div>
              {media.length > 0 && (
                <p className="text-xs text-text-tertiary">{media.length}/{maxFiles} files</p>
              )}
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-danger flex items-center gap-1">
          <X size={12} /> {uploadError}
        </p>
      )}
    </div>
  )
}

function readMediaMetadata(
  file: File
): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        const metadata = {
          width: video.videoWidth || undefined,
          height: video.videoHeight || undefined,
          durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
        }
        URL.revokeObjectURL(objectUrl)
        resolve(metadata)
      }
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve({})
      }
      video.src = objectUrl
      return
    }

    const image = new Image()
    image.onload = () => {
      const metadata = { width: image.naturalWidth, height: image.naturalHeight }
      URL.revokeObjectURL(objectUrl)
      resolve(metadata)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({})
    }
    image.src = objectUrl
  })
}
