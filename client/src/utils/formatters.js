export function formatFileSize(bytes) {
  if (bytes === 0 || !bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export function formatDateRelative(dateStr) {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

export function getFileIcon(mimeType, fileName) {
  if (!mimeType && !fileName) return 'file'
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return 'image'
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'file-text'
  if (['text/plain', 'text/csv'].includes(mimeType) || ['txt', 'csv'].includes(ext)) return 'file-text'
  if (mimeType === 'application/zip' || ext === 'zip') return 'archive'
  if (ext === 'docx' || mimeType?.includes('word')) return 'file-text'
  if (ext === 'xlsx' || mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return 'table'
  return 'file'
}

export const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'text/plain', 'text/csv', 'text/x-csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/zip', 'application/x-zip', 'application/x-zip-compressed',
]

const EXT_TO_MIME = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
}

export function getNormalizedMimeType(file) {
  if (file.type && ALLOWED_TYPES.includes(file.type)) {
    return file.type
  }
  const ext = file.name?.split('.').pop()?.toLowerCase()
  return EXT_TO_MIME[ext] || file.type || 'application/octet-stream'
}

export function isAllowedFileType(file) {
  const ext = file.name?.split('.').pop()?.toLowerCase()
  if (EXT_TO_MIME[ext]) return true
  return ALLOWED_TYPES.includes(file.type)
}

export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
