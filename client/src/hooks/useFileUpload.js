import { useState, useCallback } from 'react'
import { fileService } from '../services/fileService'
import { isAllowedFileType, MAX_FILE_SIZE } from '../utils/formatters'

export function useFileUpload({ onSuccess, onError } = {}) {
  const [uploads, setUploads] = useState([]) // [{id, file, progress, status, error}]

  const upload = useCallback(async (files, folderId) => {
    const fileArray = Array.from(files)
    const newUploads = fileArray.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      progress: 0,
      status: 'validating',
      error: null,
    }))
    setUploads((prev) => [...prev, ...newUploads])

    const results = []
    for (const uploadItem of newUploads) {
      const { file } = uploadItem
      // Client-side validation
      if (!isAllowedFileType(file)) {
        setUploads((prev) => prev.map((u) => u.id === uploadItem.id ? { ...u, status: 'error', error: 'File type not allowed' } : u))
        if (onError) onError(`File type not allowed for ${file.name}`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        setUploads((prev) => prev.map((u) => u.id === uploadItem.id ? { ...u, status: 'error', error: 'File exceeds 25 MB limit' } : u))
        if (onError) onError(`File ${file.name} exceeds 25 MB limit`)
        continue
      }

      setUploads((prev) => prev.map((u) => u.id === uploadItem.id ? { ...u, status: 'uploading' } : u))
      try {
        const result = await fileService.uploadFile(file, folderId, (progress) => {
          setUploads((prev) => prev.map((u) => u.id === uploadItem.id ? { ...u, progress } : u))
        })
        setUploads((prev) => prev.map((u) => u.id === uploadItem.id ? { ...u, status: 'done', progress: 100 } : u))
        results.push(result)
        if (onSuccess) onSuccess(result)
      } catch (err) {
        const msg = err.response?.data?.error || 'Upload failed'
        setUploads((prev) => prev.map((u) => u.id === uploadItem.id ? { ...u, status: 'error', error: msg } : u))
        if (onError) onError(msg)
      }
    }
    return results
  }, [onSuccess, onError])

  const clearUploads = useCallback(() => setUploads([]), [])
  const clearCompleted = useCallback(() => setUploads((prev) => prev.filter((u) => u.status !== 'done')), [])

  return { uploads, upload, clearUploads, clearCompleted }
}
