import React, { useEffect, useState } from 'react'
import {
  Folder,
  File,
  ChevronRight,
  ArrowLeft,
  Loader2,
  FileArchive,
  Download,
} from 'lucide-react'
import { r } from '~/utils/request'
import { Resp, ArchiveList } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'

interface ArchivePreviewProps {
  filePath: string
}

interface ArchiveEntry {
  name: string
  is_dir: boolean
  size: number
  modified: string
}

export const ArchivePreview: React.FC<ArchivePreviewProps> = ({ filePath }) => {
  const t = useT()
  const [currentInnerPath, setCurrentInnerPath] = useState('')
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [decompressing, setDecompressing] = useState(false)

  const fetchArchiveContent = async (innerPath: string) => {
    setLoading(true)
    try {
      const resp: Resp<ArchiveList> = await r.post('/fs/archive/list', {
        src_dir: filePath,
        inner_path: innerPath,
        password: '',
      })

      if (resp.code === 200 && resp.data) {
        setEntries((resp.data.content || []) as any)
      } else {
        setEntries([])
      }
    } catch (e: any) {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArchiveContent('')
  }, [filePath])

  const handleEnterFolder = (folderName: string) => {
    const newPath = currentInnerPath
      ? `${currentInnerPath}/${folderName}`
      : folderName
    setCurrentInnerPath(newPath)
    fetchArchiveContent(newPath)
  }

  const handleGoUp = () => {
    if (!currentInnerPath) return
    const parts = currentInnerPath.split('/')
    parts.pop()
    const parentPath = parts.join('/')
    setCurrentInnerPath(parentPath)
    fetchArchiveContent(parentPath)
  }

  const handleDecompressAll = async () => {
    setDecompressing(true)
    try {
      const resp: Resp<any> = await r.post('/fs/archive/decompress', {
        src_dir: filePath,
        dst_dir: filePath.substring(0, filePath.lastIndexOf('/')) || '/',
        password: '',
      })

      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Decompress task started in background')
      } else {
        notify.error(resp.message || 'Decompress failed')
      }
    } catch (e: any) {
      notify.error(e.message || 'Decompress failed')
    } finally {
      setDecompressing(false)
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-700 bg-slate-900/90 text-slate-100 shadow-xl overflow-hidden">
      {/* Top Archive Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-3">
        <div className="flex items-center space-x-2 overflow-hidden">
          <FileArchive className="h-4 w-4 text-indigo-400 shrink-0" />
          <button
            onClick={handleGoUp}
            disabled={!currentInnerPath}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="truncate font-mono text-xs text-slate-300">
            /{currentInnerPath}
          </span>
        </div>

        <button
          onClick={handleDecompressAll}
          disabled={decompressing}
          className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {decompressing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span>{t('home.toolbar.decompress') || 'Decompress All'}</span>
        </button>
      </div>

      {/* Content List */}
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {loading ? (
          <div className="flex h-48 items-center justify-center space-x-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-xs">{t('global.loading') || 'Loading archive contents...'}</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center space-y-1 text-slate-400">
            <Folder className="h-8 w-8 stroke-[1.5]" />
            <span className="text-xs">{t('global.empty') || 'Empty folder inside archive'}</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {entries.map((entry, idx) => (
              <div
                key={idx}
                onClick={() => entry.is_dir && handleEnterFolder(entry.name)}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                  entry.is_dir
                    ? 'cursor-pointer hover:bg-slate-800/80 font-medium text-indigo-300'
                    : 'text-slate-300 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  {entry.is_dir ? (
                    <Folder className="h-4 w-4 text-indigo-400 shrink-0" />
                  ) : (
                    <File className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{entry.name}</span>
                </div>

                <div className="flex items-center space-x-3 text-slate-400 font-mono text-[11px] shrink-0">
                  {!entry.is_dir && (
                    <span>{(entry.size / (1024 * 1024)).toFixed(2)} MB</span>
                  )}
                  {entry.is_dir && <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
