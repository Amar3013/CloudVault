import { useState, useEffect } from 'react'
import { fileService } from '../services/fileService'
import { formatDate } from '../utils/formatters'
import FileIcon from '../components/FileIcon'
import { Share2, Copy, X, AlertCircle, Loader, CheckCircle } from 'lucide-react'

export default function SharedPage() {
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)

  const fetchShares = () => {
    fileService.getShares()
      .then((res) => setShares(res.data.shares || []))
      .catch(() => setError('Failed to load shared links'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchShares()
  }, [])

  const handleCopy = (shareUrl, id) => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRevoke = async (shareId) => {
    try {
      await fileService.revokeShare(shareId)
      setShares((prev) => prev.filter((s) => s._id !== shareId))
    } catch {
      setError('Failed to revoke share link')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shared Links</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage all active and expired public sharing links</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader className="w-8 h-8 text-indigo-600 animate-spin" /></div>
      ) : shares.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Share2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">No shared links created</p>
          <p className="text-sm text-gray-400 mt-1">Select "Share" on any file to create a secure temporary link.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            const now = Date.now()
            return shares.map((share) => {
              const isExpired = share.expiresAt && new Date(share.expiresAt).getTime() < now
              const shareUrl = `${window.location.origin}/share/${share.token}`
              return (
              <div key={share._id} className="bg-white rounded-2xl border border-gray-100 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-indigo-100 transition">
                <div className="flex items-center gap-3.5">
                  <FileIcon mimeType={share.file?.mimeType} filename={share.file?.originalName} className="w-10 h-10" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{share.file?.originalName || 'Shared File'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {isExpired ? (
                        <span className="text-[11px] font-medium bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full">Expired</span>
                      ) : (
                        <span className="text-[11px] font-medium bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full">Active</span>
                      )}
                      <span className="text-xs text-gray-400">Expires: {formatDate(share.expiresAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!isExpired && (
                    <button
                      onClick={() => handleCopy(shareUrl, share._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 cursor-pointer">
                      {copied === share._id ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === share._id ? 'Copied Link' : 'Copy Link'}
                    </button>
                  )}
                  <button
                    onClick={() => handleRevoke(share._id)}
                    title="Revoke access"
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })
        })()}
      </div>
      )}
    </div>
  )
}
