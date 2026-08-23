import React, { useEffect, useState, useRef } from 'react'
import { Header } from '~/components/layout/Header'
import { Sidebar } from '~/components/layout/Sidebar'
import { Toolbar } from '~/components/toolbar/Toolbar'
import { Grid } from '~/components/folder/Grid'
import { List } from '~/components/folder/List'
import { PaginationBar } from '~/components/folder/PaginationBar'
import { ContextMenu } from '~/components/folder/ContextMenu'
import { MkdirModal } from '~/components/modals/MkdirModal'
import { RenameModal } from '~/components/modals/RenameModal'
import { DeleteModal } from '~/components/modals/DeleteModal'
import { LoginModal } from '~/components/modals/LoginModal'
import { PreviewModal } from '~/components/previews/PreviewModal'
import { CopyMoveModal } from '~/components/modals/CopyMoveModal'
import { BatchRenameModal } from '~/components/modals/BatchRenameModal'
import { ShareModal } from '~/components/modals/ShareModal'
import { OfflineDownloadModal } from '~/components/modals/OfflineDownloadModal'
import { SearchModal } from '~/components/modals/SearchModal'
import { TransferManager } from '~/components/modals/TransferManager'
import { PasswordPrompt } from '~/components/folder/PasswordPrompt'
import { Manage } from '~/pages/manage/Manage'
import { LoginPage } from '~/pages/Login'
import { useObjStore } from '~/store/useObjStore'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useUserStore } from '~/store/useUserStore'
import { useTransferStore } from '~/store/useTransferStore'
import { extractDroppedFiles } from '~/utils/upload'
import { useT } from '~/lang'
import { StoreObj, Obj, ObjType } from '~/types'
import { GlobalAudioPlayer } from '~/components/player/GlobalAudioPlayer'
import { useAudioPlayerStore, isAudioFile } from '~/store/useAudioPlayerStore'
import { Toaster } from 'sonner'
import { Loader2, FolderOpen, UploadCloud } from 'lucide-react'

