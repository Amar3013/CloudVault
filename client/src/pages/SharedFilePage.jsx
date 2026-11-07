import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fileService } from '../services/fileService'
import { formatFileSize } from '../utils/formatters'
import FileIcon from '../components/FileIcon'
import { Cloud, Download, AlertTriangle, Loader, Clock, ShieldCheck } from 'lucide-react'

export default function SharedFilePage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fileService.getSharedFile(token)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'This link is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  const handleDownload = () => {
    if (!data?.downloadUrl) return
    setDownloading(true)
    try {
      window.location.href = data.downloadUrl
    } catch {
      setError('Download failed')
    } finally {
      setTimeout(() => setDownloading(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="bg-indigo-600 rounded-xl p-2 shadow-sm"><Cloud className="w-6 h-6 text-white" /></div>
            <span className="font-bold text-gray-900 text-xl tracking-tight">CloudVault</span>
          </Link>
          <p className="text-gray-500 text-xs mt-2 font-medium tracking-wide uppercase">Secure File Transfer</p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Verifying secure token...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <div className="bg-red-50 rounded-2xl p-4 inline-flex mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Link Unavailable</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">{error}</p>
              <Link
                to="/"
                className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                Go to CloudVault homepage &rarr;
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex flex-col items-center mb-6">
                <div className="p-3 bg-gray-50 rounded-2xl mb-4 border border-gray-100">
                  <FileIcon mimeType={data.file?.mimeType} filename={data.file?.name} className="w-16 h-16" />
                </div>
                <h2 className="font-bold text-gray-900 text-center text-lg break-all">{data.file?.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{formatFileSize(data.file?.size)}</p>

                {data.expiresAt && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expires {new Date(data.expiresAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-6 flex items-center gap-2.5 text-xs text-gray-600">
                <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Verified Amazon S3 presigned download URL. Encrypted in transit.</span>
              </div>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-md shadow-indigo-100 cursor-pointer">
                {downloading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloading ? 'Starting download...' : 'Download File'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by CloudVault &middot; <Link to="/register" className="text-indigo-600 hover:underline">Get your free cloud storage</Link>
        </p>
      </div>
    </div>
  )
}
