import api from './api'
import axios from 'axios'
import { getNormalizedMimeType } from '../utils/formatters'

export const fileService = {
  getFiles: (params) => api.get('/files', { params }),
  getStarred: () => api.get('/files/starred'),
  getRecent: () => api.get('/files/recent'),
  getTrash: () => api.get('/files', { params: { deleted: true } }),

  async uploadFile(file, folderId, onProgress) {
    const mimeType = getNormalizedMimeType(file)

    try {
      // Step 1: get presigned POST URL
      const urlRes = await api.post('/files/upload-url', {
        filename: file.name,
        mimeType,
        size: file.size,
        folderId: folderId || undefined,
      })
      const { uploadData, fileId } = urlRes.data

      // Step 2: upload directly to S3
      const formData = new FormData()
      Object.entries(uploadData.fields).forEach(([k, v]) => formData.append(k, v))
      formData.append('file', file)

      await axios.post(uploadData.url, formData, {
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total))
          }
        },
      })

      // Step 3: confirm upload
      const confirmRes = await api.post('/files/confirm', { fileId })
      return confirmRes.data
    } catch (err) {
      // If direct S3 upload fails (CORS error from S3 bucket or network failure), fall back to backend upload
      const isS3DirectError = !err.response || err.message === 'Network Error' || (err.config?.url && err.config.url.includes('amazonaws.com'))
      if (isS3DirectError) {
        console.warn('[UPLOAD] Direct S3 upload failed (CORS or network error). Retrying via backend upload proxy...')
        const proxyForm = new FormData()
        proxyForm.append('file', file)
        if (folderId) proxyForm.append('folderId', folderId)

        const proxyRes = await api.post('/files/upload', proxyForm, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (onProgress && e.total) {
              onProgress(Math.round((e.loaded * 100) / e.total))
            }
          },
        })
        return proxyRes.data
      }
      throw err
    }
  },

  downloadFile: (id) => api.get(`/files/${id}/download`),
  renameFile: (id, name) => api.patch(`/files/${id}`, { originalName: name }),
  starFile: (id, isStarred) => api.patch(`/files/${id}`, { isStarred }),
  deleteFile: (id) => api.delete(`/files/${id}`),
  restoreFile: (id) => api.post(`/files/${id}/restore`),
  permanentDelete: (id) => api.delete(`/files/${id}/permanent`),
  shareFile: (id, expiresIn) => api.post(`/files/${id}/share`, { expiresIn }),
  getShares: () => api.get('/shares'),
  revokeShare: (shareId) => api.delete(`/shares/${shareId}`),
  getSharedFile: (token) => api.get(`/shares/${token}`),

  getFolders: (params) => api.get('/folders', { params }),
  createFolder: (name, parentFolderId) => api.post('/folders', { name, parentFolderId }),
  renameFolder: (id, name) => api.patch(`/folders/${id}`, { name }),
  deleteFolder: (id) => api.delete(`/folders/${id}`),

  getDashboard: () => api.get('/dashboard'),
  getStorage: () => api.get('/storage'),
}
