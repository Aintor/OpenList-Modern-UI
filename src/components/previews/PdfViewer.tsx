import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  Scan,
  Check,
  ChevronDown,
  Shrink,
} from 'lucide-react'
import { useT } from '~/lang'

// Configure pdfjs worker using standard URL asset resolution in Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfViewerProps {
  url: string
  fileName?: string
}

interface PageMeta {
  pageNumber: number
  aspectRatio: number
}

const ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2.0 },
]

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, fileName }) => {
  const t = useT()
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pageMetas, setPageMetas] = useState<PageMeta[]>([])
  const [isEditingPage, setIsEditingPage] = useState<boolean>(false)
  const [pageInputVal, setPageInputVal] = useState<string>('1')
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false)
  const [zoomDropdownOpen, setZoomDropdownOpen] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const thumbnailRefs = useRef<(HTMLDivElement | null)[]>([])
  const sidebarScrollRef = useRef<HTMLDivElement>(null)

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    setError(null)
    setPdfDoc(null)
    setPageMetas([])
    setCurrentPage(1)

    const loadingTask = pdfjsLib.getDocument({
      url,
      withCredentials: false,
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    })

    loadingTask.promise
      .then(async (doc) => {
        if (isCancelled) return
        setPdfDoc(doc)
        setNumPages(doc.numPages)

        // Read initial dimensions of first page to establish aspect ratio
        try {
          const firstPage = await doc.getPage(1)
          const viewport = firstPage.getViewport({ scale: 1.0 })
          const ratio = viewport.height / viewport.width
          const metas: PageMeta[] = []
          for (let i = 1; i <= doc.numPages; i++) {
            metas.push({ pageNumber: i, aspectRatio: ratio })
          }
          if (!isCancelled) {
            setPageMetas(metas)
          }
        } catch {
          const metas: PageMeta[] = []
          for (let i = 1; i <= doc.numPages; i++) {
            metas.push({ pageNumber: i, aspectRatio: 1.414 })
          }
          if (!isCancelled) {
            setPageMetas(metas)
          }
        }
        setLoading(false)
      })
      .catch((err) => {
        if (isCancelled) return
        console.error('Failed to load PDF document:', err)
        setError(err.message || 'Failed to load PDF')
        setLoading(false)
      })

    return () => {
      isCancelled = true
      loadingTask.destroy()
    }
  }, [url])

  // Trackpad pinch-to-zoom support (intercepts ctrlKey wheel on macOS Chrome/Safari)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const zoomDelta = -e.deltaY * 0.005
        setScale((prev) => {
          const next = Math.min(3.0, Math.max(0.4, prev + zoomDelta))
          return Math.round(next * 100) / 100
        })
      }
    }

    const handleGestureStart = (e: Event) => {
      e.preventDefault()
    }

    const handleGestureChange = (e: any) => {
      e.preventDefault()
      if (e.scale) {
        setScale((prev) => {
          const factor = e.scale > 1 ? 1.02 : 0.98
          const next = Math.min(3.0, Math.max(0.4, prev * factor))
          return Math.round(next * 100) / 100
        })
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('gesturestart', handleGestureStart, { passive: false })
    container.addEventListener('gesturechange', handleGestureChange, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('gesturestart', handleGestureStart)
      container.removeEventListener('gesturechange', handleGestureChange)
    }
  }, [])

  // Track currently visible page on scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container || numPages === 0) return

    const handleScroll = () => {
      const containerTop = container.scrollTop
      const containerHeight = container.clientHeight
      const centerLine = containerTop + containerHeight / 3

      for (let i = 0; i < pageRefs.current.length; i++) {
        const pageEl = pageRefs.current[i]
        if (!pageEl) continue
        const pageTop = pageEl.offsetTop
        const pageBottom = pageTop + pageEl.clientHeight
        if (centerLine >= pageTop && centerLine <= pageBottom) {
          const pageNum = i + 1
          setCurrentPage(pageNum)
          // Also gently scroll corresponding thumbnail into view if sidebar is open
          if (isSidebarOpen) {
            thumbnailRefs.current[i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }
          break
        }
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [numPages, isSidebarOpen])

  // Scroll to page
  const scrollToPage = useCallback((pageNum: number) => {
    if (pageNum < 1 || pageNum > numPages) return
    const pageEl = pageRefs.current[pageNum - 1]
    if (pageEl && containerRef.current) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setCurrentPage(pageNum)
    }
  }, [numPages])

  // Zoom handlers
  const handleZoomIn = () => {
    setScale((prev) => Math.min(3.0, Math.round((prev + 0.15) * 100) / 100))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.4, Math.round((prev - 0.15) * 100) / 100))
  }

  const handleSetZoomPreset = (val: number) => {
    setScale(val)
    setZoomDropdownOpen(false)
  }

  const handleFitWidth = () => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth - 48
    const baseWidth = 595
    const targetScale = Math.min(2.5, Math.max(0.4, containerWidth / baseWidth))
    setScale(Math.round(targetScale * 100) / 100)
    setZoomDropdownOpen(false)
  }

  const handleFitPage = () => {
    if (!containerRef.current) return
    const containerHeight = containerRef.current.clientHeight - 64
    const baseHeight = 842
    const targetScale = Math.min(2.0, Math.max(0.4, containerHeight / baseHeight))
    setScale(Math.round(targetScale * 100) / 100)
    setZoomDropdownOpen(false)
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        scrollToPage(currentPage + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        scrollToPage(currentPage - 1)
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        handleZoomIn()
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault()
        handleZoomOut()
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        setScale(1.0)
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        handleRotate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, scrollToPage])

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsEditingPage(false)
    const pageNum = parseInt(pageInputVal, 10)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages) {
      scrollToPage(pageNum)
    } else {
      setPageInputVal(String(currentPage))
    }
  }

  return (
    <div className="relative flex h-[75vh] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      {/* 1. Left Thumbnail Sidebar (macOS Preview Style) */}
      <div
        className={`relative flex flex-col border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md transition-all duration-200 ease-in-out shrink-0 overflow-hidden ${
          isSidebarOpen ? 'w-48 sm:w-56' : 'w-0 border-r-0'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-11 items-center justify-between border-b border-slate-800/80 px-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <PanelLeft className="h-3.5 w-3.5 text-indigo-400" />
            <span>{t('home.preview.thumbnails') || '缩略图'}</span>
            <span className="font-mono text-[10px] text-slate-500">({numPages})</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            title="收起侧边栏"
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Thumbnail Scroll Area */}
        <div
          ref={sidebarScrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-3"
        >
          {pageMetas.map((meta, index) => {
            const isCurrent = meta.pageNumber === currentPage
            return (
              <div
                key={meta.pageNumber}
                ref={(el) => (thumbnailRefs.current[index] = el)}
                onClick={() => scrollToPage(meta.pageNumber)}
                className={`group relative flex flex-col items-center rounded-xl p-2 cursor-pointer transition-all duration-150 ${
                  isCurrent
                    ? 'bg-indigo-500/15 ring-2 ring-indigo-500 shadow-md'
                    : 'hover:bg-slate-800/60 ring-1 ring-slate-800/80 hover:ring-slate-700'
                }`}
              >
                {pdfDoc && (
                  <PdfThumbnailPage
                    pdfDoc={pdfDoc}
                    pageNumber={meta.pageNumber}
                    rotation={rotation}
                    aspectRatio={meta.aspectRatio}
                  />
                )}
                <div
                  className={`mt-1.5 text-center font-mono text-[11px] transition-colors ${
                    isCurrent ? 'text-indigo-400 font-semibold' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {meta.pageNumber}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. Main Canvas Scroll Viewport */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Floating Sidebar Open Button (When closed) */}
        {!isSidebarOpen && !loading && !error && numPages > 0 && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            title="展开缩略图侧边栏"
            className="absolute top-4 left-4 z-20 flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/85 hover:bg-indigo-500/15 hover:text-indigo-400 text-slate-300 shadow-lg backdrop-blur-xl transition-colors cursor-pointer"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        <div
          ref={containerRef}
          className="relative flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6"
        >
          {loading && (
            <div className="flex h-full w-full flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
              <span className="text-xs font-medium text-slate-400">
                {t('global.loading') || '加载中...'}
              </span>
            </div>
          )}

          {error && (
            <div className="flex h-full w-full flex-col items-center justify-center space-y-4 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="font-semibold text-slate-200">
                  {t('global.load_failed') || '加载失败'}
                </h4>
                <p className="text-xs text-slate-400">{error}</p>
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={() => {
                    setLoading(true)
                    setError(null)
                  }}
                  className="flex items-center space-x-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-indigo-500/15 hover:text-indigo-400 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{t('global.retry') || '重试'}</span>
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  download={fileName}
                  className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t('global.download') || '下载'}</span>
                </a>
              </div>
            </div>
          )}

          {!loading && !error && pdfDoc && (
            <div className="flex flex-col items-center space-y-6 pb-20">
              {pageMetas.map((meta, index) => (
                <div
                  key={meta.pageNumber}
                  ref={(el) => (pageRefs.current[index] = el)}
                  data-page-number={meta.pageNumber}
                  className="transition-transform duration-150"
                >
                  <PdfSinglePage
                    pdfDoc={pdfDoc}
                    pageNumber={meta.pageNumber}
                    scale={scale}
                    rotation={rotation}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Floating Frosted Glass Dock (Zero Stutter Pure-CSS Opacity Transition) */}
        {!loading && !error && numPages > 0 && (
          <div
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-150 ease-out ${
              zoomDropdownOpen ? 'opacity-100' : 'opacity-90 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3 rounded-full border border-slate-700/60 bg-slate-900/90 hover:border-indigo-500/40 px-4 py-2 text-xs text-slate-200 shadow-2xl backdrop-blur-xl transition-colors duration-150">
              {/* Sidebar Toggle Button */}
              <button
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                title="缩略图侧边栏"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer ${
                  isSidebarOpen
                    ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40'
                    : 'text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400'
                }`}
              >
                <PanelLeft className="h-4 w-4" />
              </button>

              {/* Divider */}
              <div className="h-4 w-px bg-slate-700/80" />

              {/* Page Navigation */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => scrollToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  title="上一页"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {isEditingPage ? (
                  <form onSubmit={handlePageInputSubmit} className="flex items-center">
                    <input
                      type="text"
                      autoFocus
                      value={pageInputVal}
                      onChange={(e) => setPageInputVal(e.target.value)}
                      onBlur={() => setIsEditingPage(false)}
                      className="h-7 w-10 rounded-md bg-slate-800 px-1 text-center font-mono text-xs font-semibold text-indigo-300 outline-none ring-1 ring-indigo-500"
                    />
                    <span className="mx-1.5 font-mono text-slate-400">/ {numPages}</span>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setPageInputVal(String(currentPage))
                      setIsEditingPage(true)
                    }}
                    title="跳转页码"
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    <span className="font-semibold text-white">{currentPage}</span>
                    <span className="text-slate-500">/</span>
                    <span className="text-slate-400">{numPages}</span>
                  </button>
                )}

                <button
                  onClick={() => scrollToPage(currentPage + 1)}
                  disabled={currentPage >= numPages}
                  title="下一页"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-4 w-px bg-slate-700/80" />

              {/* Zoom Controls with Dropdown Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleZoomOut}
                  disabled={scale <= 0.4}
                  title="缩小"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>

                {/* Interactive Zoom Percentage with Preset Dropdown Menu */}
                <DropdownMenu.Root open={zoomDropdownOpen} onOpenChange={setZoomDropdownOpen}>
                  <DropdownMenu.Trigger asChild>
                    <button
                      title="缩放比例"
                      className="flex items-center gap-1 h-7 px-2.5 font-mono text-xs font-semibold text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/15 data-[state=open]:text-indigo-400 data-[state=open]:bg-indigo-500/20 rounded-lg transition-colors cursor-pointer outline-none"
                    >
                      <span>{Math.round(scale * 100)}%</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                  </DropdownMenu.Trigger>

                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      side="top"
                      align="center"
                      sideOffset={12}
                      className="z-50 min-w-[130px] rounded-xl border border-slate-700/80 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 text-xs text-slate-200 outline-none"
                    >
                      {ZOOM_PRESETS.map((preset) => {
                        const isActive = Math.round(scale * 100) === Math.round(preset.value * 100)
                        return (
                          <DropdownMenu.Item
                            key={preset.value}
                            onClick={() => handleSetZoomPreset(preset.value)}
                            className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 font-mono text-xs outline-none transition-colors ${
                              isActive
                                ? 'bg-indigo-500/15 font-semibold text-indigo-400'
                                : 'text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 focus:bg-indigo-500/15 focus:text-indigo-400'
                            }`}
                          >
                            <span>{preset.label}</span>
                            {isActive && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                          </DropdownMenu.Item>
                        )
                      })}

                      <DropdownMenu.Separator className="my-1.5 h-px bg-slate-700/80" />

                      <DropdownMenu.Item
                        onClick={handleFitWidth}
                        className="flex cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none transition-colors hover:bg-indigo-500/15 hover:text-indigo-400 focus:bg-indigo-500/15 focus:text-indigo-400"
                      >
                        <Scan className="h-3.5 w-3.5" />
                        <span>适应宽度</span>
                      </DropdownMenu.Item>

                      <DropdownMenu.Item
                        onClick={handleFitPage}
                        className="flex cursor-pointer items-center space-x-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none transition-colors hover:bg-indigo-500/15 hover:text-indigo-400 focus:bg-indigo-500/15 focus:text-indigo-400"
                      >
                        <Shrink className="h-3.5 w-3.5" />
                        <span>适应整页</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                <button
                  onClick={handleZoomIn}
                  disabled={scale >= 3.0}
                  title="放大"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>

                <button
                  onClick={handleFitWidth}
                  title="适应宽度"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <Scan className="h-4 w-4" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-4 w-px bg-slate-700/80" />

              {/* Orientation */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRotate}
                  title="旋转"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * High-DPI Retina Canvas Page Component (Main Viewport)
 * Renders on demand when visible
 */
interface PdfSinglePageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy
  pageNumber: number
  scale: number
  rotation: number
}

const PdfSinglePage: React.FC<PdfSinglePageProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  rotation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState<boolean>(false)
  const renderTaskRef = useRef<any>(null)

  useEffect(() => {
    let isCancelled = false

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (isCancelled || !canvasRef.current) return

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            // ignore
          }
        }

        const canvas = canvasRef.current
        const pixelRatio = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale: scale * pixelRatio, rotation })

        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width / pixelRatio}px`
        canvas.style.height = `${viewport.height / pixelRatio}px`

        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) return

        const task = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        })
        renderTaskRef.current = task

        await task.promise
        if (!isCancelled) {
          setRendered(true)
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Render error on page ${pageNumber}:`, err)
        }
      }
    }

    renderPage()

    return () => {
      isCancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // ignore
        }
      }
    }
  }, [pdfDoc, pageNumber, scale, rotation])

  return (
    <div className="relative overflow-hidden rounded-sm bg-white shadow-2xl ring-1 ring-white/10 transition-all duration-200">
      <canvas ref={canvasRef} className="block" />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        </div>
      )}
    </div>
  )
}

