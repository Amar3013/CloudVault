import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { formatFileSize, formatDate } from '../utils/formatters'
import { User, Mail, Calendar, HardDrive, LogOut, ShieldCheck } from 'lucide-react'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const quota = 1024 * 1024 * 1024 // 1 GB
  const used = user?.storageUsed || 0
  const usagePct = Math.min(100, (used / quota) * 100)
  const usageColor = usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-yellow-500' : 'bg-indigo-600'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your profile details and storage subscription</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" /> User Profile
        </h2>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-700 font-bold text-2xl">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
        <div className="space-y-3 pt-3 border-t border-gray-50">
          <div className="flex items-center justify-between text-sm py-1">
            <span className="text-gray-500 flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" /> Email address
            </span>
            <span className="font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1">
            <span className="text-gray-500 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" /> Account created
            </span>
            <span className="font-medium text-gray-900">{formatDate(user?.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1">
            <span className="text-gray-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" /> Authentication
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
              JWT Bearer Verified
            </span>
          </div>
        </div>
      </div>

      {/* Storage usage */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-600" /> Storage Usage
        </h2>
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">{formatFileSize(used)} used of {formatFileSize(quota)}</span>
            <span className="text-sm font-semibold text-gray-900">{usagePct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`${usageColor} h-2.5 rounded-full transition-all duration-500`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 pt-2 border-t border-gray-50">
          <span>Tier: Free Tier Academic</span>
          <span>{formatFileSize(Math.max(0, quota - used))} remaining</span>
        </div>
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-2">Session Management</h2>
        <p className="text-sm text-gray-500 mb-4">
          Terminates the active browser session and removes authentication tokens from local storage.
        </p>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition cursor-pointer">
          <LogOut className="w-4 h-4" /> Sign out of CloudVault
        </button>
      </div>
    </div>
  )
}
