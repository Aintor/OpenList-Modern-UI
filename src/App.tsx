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
import { PreviewModal } from '~/components/previews/PreviewModal'
import { CopyMoveModal } from '~/components/modals/CopyMoveModal'
import { BatchRenameModal } from '~/components/modals/BatchRenameModal'
import { ShareModal } from '~/components/modals/ShareModal'
import { OfflineDownloadModal } from '~/components/modals/OfflineDownloadModal'
import { SearchModal } from '~/components/modals/SearchModal'
import { PasswordPrompt } from '~/components/folder/PasswordPrompt'
import { NotFoundPage } from '~/components/ui/NotFoundPage'
import { Manage } from '~/pages/manage/Manage'
import { LoginPage } from '~/pages/Login'
import { useObjStore } from '~/store/useObjStore'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useUserStore } from '~/store/useUserStore'
import { useTransferStore } from '~/store/useTransferStore'
import { extractDroppedFiles } from '~/utils/upload'
import { useT } from '~/lang'
import { StoreObj, Obj, ObjType, UserMethods } from '~/types'
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
    notFound,
    write,
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

  const isShareRoute =
    currentPath.startsWith('/@s') ||
    currentPath.startsWith('/@share') ||
    window.location.pathname.startsWith('/@s') ||
    window.location.pathname.startsWith('/@share')

  const canUpload =
    !isShareRoute &&
    write &&
    !needPassword &&
    !notFound &&
    (UserMethods.can(user, 3) || UserMethods.is_admin(user))

  const handleBlankFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUpload || !e.target.files?.length) return
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
  const [shareTargets, setShareTargets] = useState<Obj[]>([])
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
    if (!canUpload || isManageOpen) return
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canUpload || isManageOpen) return
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDraggingOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (!canUpload || isManageOpen) return
    if (e.dataTransfer) {
      const files = await extractDroppedFiles(e.dataTransfer)
      if (files.length > 0) {
        useTransferStore.getState().addUploadFiles(files, currentPath, password)
      }
    }
  }

  const handleGoToLogin = () => {
    window.history.pushState(null, '', `/@login?redirect=${encodeURIComponent(currentPath)}`)
    setIsLoginOpen(true)
  }

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
      if (rawPath.startsWith('/@login')) {
        if (!UserMethods.is_guest(user)) {
          const redirect = new URLSearchParams(window.location.search).get('redirect') || '/'
          window.history.replaceState(null, '', redirect)
          fetchPath(redirect)
        }
      } else {
        fetchPath(rawPath)
      }
    }
  }, [initialized, user, isShareRoute])

  // Listen to browser forward/back buttons
  useEffect(() => {
    const handlePopState = () => {
      const raw = window.location.pathname || '/'
      if (raw.startsWith('/@login')) {
        if (!UserMethods.is_guest(user)) {
          const redirect = new URLSearchParams(window.location.search).get('redirect') || '/'
          window.history.replaceState(null, '', redirect)
          fetchPath(redirect)
        } else {
          setIsLoginOpen(true)
        }
      } else {
        setIsLoginOpen(false)
        fetchPath(raw)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [user])

  // Auto-exit manage mode if user is guest
  useEffect(() => {
    if (UserMethods.is_guest(user) && isManageOpen) {
      setIsManageOpen(false)
    }
  }, [user, isManageOpen])

  // 1. Loading state while verifying session / guest
  if (!initialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  const isGuest = !user || UserMethods.is_guest(user)
  const isExplicitLoginRoute =
    window.location.pathname === '/@login' || window.location.pathname.startsWith('/@login')

  const isLoginActive =
    (!user && !isShareRoute) ||
    (isLoginOpen && isGuest) ||
    (isExplicitLoginRoute && !isShareRoute && isGuest)

  // 2. Full-page Login view (when unauthenticated, navigating to /@login, or clicking login in guest mode)
  if (isLoginActive && !isShareRoute) {
    return (
      <>
        <Toaster position="top-center" richColors theme="system" />
        <LoginPage
          onLoginSuccess={() => {
            setIsLoginOpen(false)
            const redirect = new URLSearchParams(window.location.search).get('redirect') || '/'
            window.history.pushState(null, '', redirect)
            fetchPath(redirect)
          }}
          onContinueAsGuest={() => {
            setIsLoginOpen(false)
            window.history.pushState(null, '', '/')
            fetchPath('/')
          }}
        />
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
    if (notFound || needPassword) return
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

      {/* Full-Viewport Immersive Drag & Drop Dropzone */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 p-4 sm:p-6 backdrop-blur-md pointer-events-none animate-in fade-in duration-150">
          <div className="flex h-full w-full flex-col items-center justify-center space-y-4 rounded-3xl border-3 border-dashed border-indigo-500 bg-white/90 dark:bg-slate-900/90 shadow-2xl backdrop-blur-2xl transition-all text-center p-6 sm:p-10">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shadow-lg shadow-indigo-500/10">
              <UploadCloud className="h-10 w-10 stroke-[2]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {t('home.upload.drop_hint') || '释放文件以上传至当前目录'}
              </h2>
              <p className="inline-flex items-center text-xs sm:text-sm font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/80 px-4 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-xs">
                {currentPath}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <Header
        onGoToLogin={handleGoToLogin}
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
              {!needPassword && !notFound && (
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
                  onOpenShare={(objs) => setShareTargets(objs)}
                />
              )}

              {/* Main Content Area */}
              <div className="flex-1">
                {loading ? (
                  <div className="flex h-64 items-center justify-center space-x-2 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    <span className="text-sm font-medium">{t('global.loading') || 'Loading files...'}</span>
                  </div>
                ) : needPassword ? (
                  <PasswordPrompt onGoToLogin={handleGoToLogin} />
                ) : notFound ? (
                  <NotFoundPage
                    onGoHome={() => {
                      window.history.pushState(null, '', '/')
                      fetchPath('/')
                    }}
                  />
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
                {!needPassword && !notFound && <PaginationBar />}
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
        onShare={(objs) => setShareTargets(objs)}
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
        targets={shareTargets}
        isOpen={shareTargets.length > 0}
        onClose={() => setShareTargets([])}
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
    </div>
  )
}

export default App
