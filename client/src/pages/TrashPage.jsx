import { useState, useEffect } from 'react'
import { fileService } from '../services/fileService'
import { formatFileSize, formatDate } from '../utils/formatters'
import FileIcon from '../components/FileIcon'
import { Trash2, RotateCcw, AlertCircle, Loader, AlertTriangle } from 'lucide-react'
import Modal from '../components/Modal'

export default function TrashPage() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const fetchTrash = () => {
    fileService.getTrash()
      .then((res) => setFiles(res.data.files || []))
      .catch(() => setError('Failed to load trash'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTrash()
  }, [])

  const handleRestore = async (file) => {
    try {
      await fileService.restoreFile(file._id)
      setFiles((prev) => prev.filter((f) => f._id !== file._id))
    } catch {
      setError('Restore failed')
    }
  }

  const handlePermanentDelete = async (file) => {
    try {
      await fileService.permanentDelete(file._id)
      setFiles((prev) => prev.filter((f) => f._id !== file._id))
      setConfirmDelete(null)
    } catch {
      setError('Permanent deletion failed')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Trash</h1>
        <p className="text-gray-500 text-sm mt-0.5">Files in trash can be restored or permanently removed from S3</p>
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
          <Trash2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">Trash is empty</p>
          <p className="text-sm text-gray-400 mt-1">Items moved to trash will appear here before permanent deletion.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Size</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Deleted At</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {files.map((file) => (
                <tr key={file._id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileIcon mimeType={file.mimeType} filename={file.originalName} className="w-8 h-8 opacity-60" size="sm" />
                      <div>
                        <span className="text-sm font-medium text-gray-500 line-through">{file.originalName}</span>
                        <p className="text-xs text-gray-400">{file.mimeType}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell text-sm text-gray-400">{formatFileSize(file.size)}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-sm text-gray-400">{formatDate(file.deletedAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleRestore(file)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-700 cursor-pointer">
                        <RotateCcw className="w-3.5 h-3.5 text-indigo-600" /> Restore
                      </button>
                      <button
                        onClick={() => setConfirmDelete(file)}
                        title="Delete permanently"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer">
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

      {/* Confirmation modal */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete file permanently?">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-red-50 text-red-700 rounded-xl p-3.5">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm leading-relaxed">
              This action will permanently delete <strong>{confirmDelete?.originalName}</strong> from Amazon S3 and MongoDB. This cannot be recovered.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer">
              Cancel
            </button>
            <button
              onClick={() => handlePermanentDelete(confirmDelete)}
              className="px-4 py-2 text-sm bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 cursor-pointer">
              Delete permanently
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