export function App() {
  const {
    currentPath,
    password,
    objs,
    loading,
    needPassword,
    fetchPath,
    getSelectedObjs,
    selectIndex,
    selectAll,
  } = useObjStore()
  const { layout, setLayout, searchKeywords, fetchSettings } = useSettingsStore()
  const { user, initialized, fetchUser } = useUserStore()
  const t = useT()

  const blankFileInputRef = useRef<HTMLInputElement>(null)
  const blankFolderInputRef = useRef<HTMLInputElement>(null)

  const handleBlankFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const files = Array.from(e.target.files)
    useTransferStore.getState().addUploadFiles(files, currentPath, password)
    e.target.value = ''
  }

  // Manage view toggle
  const [isManageOpen, setIsManageOpen] = useState(false)

  // Filter state
  const [typeFilter, setTypeFilter] = useState<ObjType | undefined>(undefined)

  // Modals state
  const [isMkdirOpen, setIsMkdirOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Obj | null>(null)
  const [deleteTargets, setDeleteTargets] = useState<Obj[]>([])
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<Obj | null>(null)
  const [isOfflineDownloadOpen, setIsOfflineDownloadOpen] = useState(false)
  const [copyMoveState, setCopyMoveState] = useState<{ targets: Obj[]; action: 'copy' | 'move' } | null>(null)
  const [batchRenameTargets, setBatchRenameTargets] = useState<Obj[]>([])
  const [shareTarget, setShareTarget] = useState<Obj | null>(null)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)

  // Context Menu state
  const [contextObj, setContextObj] = useState<StoreObj | null>(null)
  const [contextObjs, setContextObjs] = useState<StoreObj[]>([])
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null)

  // Drag & drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDraggingOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (e.dataTransfer) {
      const files = await extractDroppedFiles(e.dataTransfer)
      if (files.length > 0) {
        useTransferStore.getState().addUploadFiles(files, currentPath, password)
      }
    }
  }

  const isShareRoute = window.location.pathname.startsWith('/@s') || window.location.pathname.startsWith('/@share')

  // Initial load settings and user
  useEffect(() => {
    fetchSettings()
    fetchUser()
  }, [])

  // Automatically fetch file directory as soon as user session is ready or when user logs in
  useEffect(() => {
    if (initialized && (user || isShareRoute)) {
      const rawPath = window.location.pathname && window.location.pathname !== '/'
        ? window.location.pathname
        : '/'
      fetchPath(rawPath)
    }
  }, [initialized, user, isShareRoute])

  // Listen to browser forward/back buttons
  useEffect(() => {
    const handlePopState = () => {
      fetchPath(window.location.pathname || '/')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // 1. Loading state while verifying session / guest
  if (!initialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  // 2. If neither logged in nor guest is enabled, and not browsing a public share link, show Login Screen quietly
  if (!user && !isShareRoute) {
    return (
      <>
        <Toaster position="top-center" richColors theme="system" />
        <LoginPage />
      </>
    )
  }

  // Filter objects by search keywords and selected type
  const filteredObjs = objs.filter((obj) => {
    if (searchKeywords && !obj.name.toLowerCase().includes(searchKeywords.toLowerCase())) {
      return false
    }
    return !(typeFilter !== undefined && !obj.is_dir && obj.type !== typeFilter);

  })

  const handleOpenObj = (obj: StoreObj) => {
    if (obj.is_dir) {
      const newPath = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + obj.name
      window.history.pushState(null, '', encodeURI(newPath))
      fetchPath(newPath)
    } else if (isAudioFile(obj)) {
      useAudioPlayerStore.getState().playTrack(obj, currentPath, objs)
    } else {
      setPreviewTarget(obj)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, clickedObj: StoreObj) => {
    e.preventDefault()
    const selectedObjs = getSelectedObjs()
    const isClickedObjSelected = clickedObj.selected || selectedObjs.some((o) => o.name === clickedObj.name)

    if (selectedObjs.length > 1 && isClickedObjSelected) {
      // Right-clicked an item in an active multi-selection -> batch context menu
      setContextObj(clickedObj)
      setContextObjs(selectedObjs)
    } else {
      // Right-clicked a single item -> select it and open single item context menu
      if (!isClickedObjSelected) {
        const clickedIndex = objs.findIndex((o) => o.name === clickedObj.name)
        if (clickedIndex >= 0) {
          selectIndex(clickedIndex, true, true)
        }
      }
      setContextObj(clickedObj)
      setContextObjs([clickedObj])
    }
    setContextPos({ x: e.clientX, y: e.clientY })
  }

  const handleBlankContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.viselect-item')) return
    e.preventDefault()
    setContextObj(null)
    setContextObjs([])
    setContextPos({ x: e.clientX, y: e.clientY })
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans"
    >
      <Toaster position="top-center" richColors theme="system" />

      {/* Drag & Drop Visual Backdrop */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-black/40 p-6 backdrop-blur-xl pointer-events-none animate-in fade-in duration-150">
          <div className="flex flex-col items-center space-y-3 rounded-3xl border-2 border-dashed border-indigo-500/80 bg-white/85 dark:bg-slate-900/85 p-8 sm:p-10 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl transition-all">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <UploadCloud className="h-8 w-8" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100">
                {t('home.upload.drop_hint') || '释放文件以上传至当前目录'}
              </h3>
              <p className="inline-block text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/80 dark:bg-indigo-950/60 px-3 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                {currentPath}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <Header
        onOpenLoginModal={() => setIsLoginOpen(true)}
        onToggleManage={() => setIsManageOpen(!isManageOpen)}
        onOpenSearchModal={() => setIsSearchModalOpen(true)}
        isManageOpen={isManageOpen}
      />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {isManageOpen ? (
          <Manage onBackToFiles={() => setIsManageOpen(false)} />
        ) : (
          <>
            {/* Left Category Sidebar */}
            <Sidebar
              currentFilter={typeFilter}
              onSelectFilter={(type) => setTypeFilter(type)}
            />

            {/* Right Main Explorer Content */}
            <main
              onContextMenu={handleBlankContextMenu}
              className="relative flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 lg:p-8"
            >
              {/* Hidden File Inputs for Blank Area Context Menu Uploads */}
              <input
                type="file"
                ref={blankFileInputRef}
                multiple
                onChange={handleBlankFileUpload}
                className="hidden"
              />
              <input
                type="file"
                ref={blankFolderInputRef}
                multiple
                // @ts-expect-error webkitdirectory is standard for folder picking
                webkitdirectory=""
                onChange={handleBlankFileUpload}
                className="hidden"
              />

              {/* Explorer Action Toolbar */}
              {!needPassword && (
                <Toolbar
                  onOpenMkdir={() => setIsMkdirOpen(true)}
                  onOpenRename={(obj) => setRenameTarget(obj)}
                  onOpenDelete={(objs) => setDeleteTargets(objs)}
                  onOpenBatchRename={(objs) => setBatchRenameTargets(objs)}
                  onOpenCopyMove={(objs, action) => setCopyMoveState({ targets: objs, action })}
                  onOpenOfflineDownload={() => setIsOfflineDownloadOpen(true)}
                  onOpenPackageDownload={(objs) =>
                    useTransferStore.getState().addPackageTask(objs, currentPath, password)
                  }
                />
              )}

              {/* Main Content Area */}
              <div className="flex-1 min-h-[70vh]">
                {loading ? (
                  <div className="flex h-64 items-center justify-center space-x-2 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    <span className="text-sm font-medium">{t('global.loading') || 'Loading files...'}</span>
                  </div>
                ) : needPassword ? (
                  <PasswordPrompt onOpenLoginModal={() => setIsLoginOpen(true)} />
                ) : filteredObjs.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                    <FolderOpen className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-2 stroke-[1.5]" />
                    <p className="text-sm font-semibold">{t('global.empty') || 'This directory is empty'}</p>
                  </div>
                ) : layout === 'grid' ? (
                  <Grid
                    objs={filteredObjs}
                    onOpen={handleOpenObj}
                    onContextMenu={handleContextMenu}
                  />
                ) : (
                  <List
                    objs={filteredObjs}
                    onOpen={handleOpenObj}
                    onContextMenu={handleContextMenu}
                  />
                )}

                {/* Pagination Controls */}
                <PaginationBar />
              </div>
            </main>
          </>
        )}
      </div>

      {/* Right Click Context Menu */}
      <ContextMenu
        obj={contextObj}
        objs={contextObjs}
        position={contextPos}
        onClose={() => setContextPos(null)}
        onOpen={handleOpenObj}
        onRename={(obj) => setRenameTarget(obj)}
        onBatchRename={(objs) => setBatchRenameTargets(objs)}
        onDelete={(objs) => setDeleteTargets(objs)}
        onShare={(obj) => setShareTarget(obj)}
        onCopyMove={(objs, action) => setCopyMoveState({ targets: objs, action })}
        onPackageDownload={(objs) =>
          useTransferStore.getState().addPackageTask(objs, currentPath, password)
        }
        onOpenMkdir={() => setIsMkdirOpen(true)}
        onUploadFiles={() => blankFileInputRef.current?.click()}
        onUploadFolder={() => blankFolderInputRef.current?.click()}
        onOpenOfflineDownload={() => setIsOfflineDownloadOpen(true)}
        onSelectAll={() => selectAll(true)}
        onRefresh={() => fetchPath(currentPath)}
        onToggleLayout={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
      />

      {/* Modals & Dialogs */}
      <MkdirModal
        isOpen={isMkdirOpen}
        onClose={() => setIsMkdirOpen(false)}
      />

      <RenameModal
        target={renameTarget}
        isOpen={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
      />

      <BatchRenameModal
        targets={batchRenameTargets}
        isOpen={batchRenameTargets.length > 0}
        onClose={() => setBatchRenameTargets([])}
      />

      <DeleteModal
        targets={deleteTargets}
        isOpen={deleteTargets.length > 0}
        onClose={() => setDeleteTargets([])}
      />

      <ShareModal
        target={shareTarget}
        isOpen={shareTarget !== null}
        onClose={() => setShareTarget(null)}
        currentPath={currentPath}
      />

      {copyMoveState && (
        <CopyMoveModal
          targets={copyMoveState.targets}
          action={copyMoveState.action}
          isOpen={true}
          onClose={() => setCopyMoveState(null)}
        />
      )}

      <OfflineDownloadModal
        isOpen={isOfflineDownloadOpen}
        onClose={() => setIsOfflineDownloadOpen(false)}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onNavigateToFolder={(folderPath) => {
          window.history.pushState(null, '', encodeURI(folderPath))
          fetchPath(folderPath)
        }}
        onOpenFilePreview={(obj, parentPath) => {
          if (isAudioFile(obj)) {
            useAudioPlayerStore.getState().playTrack(obj, parentPath)
          } else {
            setPreviewTarget(obj)
          }
        }}
      />

      <PreviewModal
        obj={previewTarget}
        currentPath={currentPath}
        isOpen={previewTarget !== null}
        onClose={() => setPreviewTarget(null)}
      />

      {/* Floating Global Audio Music Player (Apple Music / Vinyl Style) */}
      <GlobalAudioPlayer />

      {/* Floating Transfer Progress Manager (Uploads & Downloads) */}
      <TransferManager />
    </div>
  )
}

export default App
