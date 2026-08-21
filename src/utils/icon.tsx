import React from 'react'
import {
  Folder,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Film,
  Music,
  FileSpreadsheet,
  Presentation,
  FileQuestion,
  Compass,
} from 'lucide-react'
import { Obj, ObjType } from '~/types'

export function getFileIcon(obj: Obj, className = 'w-5 h-5'): React.ReactNode {
  if (obj.is_dir) {
    return <Folder className={`${className} text-amber-500 fill-amber-500/20`} />
  }

  const name = obj.name.toLowerCase()
  const ext = name.split('.').pop() || ''

  // Video
  if (
    obj.type === ObjType.VIDEO ||
    ['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm', 'm3u8', 'ts'].includes(ext)
  ) {
    return <Film className={`${className} text-rose-500 fill-rose-500/10`} />
  }

  // Audio
  if (
    obj.type === ObjType.AUDIO ||
    ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'opus', 'ape'].includes(ext)
  ) {
    return <Music className={`${className} text-violet-500 fill-violet-500/10`} />
  }

  // Image
  if (
    obj.type === ObjType.IMAGE ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'].includes(ext)
  ) {
    return <ImageIcon className={`${className} text-emerald-500 fill-emerald-500/10`} />
  }

  // Archive
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'].includes(ext)) {
    return <FileArchive className={`${className} text-amber-600 fill-amber-600/10`} />
  }

  // Code
  if (
    [
      'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'py', 'go',
      'rs', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'rb', 'sh', 'yaml', 'yml', 'toml'
    ].includes(ext)
  ) {
    return <FileCode className={`${className} text-blue-500 fill-blue-500/10`} />
  }

  // Documents
  if (['md', 'txt', 'pdf', 'doc', 'docx'].includes(ext)) {
    return <FileText className={`${className} text-sky-500 fill-sky-500/10`} />
  }

  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet className={`${className} text-emerald-600 fill-emerald-600/10`} />
  }

  if (['ppt', 'pptx'].includes(ext)) {
    return <Presentation className={`${className} text-orange-500 fill-orange-500/10`} />
  }

  if (['torrent'].includes(ext)) {
    return <Compass className={`${className} text-teal-500 fill-teal-500/10`} />
  }

  return <FileQuestion className={`${className} text-slate-400 fill-slate-400/10`} />
}
