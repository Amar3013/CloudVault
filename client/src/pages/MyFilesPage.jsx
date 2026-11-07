import { useState, useEffect, useCallback, useRef } from 'react'
import { fileService } from '../services/fileService'
import { formatFileSize, formatDate, ALLOWED_TYPES, MAX_FILE_SIZE } from '../utils/formatters'
import FileIcon from '../components/FileIcon'
import UploadButton from '../components/UploadButton'
import Modal from '../components/Modal'
import {
  Search, Grid, List, Star, Trash2, Download, Share2, Edit2, FolderPlus,
  Folder, ChevronRight, Home, MoreVertical, AlertCircle, Loader, FolderOpen, Upload
} from 'lucide-react'

function FileMenu({ file, onRename, onDelete, onStar, onShare, onDownload, onClose }) {
  return (
    <div
      className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 w-44"
      onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => { onDownload(); onClose() }}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
        <Download className="w-4 h-4 text-gray-500" /> Download
      </button>
      <button
        onClick={() => { onStar(); onClose() }}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
        <Star className={`w-4 h-4 ${file.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'}`} />
        {file.isStarred ? 'Unstar' : 'Star'}
      </button>
      <button
        onClick={() => { onShare(); onClose() }}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
        <Share2 className="w-4 h-4 text-gray-500" /> Share
      </button>
      <button
        onClick={() => { onRename(); onClose() }}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
        <Edit2 className="w-4 h-4 text-gray-500" /> Rename
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={() => { onDelete(); onClose() }}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer">
        <Trash2 className="w-4 h-4" /> Move to Trash
      </button>
    </div>
  )
}

