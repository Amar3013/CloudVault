import { useState, useEffect } from 'react'
import { fileService } from '../services/fileService'
import { formatFileSize, formatDate } from '../utils/formatters'
import FileIcon from '../components/FileIcon'
import { Star, Download, Trash2, AlertCircle, Loader } from 'lucide-react'

export default function StarredPage() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fileService.getStarred()
      .then((res) => setFiles(res.data.files || []))
      .catch(() => setError('Failed to load starred files'))
      .finally(() => setLoading(false))
  }, [])

  const handleDownload = async (file) => {
    try {
      const res = await fileService.downloadFile(file._id)
      if (res.data.url) window.open(res.data.url, '_blank')
    } catch {
      setError('Download failed')
    }
  }

  const handleUnstar = async (file) => {
    try {
      await fileService.starFile(file._id, false)
      setFiles((prev) => prev.filter((f) => f._id !== file._id))
    } catch {
      setError('Failed to unstar file')
    }
  }

  const handleDelete = async (file) => {
    try {
      await fileService.deleteFile(file._id)
      setFiles((prev) => prev.filter((f) => f._id !== file._id))
    } catch {
      setError('Delete failed')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Starred Files</h1>
        <p className="text-gray-500 text-sm mt-0.5">Quick access to all your bookmarked files</p>
      </div>
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-20"><Loader className="w-8 h-8 text-indigo-600 animate-spin" /></div>
      ) : files.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Star className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">No starred files</p>
          <p className="text-sm text-gray-400 mt-1">Star files in My Files to easily find them here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Size</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Uploaded</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {files.map((file) => (
                <tr key={file._id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileIcon mimeType={file.mimeType} filename={file.originalName} className="w-8 h-8" size="sm" />
                      <div>
                        <span className="text-sm font-medium text-gray-900">{file.originalName}</span>
                        <p className="text-xs text-gray-400">{file.mimeType}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell text-sm text-gray-500">{formatFileSize(file.size)}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-sm text-gray-500">{formatDate(file.createdAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => handleDownload(file)}
                        title="Download"
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUnstar(file)}
                        title="Unstar"
                        className="p-1.5 text-yellow-400 hover:bg-yellow-50 rounded-lg cursor-pointer">
                        <Star className="w-4 h-4 fill-yellow-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(file)}
                        title="Move to Trash"
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