/**
 * Lazy Thumbnail Page Component (Sidebar)
 * Uses IntersectionObserver to render lightweight mini canvases only when scrolled near
 */
interface PdfThumbnailPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy
  pageNumber: number
  rotation: number
  aspectRatio: number
}

const PdfThumbnailPage: React.FC<PdfThumbnailPageProps> = ({
  pdfDoc,
  pageNumber,
  rotation,
  aspectRatio,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isVisible, setIsVisible] = useState<boolean>(false)
  const [rendered, setRendered] = useState<boolean>(false)

  // Observe visibility in sidebar scroll container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '150px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible) return
    let isCancelled = false

    const renderThumbnail = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (isCancelled || !canvasRef.current) return

        // Mini thumbnail width: 140px
        const targetWidth = 140
        const unscaledViewport = page.getViewport({ scale: 1.0, rotation })
        const thumbScale = targetWidth / unscaledViewport.width
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: thumbScale * pixelRatio, rotation })

        const canvas = canvasRef.current
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width / pixelRatio}px`
        canvas.style.height = `${viewport.height / pixelRatio}px`

        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) return

        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        }).promise

        if (!isCancelled) {
          setRendered(true)
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Thumbnail error on page ${pageNumber}:`, err)
        }
      }
    }

    renderThumbnail()

    return () => {
      isCancelled = true
    }
  }, [isVisible, pdfDoc, pageNumber, rotation])

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center overflow-hidden rounded-md bg-white shadow-xs ring-1 ring-white/10"
      style={{
        width: 140,
        height: Math.round(140 * (aspectRatio || 1.414)),
      }}
    >
      <canvas ref={canvasRef} className="block" />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      )}
    </div>
  )
}
