import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fileService } from '../services/fileService'
import { formatFileSize, formatDateRelative } from '../utils/formatters'
import { Files, HardDrive, TrendingUp, Clock, Upload, FolderOpen } from 'lucide-react'
import FileIcon from '../components/FileIcon'
import UploadButton from '../components/UploadButton'

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = async () => {
    try {
      const res = await fileService.getDashboard()
      setData(res.data)
    } catch (err) {
      console.error('Dashboard fetch error', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const quota = 1024 * 1024 * 1024 // 1 GB
  const used = data?.storage?.used || user?.storageUsed || 0
  const usagePercent = Math.min(100, (used / quota) * 100)
  const usageColor = usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-indigo-600'

  if (loading) {
    return (
      <div className="p-6 animate-pulse max-w-6xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-28" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0] || 'User'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here is an overview of your CloudVault storage</p>
        </div>
        <UploadButton onUploaded={fetchDashboard} />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-indigo-50 p-2 rounded-lg"><Files className="w-5 h-5 text-indigo-600" /></div>
            <span className="text-xs text-gray-400 font-medium">TOTAL FILES</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data?.totalFiles ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Files stored</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-blue-50 p-2 rounded-lg"><HardDrive className="w-5 h-5 text-blue-600" /></div>
            <span className="text-xs text-gray-400 font-medium">STORAGE USED</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatFileSize(used)}</p>
          <p className="text-sm text-gray-500 mt-1">of 1 GB allocated</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-green-50 p-2 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
            <span className="text-xs text-gray-400 font-medium">AVAILABLE</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatFileSize(Math.max(0, quota - used))}</p>
          <p className="text-sm text-gray-500 mt-1">Free space</p>
        </div>
      </div>

      {/* Storage bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Storage capacity</span>
          <span className="text-sm font-semibold text-gray-700">{usagePercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`${usageColor} h-2.5 rounded-full transition-all duration-500`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{formatFileSize(used)} used</span>
          <span>1 GB quota</span>
        </div>
      </div>

      {/* Recent files & Quick actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Recent Files</h2>
            </div>
            <Link to="/files" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.recentFiles && data.recentFiles.length > 0 ? (
              data.recentFiles.slice(0, 5).map((f) => (
                <div key={f._id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <FileIcon mimeType={f.mimeType} filename={f.originalName} className="w-8 h-8" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.originalName}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(f.size)} &middot; {formatDateRelative(f.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center">
                <Upload className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No files uploaded yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Quick Shortcuts</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: '/files', icon: Upload, label: 'Manage Files', color: 'bg-indigo-50 text-indigo-700' },
              { to: '/files', icon: FolderOpen, label: 'All Folders', color: 'bg-blue-50 text-blue-700' },
              { to: '/starred', icon: Files, label: 'Starred Files', color: 'bg-yellow-50 text-yellow-700' },
              { to: '/shared', icon: Files, label: 'Shared Links', color: 'bg-green-50 text-green-700' },
            ].map(({ to, icon: Icon, label, color }) => (
              <Link
                key={label}
                to={to}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all">
                <div className={`p-2.5 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
