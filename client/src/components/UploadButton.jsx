import { useState, useRef } from 'react'
import { Upload, X, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { useFileUpload } from '../hooks/useFileUpload'

export default function UploadButton({ onUploaded, folderId }) {
  const [showProgress, setShowProgress] = useState(false)
  const inputRef = useRef(null)
  const { uploads, upload, clearCompleted } = useFileUpload({
    onSuccess: () => { if (onUploaded) onUploaded() }
  })

  const handleFiles = async (files) => {
    setShowProgress(true)
    await upload(files, folderId)
  }

  const handleInput = (e) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files)
      e.target.value = ''
    }
  }

  const allDone = uploads.length > 0 && uploads.every(u => u.status === 'done' || u.status === 'error')

  return (
    <div className="relative">
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
        <Upload className="w-4 h-4" /> Upload
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleInput}
        accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.xlsx,.zip" />

      {showProgress && uploads.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-80 z-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-900">Uploads</span>
            <button onClick={() => { clearCompleted(); setShowProgress(false) }}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {uploads.map((u) => (
              <div key={u.id}>
                <div className="flex items-center gap-2">
                  {u.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  {u.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  {(u.status === 'uploading' || u.status === 'validating') && <Loader className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{u.file.name}</p>
                    {u.status === 'error' && <p className="text-xs text-red-500">{u.error}</p>}
                    {u.status === 'uploading' && (
                      <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                        <div className="bg-indigo-500 h-1 rounded-full transition-all" style={{ width: `${u.progress}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {allDone && (
            <button onClick={() => { clearCompleted(); setShowProgress(false) }}
              className="mt-3 w-full text-xs text-indigo-600 hover:text-indigo-700 font-medium">Dismiss</button>
          )}
        </div>
      )}
    </div>
  )
}
