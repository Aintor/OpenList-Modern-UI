import React, { useState, useEffect, useRef } from 'react'
import {
  FolderPlus,
  ArrowUpDown,
  DownloadCloud,
  CheckSquare,
  Square,
  FolderInput,
  FolderOutput,
  Edit2,
  Trash2,
  Download,
  ListVideo,
  Send,
  UploadCloud,
  FileCode,
  ChevronDown,
  X,
  Archive,
  ArrowUp,
} from 'lucide-react'
import { useObjStore, OrderBy } from '~/store/useObjStore'
import { useUserStore } from '~/store/useUserStore'
import { useTransferStore } from '~/store/useTransferStore'
import { useDownload } from '~/hooks/useDownload'
import { useT } from '~/lang'
import { Obj } from '~/types'
import { CustomSelect } from '~/components/ui/CustomSelect'
import { Tooltip } from '~/components/ui/Tooltip'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface ToolbarProps {
  onOpenMkdir: () => void
  onOpenRename: (obj: Obj) => void
  onOpenDelete: (objs: Obj[]) => void
  onOpenBatchRename: (objs: Obj[]) => void
  onOpenCopyMove: (objs: Obj[], action: 'copy' | 'move') => void
  onOpenOfflineDownload: () => void
  onOpenPackageDownload?: (objs: Obj[]) => void
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onOpenMkdir,
  onOpenRename,
  onOpenDelete,
  onOpenBatchRename,
  onOpenCopyMove,
  onOpenOfflineDownload,
  onOpenPackageDownload,
}) => {
  const {
    objs,
    write,
    currentPath,
    password,
    orderBy,
    orderReverse,
    setOrderBy,
    selectAll,
    clearSelection,
    getSelectedObjs,
  } = useObjStore()
  const { user } = useUserStore()
  const { batchDownload, exportPlaylist, sendToAria2 } = useDownload()
  const { addUploadFiles } = useTransferStore()
  const t = useT()

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const downloadDropdownRef = useRef<HTMLDivElement>(null)

  const [uploadMenuOpen, setUploadMenuOpen] = useState(false)
  const uploadDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const selectedObjs = getSelectedObjs()
  const isAllSelected = objs.length > 0 && selectedObjs.length === objs.length
  const isAdmin = user?.role === 2

  // Always reset dropdown whenever selection is cleared or changed to empty
  useEffect(() => {
    if (selectedObjs.length === 0) {
      setDownloadMenuOpen(false)
    }
  }, [selectedObjs.length])

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        downloadMenuOpen &&
        downloadDropdownRef.current &&
        !downloadDropdownRef.current.contains(e.target as Node)
      ) {
        setDownloadMenuOpen(false)
      }
      if (
        uploadMenuOpen &&
        uploadDropdownRef.current &&
        !uploadDropdownRef.current.contains(e.target as Node)
      ) {
        setUploadMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [downloadMenuOpen, uploadMenuOpen])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const files = Array.from(e.target.files)
    addUploadFiles(files, currentPath, password)
    e.target.value = ''
    setUploadMenuOpen(false)
  }

  const sortOptions = [
    { value: 'name', label: t('home.obj.name') || 'Name' },
    { value: 'size', label: t('home.obj.size') || 'Size' },
    { value: 'modified', label: t('home.obj.modified') || 'Date' },
  ]

  return (
    <div className="mb-3.5 sm:mb-4 flex items-center justify-between gap-2 sm:gap-3 select-none overflow-x-auto scrollbar-none py-1 flex-nowrap shrink-0 w-full">
      {/* Left Action Buttons */}
      <div className="flex items-center gap-2 flex-nowrap shrink-0">
        {/* Upload Button */}
        {write && (
          <div className="relative">
            <DropdownMenu.Root open={uploadMenuOpen} onOpenChange={setUploadMenuOpen}>
              <div className="flex items-center rounded-xl bg-indigo-600 shadow-xs hover:bg-indigo-700 transition-all text-white">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>{t('home.toolbar.upload') || 'Upload'}</span>
                </button>
                {/* Desktop-only dropdown toggle for Folder Upload */}
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="hidden md:flex px-1.5 py-2 border-l border-indigo-500/50 hover:bg-indigo-800 rounded-r-xl transition-colors cursor-pointer"
                    title={t('home.upload.upload_folder') || 'Upload options'}
                  >
                    <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                  </button>
                </DropdownMenu.Trigger>
              </div>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  className="z-50 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                  <DropdownMenu.Item
                    onSelect={() => fileInputRef.current?.click()}
                    className="flex w-full cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 outline-none"
                  >
                    <UploadCloud className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('home.upload.upload_files') || 'Upload Files'}</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    onSelect={() => folderInputRef.current?.click()}
                    className="flex w-full cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 outline-none"
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('home.upload.upload_folder') || 'Upload Folder'}</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />

            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as any)}
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* New Folder */}
        {write && (
          <button
            onClick={onOpenMkdir}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <FolderPlus className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span>{t('home.toolbar.mkdir') || 'New Folder'}</span>
          </button>
        )}

        {/* Offline Download */}
        {isAdmin && (
          <button
            onClick={onOpenOfflineDownload}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <DownloadCloud className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            <span>{t('home.toolbar.offline_download') || 'Offline Download'}</span>
          </button>
        )}
      </div>

      {/* Right Controls: Select All & Sorting */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Select All Toggle */}
        <button
          onClick={() => (isAllSelected ? clearSelection() : selectAll(true))}
          className="flex items-center space-x-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
        >
          {isAllSelected ? (
            <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Square className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          )}
          <span>{isAllSelected ? t('home.toolbar.cancel_select') || 'Deselect All' : t('home.toolbar.offline_download_enhanced.select_all') || 'Select All'}</span>
        </button>

        {/* Sleek Custom Sort Select */}
        <div className="flex items-center space-x-1">
          <CustomSelect
            value={orderBy}
            onChange={(val) => setOrderBy(val as OrderBy)}
            options={sortOptions}
            icon={<ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />}
            triggerClassName="min-w-[100px] h-9"
            align="end"
          />
          <Tooltip
            content={orderReverse ? (t('home.toolbar.sort_desc') || '降序') : (t('home.toolbar.sort_asc') || '升序')}
            side="top"
          >
            <button
              onClick={() => setOrderBy(orderBy, !orderReverse)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-xs hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-all cursor-pointer"
            >
              <ArrowUp
                className={`h-4 w-4 transition-transform duration-200 ${
                  orderReverse ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
                }`}
              />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Floating Bottom Batch Action Bar */}
      {selectedObjs.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center space-x-1.5 sm:space-x-3 max-w-[calc(100vw-1.5rem)] overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden rounded-full border border-slate-200/80 bg-white/95 px-3 sm:px-4 py-1.5 sm:py-2 shadow-2xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95 animate-in slide-in-from-bottom-5 duration-200 select-none">
          <div className="flex items-center space-x-1.5 border-r border-slate-200 pr-2 sm:pr-3 dark:border-slate-700 shrink-0 whitespace-nowrap">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow-xs">
              {selectedObjs.length}
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              {t('home.toolbar.offline_download_enhanced.files_count') ? '已选' : 'Selected'}
            </span>
          </div>

          <div className="flex items-center space-x-1 shrink-0 whitespace-nowrap">
            {/* Download Action Dropdown */}
            <DropdownMenu.Root open={downloadMenuOpen} onOpenChange={setDownloadMenuOpen}>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  title={t('home.toolbar.batch_download') || 'Batch Download'}
                  className="flex items-center space-x-1.5 rounded-full bg-indigo-50 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-400 dark:hover:bg-indigo-900 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">{t('home.toolbar.download') || '下载'}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="top"
                  align="start"
                  sideOffset={12}
                  className="z-50 min-w-[200px] rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95 animate-in fade-in zoom-in-95 duration-150 select-none"
                >
                  <DropdownMenu.Item
                    onSelect={() => batchDownload(selectedObjs)}
                    className="flex w-full cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/80 outline-none"
                  >
                    <Download className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('home.toolbar.batch_download') || '直接批量下载'}</span>
                  </DropdownMenu.Item>

                  {onOpenPackageDownload && (
                    <DropdownMenu.Item
                      onSelect={() => onOpenPackageDownload(selectedObjs)}
                      className="flex w-full cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/60 outline-none"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>{t('home.toolbar.package_download') || '打包下载 (.zip)'}</span>
                    </DropdownMenu.Item>
                  )}

                  <DropdownMenu.Item
                    onSelect={() => exportPlaylist(selectedObjs)}
                    className="flex w-full cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/80 outline-none"
                  >
                    <ListVideo className="h-3.5 w-3.5 text-sky-500" />
                    <span>{t('home.toolbar.playlist_download') || '导出播放列表 (.m3u8)'}</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    onSelect={() => sendToAria2(selectedObjs)}
                    className="flex w-full cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/80 outline-none"
                  >
                    <Send className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{t('home.toolbar.send_aria2') || '发送到 Aria2 RPC'}</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Batch Rename */}
            {write && (
              <Tooltip content={t('home.toolbar.batch_rename') || '批量重命名'} side="top">
                <button
                  onClick={() => onOpenBatchRename(selectedObjs)}
                  className="rounded-full p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <FileCode className="h-4 w-4" />
                </button>
              </Tooltip>
            )}

            {/* Copy */}
            {write && (
              <Tooltip content={t('home.toolbar.copy') || '复制到...'} side="top">
                <button
                  onClick={() => onOpenCopyMove(selectedObjs, 'copy')}
                  className="rounded-full p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <FolderInput className="h-4 w-4" />
                </button>
              </Tooltip>
            )}

            {/* Move */}
            {write && (
              <Tooltip content={t('home.toolbar.move') || '移动到...'} side="top">
                <button
                  onClick={() => onOpenCopyMove(selectedObjs, 'move')}
                  className="rounded-full p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <FolderOutput className="h-4 w-4" />
                </button>
              </Tooltip>
            )}

            {/* Rename single */}
            {write && selectedObjs.length === 1 && (
              <Tooltip content={t('home.toolbar.rename') || '重命名'} side="top">
                <button
                  onClick={() => onOpenRename(selectedObjs[0])}
                  className="rounded-full p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </Tooltip>
            )}

            {/* Delete */}
            {write && (
              <Tooltip content={t('home.toolbar.delete') || '删除'} side="top">
                <button
                  onClick={() => onOpenDelete(selectedObjs)}
                  className="rounded-full p-1.5 sm:p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Tooltip>
            )}

            {/* Close / Deselect All Button */}
            <div className="border-l border-slate-200 pl-1 dark:border-slate-700 ml-0.5 sm:ml-1 shrink-0">
              <Tooltip content={t('home.toolbar.cancel_select') || '取消选择'} side="top">
                <button
                  onClick={() => {
                    setDownloadMenuOpen(false)
                    clearSelection()
                  }}
                  className="rounded-full p-1.5 sm:p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