export default function MyFilesPage() {
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [currentFolder, setCurrentFolder] = useState(null)
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: 'My Files' }])
  const [activeMenu, setActiveMenu] = useState(null)
  const [renameModal, setRenameModal] = useState(null)
  const [newName, setNewName] = useState('')
  const [shareModal, setShareModal] = useState(null)
  const [shareExpiry, setShareExpiry] = useState('24h')
  const [shareResult, setShareResult] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [newFolderModal, setNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const dropZoneRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [filesRes, foldersRes] = await Promise.all([
        fileService.getFiles({ folderId: currentFolder || '', search, sortBy, sortDir }),
        fileService.getFolders({ parentFolderId: currentFolder || '' })
      ])
      setFiles(filesRes.data.files || [])
      setFolders(foldersRes.data.folders || [])
    } catch {
      setError('Failed to load files and folders')
    } finally {
      setLoading(false)
    }
  }, [currentFolder, search, sortBy, sortDir])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Close menus on outside click
  useEffect(() => {
    const handleWindowClick = () => setActiveMenu(null)
    window.addEventListener('click', handleWindowClick)
    return () => window.removeEventListener('click', handleWindowClick)
  }, [])

  const navigateFolder = (folder) => {
    setCurrentFolder(folder._id)
    setBreadcrumb((prev) => [...prev, { id: folder._id, name: folder.name }])
  }

  const navigateBreadcrumb = (item) => {
    const idx = breadcrumb.findIndex((b) => b.id === item.id)
    setBreadcrumb(breadcrumb.slice(0, idx + 1))
    setCurrentFolder(item.id)
  }

  const handleDownload = async (file) => {
    try {
      const res = await fileService.downloadFile(file._id)
      if (res.data.url) {
        window.open(res.data.url, '_blank')
      }
    } catch {
      setError('Download failed')
    }
  }

  const handleStar = async (file) => {
    try {
      await fileService.starFile(file._id, !file.isStarred)
      setFiles((prev) => prev.map((f) => (f._id === file._id ? { ...f, isStarred: !f.isStarred } : f)))
    } catch {
      setError('Failed to update starred status')
    }
  }

  const handleDelete = async (file) => {
    try {
      await fileService.deleteFile(file._id)
      setFiles((prev) => prev.filter((f) => f._id !== file._id))
    } catch {
      setError('Failed to move file to trash')
    }
  }

  const handleRename = async () => {
    if (!newName.trim() || !renameModal) return
    try {
      await fileService.renameFile(renameModal._id, newName.trim())
      setFiles((prev) => prev.map((f) => (f._id === renameModal._id ? { ...f, originalName: newName.trim() } : f)))
      setRenameModal(null)
    } catch {
      setError('Failed to rename file')
    }
  }

  const handleShare = async () => {
    if (!shareModal) return
    setShareLoading(true)
    setShareResult(null)
    try {
      const res = await fileService.shareFile(shareModal._id, shareExpiry)
      setShareResult(res.data.shareUrl)
    } catch (err) {
      setShareResult(null)
      setError(err.response?.data?.error || 'Failed to generate share link')
    } finally {
      setShareLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await fileService.createFolder(newFolderName.trim(), currentFolder)
      setNewFolderModal(false)
      setNewFolderName('')
      fetchData()
    } catch {
      setError('Failed to create folder')
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      for (const file of Array.from(droppedFiles)) {
        if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) continue
        try {
          await fileService.uploadFile(file, currentFolder)
        } catch {
          // ignore or handle
        }
      }
      fetchData()
    }
  }

  const expiryOptions = [
    { value: '1h', label: '1 hour' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' }
  ]

  return (
    <div
      className="p-6 max-w-7xl mx-auto min-h-full"
      ref={dropZoneRef}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="fixed inset-0 bg-indigo-500/10 border-4 border-indigo-500 border-dashed z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-3">
            <Upload className="w-6 h-6 text-indigo-600 animate-bounce" />
            <p className="text-indigo-600 font-semibold text-lg">Drop files anywhere to upload</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Files</h1>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {breadcrumb.map((item, i) => (
              <div key={item.id ?? 'root'} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                <button
                  onClick={() => navigateBreadcrumb(item)}
                  className={`text-sm cursor-pointer transition-colors ${
                    i === breadcrumb.length - 1 ? 'text-gray-900 font-semibold' : 'text-gray-500 hover:text-indigo-600'
                  }`}>
                  {i === 0 ? <span className="flex items-center gap-1"><Home className="w-3.5 h-3.5" /> Root</span> : item.name}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNewFolderModal(true)}
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition cursor-pointer">
            <FolderPlus className="w-4 h-4" /> New folder
          </button>
          <UploadButton onUploaded={fetchData} folderId={currentFolder} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in current folder..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="createdAt">Sort by Date</option>
          <option value="originalName">Sort by Name</option>
          <option value="size">Sort by Size</option>
        </select>
        <select
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 cursor-pointer ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}>
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 cursor-pointer ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-6">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24"><Loader className="w-8 h-8 text-indigo-600 animate-spin" /></div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
          <FolderOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">No files or folders here</p>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            Use the "Upload" button above or drag files here to start storing securely in S3.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {folders.map((folder) => (
            <div
              key={folder._id}
              onDoubleClick={() => navigateFolder(folder)}
              className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all group flex flex-col items-center">
              <Folder className="w-12 h-12 text-indigo-400 mb-2 group-hover:scale-105 transition-transform" />
              <p className="text-xs font-semibold text-gray-700 text-center truncate w-full">{folder.name}</p>
              <span className="text-[10px] text-gray-400 mt-0.5">Folder</span>
            </div>
          ))}
          {files.map((file) => (
            <div
              key={file._id}
              className="relative bg-white rounded-2xl border border-gray-100 p-4 hover:border-indigo-200 hover:shadow-md transition-all group flex flex-col justify-between">
              <div className="flex justify-between items-center w-full mb-2">
                {file.isStarred ? (
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                ) : <span />}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenu(activeMenu === file._id ? null : file._id)
                  }}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="flex justify-center mb-3">
                <FileIcon mimeType={file.mimeType} filename={file.originalName} className="w-12 h-12" />
              </div>

              <div className="w-full text-center">
                <p className="text-xs font-medium text-gray-800 truncate" title={file.originalName}>
                  {file.originalName}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{formatFileSize(file.size)}</p>
              </div>

              {activeMenu === file._id && (
                <FileMenu
                  file={file}
                  onClose={() => setActiveMenu(null)}
                  onDownload={() => handleDownload(file)}
                  onStar={() => handleStar(file)}
                  onShare={() => { setShareModal(file); setShareResult(null) }}
                  onRename={() => { setRenameModal(file); setNewName(file.originalName) }}
                  onDelete={() => handleDelete(file)}
                />
              )}
            </div>
          ))}
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
              {folders.map((folder) => (
                <tr
                  key={folder._id}
                  onDoubleClick={() => navigateFolder(folder)}
                  className="hover:bg-gray-50 cursor-pointer transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-900">{folder.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell text-sm text-gray-400">&mdash;</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-sm text-gray-400">{formatDate(folder.createdAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => navigateFolder(folder)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer">
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {files.map((file) => (
                <tr key={file._id} className="hover:bg-gray-50 transition relative">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileIcon mimeType={file.mimeType} filename={file.originalName} className="w-8 h-8" size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900">{file.originalName}</span>
                          {file.isStarred && <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />}
                        </div>
                        <p className="text-xs text-gray-400">{file.mimeType}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell text-sm text-gray-500">{formatFileSize(file.size)}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-sm text-gray-500">{formatDate(file.createdAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="relative inline-block text-left">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveMenu(activeMenu === file._id ? null : file._id)
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition cursor-pointer">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {activeMenu === file._id && (
                        <FileMenu
                          file={file}
                          onClose={() => setActiveMenu(null)}
                          onDownload={() => handleDownload(file)}
                          onStar={() => handleStar(file)}
                          onShare={() => { setShareModal(file); setShareResult(null) }}
                          onRename={() => { setRenameModal(file); setNewName(file.originalName) }}
                          onDelete={() => handleDelete(file)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rename modal */}
      <Modal isOpen={!!renameModal} onClose={() => setRenameModal(null)} title="Rename file">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">New file name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setRenameModal(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleRename}
              className="px-4 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 cursor-pointer">
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Share modal */}
      <Modal isOpen={!!shareModal} onClose={() => { setShareModal(null); setShareResult(null) }} title="Share File">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Generate a temporary secure download link for <strong>{shareModal?.originalName}</strong>.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Link expiration</label>
            <div className="grid grid-cols-3 gap-2">
              {expiryOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setShareExpiry(value)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                    shareExpiry === value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {shareResult ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Shareable URL</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareResult}
                  className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-800"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(shareResult)}
                  className="px-4 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer">
                  Copy
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer">
              {shareLoading && <Loader className="w-4 h-4 animate-spin" />}
              Generate secure link
            </button>
          )}
        </div>
      </Modal>

      {/* New folder modal */}
      <Modal isOpen={newFolderModal} onClose={() => setNewFolderModal(false)} title="Create New Folder">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Folder name</label>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="e.g. Invoices, Projects"
              autoFocus
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setNewFolderModal(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleCreateFolder}
              className="px-4 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 cursor-pointer">
              Create folder
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
