import React, { useEffect, useState, useCallback } from 'react'
import {
  Folder,
  ChevronRight,
  ArrowLeft,
  Loader2,
  FileArchive,
  Download,
  AlertCircle,
  KeyRound,
  RefreshCw,
  Home,
} from 'lucide-react'
import { r } from '~/utils/request'
import { Resp, ArchiveMeta } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { useObjStore } from '~/store/useObjStore'
import { getFileSize } from '~/utils/str'
import { getFileIcon } from '~/utils/icon'

interface ArchivePreviewProps {
  filePath: string
}

interface ArchiveEntry {
  name: string
  is_dir: boolean
  size: number
  modified: string
  type?: number
}

export const ArchivePreview: React.FC<ArchivePreviewProps> = ({ filePath }) => {
  const t = useT()
  const { password: folderPassword } = useObjStore()
  const [currentInnerPath, setCurrentInnerPath] = useState('')
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [decompressing, setDecompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Encryption & Password support
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [archivePass, setArchivePass] = useState('')
  const [passInput, setPassInput] = useState('')

  // Archive Metadata (RawURL & Sign for direct file download / extraction)
  const [meta, setMeta] = useState<ArchiveMeta | null>(null)

  const archiveFileName = filePath.split('/').pop() || 'Archive'

  // Fetch Archive Metadata (Run once on mount or when password changes)
  const fetchMeta = useCallback(async (pass: string = '') => {
    try {
      const resp: Resp<ArchiveMeta> = await r.post('/fs/archive/meta', {
        path: filePath,
        src_dir: filePath,
        password: folderPassword || '',
        archive_pass: pass,
        archive_password: pass,
      })

      if (resp.code === 200 && resp.data) {
        setMeta(resp.data)
        setIsEncrypted(resp.data.encrypted || false)
      } else if (resp.code === 202) {
        setIsEncrypted(true)
      }
    } catch {
      // ignore meta fail, list will report accurate errors
    }
  }, [filePath, folderPassword])

  // Fetch Archive File List for a specific inner directory
  const fetchArchiveContent = useCallback(async (innerPath: string, pass: string = '') => {
    setLoading(true)
    setError(null)
    try {
      const resp: Resp<{ content: ArchiveEntry[]; total: number }> = await r.post('/fs/archive/list', {
        path: filePath,
        src_dir: filePath,
        inner_path: innerPath,
        password: folderPassword || '',
        archive_pass: pass,
        archive_password: pass,
        page: 1,
        per_page: 0,
      })

      if (resp.code === 200 && resp.data) {
        setEntries(resp.data.content || [])
        setIsEncrypted(false)
        setError(null)
      } else if (resp.code === 202) {
        setIsEncrypted(true)
        setError(t('home.archive.password_error') || 'Archive is encrypted. Please enter password.')
      } else {
        setError(resp.message || t('global.load_failed') || 'Failed to read archive contents')
        setEntries([])
      }
    } catch (e: any) {
      setError(e.message || t('global.load_failed') || 'Network error reading archive')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [filePath, folderPassword, t])

  useEffect(() => {
    fetchMeta(archivePass)
    fetchArchiveContent('', archivePass)
  }, [fetchMeta, fetchArchiveContent, archivePass])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!passInput) return
    setArchivePass(passInput)
    fetchMeta(passInput)
    fetchArchiveContent(currentInnerPath, passInput)
  }

  const handleEnterFolder = (folderName: string) => {
    const newPath = currentInnerPath
      ? `${currentInnerPath}/${folderName}`
      : folderName
    setCurrentInnerPath(newPath)
    fetchArchiveContent(newPath, archivePass)
  }

  const handleGoUp = () => {
    if (!currentInnerPath) return
    const parts = currentInnerPath.split('/')
    parts.pop()
    const parentPath = parts.join('/')
    setCurrentInnerPath(parentPath)
    fetchArchiveContent(parentPath, archivePass)
  }

  const handleJumpToPath = (index: number) => {
    if (index < 0) {
      setCurrentInnerPath('')
      fetchArchiveContent('', archivePass)
      return
    }
    const parts = currentInnerPath.split('/').slice(0, index + 1)
    const targetPath = parts.join('/')
    setCurrentInnerPath(targetPath)
    fetchArchiveContent(targetPath, archivePass)
  }

  // Decompress entire archive
  const handleDecompressAll = async () => {
    setDecompressing(true)
    try {
      const dir = filePath.substring(0, filePath.lastIndexOf('/')) || '/'
      const fileName = filePath.split('/').pop() || ''
      const resp: Resp<any> = await r.post('/fs/archive/decompress', {
        src_dir: dir,
        dst_dir: dir,
        name: [fileName],
        archive_pass: archivePass,
        archive_password: archivePass,
        password: folderPassword || '',
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

  // Extract and download single file from archive
  const handleDownloadSingleFile = (e: React.MouseEvent, entryName: string) => {
    e.stopPropagation()
    if (!meta?.raw_url) return
    const innerFull = currentInnerPath ? `${currentInnerPath}/${entryName}` : entryName
    let url = `${meta.raw_url}?inner=${encodeURIComponent(innerFull)}`
    if (meta.sign) url += `&sign=${meta.sign}`
    if (archivePass) url += `&pass=${encodeURIComponent(archivePass)}`
    window.open(url, '_blank')
  }

  const pathParts = currentInnerPath ? currentInnerPath.split('/') : []

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/95 text-slate-100 shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* Top Archive Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/80 px-4 py-3">
        {/* Breadcrumb Path */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs scrollbar-none py-0.5">
          <FileArchive className="h-4 w-4 text-indigo-400 shrink-0 mr-1" />
          <button
            onClick={handleGoUp}
            disabled={!currentInnerPath}
            title={t('global.back') || 'Go Up'}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30 transition-colors cursor-pointer mr-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>

          {/* Root Link */}
          <button
            onClick={() => handleJumpToPath(-1)}
            className={`flex items-center space-x-1 rounded-md px-1.5 py-0.5 font-medium transition-colors cursor-pointer ${
              !currentInnerPath ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span className="truncate max-w-[120px]">{archiveFileName}</span>
          </button>

          {/* Path segments */}
          {pathParts.map((part, idx) => {
            const isLast = idx === pathParts.length - 1
            return (
              <React.Fragment key={idx}>
                <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
                <button
                  onClick={() => handleJumpToPath(idx)}
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] transition-colors cursor-pointer ${
                    isLast
                      ? 'text-indigo-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {part}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {/* Action Button: Decompress All */}
        <button
          onClick={handleDecompressAll}
          disabled={decompressing || isEncrypted}
          className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40 cursor-pointer shrink-0"
        >
          {decompressing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span>{t('home.toolbar.decompress') || 'Decompress All'}</span>
        </button>
      </div>

      {/* Archive Comment (If present) */}
      {meta?.comment && (
        <div className="border-b border-slate-800/60 bg-slate-950/40 px-4 py-2 text-[11px] text-slate-400 font-mono italic">
          {meta.comment}
        </div>
      )}

      {/* Content Area */}
      <div className="min-h-[300px] max-h-[60vh] overflow-y-auto p-2 sm:p-3">
        {loading ? (
          <div className="flex h-48 flex-col items-center justify-center space-y-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">{t('global.loading') || 'Loading archive contents...'}</span>
          </div>
        ) : isEncrypted ? (
          /* Password Prompt Card */
          <div className="flex h-64 flex-col items-center justify-center space-y-4 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-200">
                {t('home.archive.encrypted_title') || 'Password Protected Archive'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm">
                {error || t('home.archive.enter_password_tip') || 'This archive requires a password to view and extract its contents.'}
              </p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="flex items-center gap-2 w-full max-w-xs">
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder={t('home.archive.password_placeholder') || 'Enter archive password'}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer shrink-0"
              >
                {t('global.confirm') || 'Unlock'}
              </button>
            </form>
          </div>
        ) : error ? (
          /* Error State with Retry */
          <div className="flex h-48 flex-col items-center justify-center space-y-3 text-center px-4">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <p className="text-xs text-rose-400 max-w-md font-medium">{error}</p>
            <button
              onClick={() => fetchArchiveContent(currentInnerPath, archivePass)}
              className="flex items-center space-x-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>{t('global.retry') || 'Retry'}</span>
            </button>
          </div>
        ) : entries.length === 0 ? (
          /* Empty Folder */
          <div className="flex h-48 flex-col items-center justify-center space-y-2 text-slate-500">
            <Folder className="h-9 w-9 stroke-[1.2]" />
            <span className="text-xs">{t('global.empty') || 'Empty folder inside archive'}</span>
          </div>
        ) : (
          /* File & Directory Entries List */
          <div className="space-y-1">
            {entries.map((entry, idx) => {
              const fileObj = { name: entry.name, is_dir: entry.is_dir } as any
              return (
                <div
                  key={idx}
                  onClick={() => entry.is_dir && handleEnterFolder(entry.name)}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-colors ${
                    entry.is_dir
                      ? 'cursor-pointer hover:bg-slate-800/80 font-medium text-slate-200'
                      : 'text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  {/* Left: Icon + Name */}
                  <div className="flex items-center space-x-2.5 truncate min-w-0 mr-3">
                    <div className="shrink-0 flex items-center justify-center">
                      {entry.is_dir ? (
                        <Folder className="h-4 w-4 text-indigo-400 fill-indigo-400/10" />
                      ) : (
                        getFileIcon(fileObj, 'h-4 w-4')
                      )}
                    </div>
                    <span className={`truncate ${entry.is_dir ? 'group-hover:text-indigo-400' : ''}`}>
                      {entry.name}
                    </span>
                  </div>

                  {/* Right: Size & Single Download */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {!entry.is_dir && (
                      <span className="font-mono text-[11px] text-slate-400">
                        {getFileSize(entry.size)}
                      </span>
                    )}

                    {/* Single File Extract & Download Button */}
                    {!entry.is_dir && meta?.raw_url && (
                      <button
                        onClick={(e) => handleDownloadSingleFile(e, entry.name)}
                        title={t('home.preview.download') || 'Download this file'}
                        className="rounded-lg p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-500/20 hover:text-indigo-400 transition-all cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {entry.is_dir && (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
