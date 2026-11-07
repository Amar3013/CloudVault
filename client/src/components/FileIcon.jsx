import { File, FileText, Image, Archive, Table2 } from 'lucide-react'
import { getFileIcon } from '../utils/formatters'

const iconMap = {
  image: { Icon: Image, bg: 'bg-blue-50', color: 'text-blue-500' },
  'file-text': { Icon: FileText, bg: 'bg-red-50', color: 'text-red-500' },
  archive: { Icon: Archive, bg: 'bg-yellow-50', color: 'text-yellow-600' },
  table: { Icon: Table2, bg: 'bg-green-50', color: 'text-green-600' },
  file: { Icon: File, bg: 'bg-gray-50', color: 'text-gray-500' },
}

export default function FileIcon({ mimeType, filename, className = 'w-9 h-9', size = 'md' }) {
  const iconKey = getFileIcon(mimeType, filename)
  const { Icon, bg, color } = iconMap[iconKey] || iconMap.file
  const padding = size === 'sm' ? 'p-1.5' : 'p-2'
  return (
    <div className={`${className} ${bg} ${padding} rounded-lg flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-full h-full ${color}`} style={{ maxWidth: '20px', maxHeight: '20px' }} />
    </div>
  )
}
