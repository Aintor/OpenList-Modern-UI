import React, { useEffect, useRef, useState } from 'react'
import {
  Search,
  X,
  Loader2,
  Download,
  CornerDownLeft,
  Globe,
  FolderTree,
} from 'lucide-react'
import { SearchNode, Obj, ObjType } from '~/types'
import { fsSearch, fsGet } from '~/utils/api'
import { getFileIcon } from '~/utils/icon'
import { getFileSize } from '~/utils/str'
import { useObjStore } from '~/store/useObjStore'
import { useDownload } from '~/hooks/useDownload'
import { useT } from '~/lang'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  onNavigateToFolder: (path: string) => void
  onOpenFilePreview: (obj: Obj, parentPath: string) => void
}

/**
 * Keyword Highlight Component
 */
const HighlightedText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return <span className="truncate">{text}</span>
  }

  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return (
    <span className="truncate">
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="rounded bg-indigo-500/15 dark:bg-indigo-500/25 px-1 py-0.2 font-semibold text-indigo-600 dark:text-indigo-400"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateToFolder,
  onOpenFilePreview,
}) => {
  const t = useT()
  const { currentPath, password, fetchPath } = useObjStore()
  const { downloadObj } = useDownload()

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  const [keywords, setKeywords] = useState('')
  const [scope, setScope] = useState<number>(0) // 0: All, 1: Folder, 2: File
  const [searchInCurrent, setSearchInCurrent] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchNode[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const searchRoot = searchInCurrent ? (currentPath || '/') : '/'

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    } else {
      setKeywords('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Execute Search Debounced
  useEffect(() => {
    if (!isOpen) return
    const query = keywords.trim()
    if (!query) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const resp = await fsSearch(searchRoot, query, password, scope, 1, 100)
        if (resp.code === 200 && resp.data) {
          const list = (resp.data.content || []).map((node) => {
            let p = node.parent || '/'
            if (!p.startsWith('/')) p = '/' + p
            return {
              ...node,
              parent: p,
              path: p === '/' ? `/${node.name}` : `${p}/${node.name}`,
            }
          })
          setResults(list)
          setSelectedIndex(0)
        } else {
          setResults([])
        }
      } catch (err) {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 240)

    return () => clearTimeout(timer)
  }, [keywords, scope, searchRoot, isOpen, password])

  // Scroll active item into view
  useEffect(() => {
    if (resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.children[selectedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (!isOpen) return null

  // Handle selecting an item
  const handleSelectNode = async (node: SearchNode) => {
    if (node.is_dir) {
      const folderPath = node.parent === '/' ? `/${node.name}` : `${node.parent}/${node.name}`
      onClose()
      onNavigateToFolder(folderPath)
    } else {
      onClose()
      const filePath = node.parent === '/' ? `/${node.name}` : `${node.parent}/${node.name}`
      // 1. Fetch file parent directory so user stays in folder context
      await fetchPath(node.parent)

      // 2. Fetch full file object for preview
      try {
        const resp = await fsGet(filePath, password)
        if (resp.code === 200 && resp.data) {
          onOpenFilePreview(resp.data, node.parent)
        } else {
          onOpenFilePreview(
            {
              name: node.name,
              size: node.size,
              is_dir: false,
              modified: '',
              created: '',
              thumb: '',
              type: node.type as unknown as ObjType,
            },
            node.parent
          )
        }
      } catch (e) {
        onOpenFilePreview(
          {
            name: node.name,
            size: node.size,
            is_dir: false,
            modified: '',
            created: '',
            thumb: '',
            type: node.type as unknown as ObjType,
          },
          node.parent
        )
      }
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelectNode(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const hasQuery = keywords.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:p-6 pt-[12vh] sm:pt-[15vh] backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl shadow-black/20 backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-900/95 transition-all duration-200 ${
          hasQuery ? 'scale-100' : 'scale-[0.99]'
        }`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Spotlight Top Search Input Bar */}
        <div className="flex h-14 sm:h-15 items-center px-4">
          <Search className="h-4.5 w-4.5 text-slate-400 dark:text-slate-500 shrink-0 ml-0.5 mr-3" />
          
          <input
            ref={inputRef}
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={
              searchInCurrent
                ? (t('home.search.search_current_dir') || '搜索当前目录...')
                : (t('home.search.search_global') || '全站搜索文件或文件夹...')
            }
            className="flex-1 bg-transparent text-base font-normal text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100"
          />

          {/* Right Controls in Input Bar */}
          <div className="flex items-center space-x-1.5 shrink-0 ml-2">
            {/* Single Click Location Switcher (Global vs Current Folder) */}
            <button
              type="button"
              onClick={() => setSearchInCurrent(!searchInCurrent)}
              className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                searchInCurrent
                  ? 'border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800/60 dark:bg-indigo-950/60 dark:text-indigo-400'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              title={
                searchInCurrent
                  ? (t('home.search.current_dir_scope') || '当前目录')
                  : (t('home.search.global_scope') || '全局')
              }
            >
              {searchInCurrent ? (
                <FolderTree className="h-3.5 w-3.5" />
              ) : (
                <Globe className="h-3.5 w-3.5" />
              )}
              <span>
                {searchInCurrent
                  ? (t('home.search.current_dir_scope') || '当前目录')
                  : (t('home.search.global_scope') || '全局')}
              </span>
            </button>

            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500 shrink-0 mx-1" />
            ) : keywords ? (
              <button
                type="button"
                onClick={() => {
                  setKeywords('')
                  inputRef.current?.focus()
                }}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-500">
                ESC
              </kbd>
            )}
          </div>
        </div>

        {/* Expanded Content: Only shown when there is an active search query */}
        {hasQuery && (
          <>
            {/* Filter Scope Pills */}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30">
              <div className="flex items-center space-x-1">
                {[
                  { id: 0, label: t('home.search.scopes.all') || '全部' },
                  { id: 1, label: t('home.search.scopes.folder') || '文件夹' },
                  { id: 2, label: t('home.search.scopes.file') || '文件' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setScope(item.id)}
                    className={`rounded-lg px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                      scope === item.id
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-slate-400">
                {results.length > 0 ? (
                  <span>{t('home.search.items_count', { count: results.length }) || `${results.length} 项结果`}</span>
                ) : null}
              </div>
            </div>

            {/* Results Dropdown List */}
            <div
              ref={resultsContainerRef}
              className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-100/50 dark:divide-slate-800/40"
            >
              {loading && results.length === 0 ? (
                <div className="flex h-32 items-center justify-center space-x-2 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  <span className="text-xs">{t('home.search.searching') || '搜索中...'}</span>
                </div>
              ) : results.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-slate-400">
                  <p className="text-xs">{t('home.search.no_result') || '未找到相关文件或文件夹'}</p>
                </div>
              ) : (
                results.map((node, index) => {
                  const isSelected = index === selectedIndex
                  const dummyObj: Obj = {
                    name: node.name,
                    is_dir: node.is_dir,
                    size: node.size,
                    modified: '',
                    created: '',
                    thumb: '',
                    type: node.type as unknown as ObjType,
                  }

                  return (
                    <div
                      key={`${node.parent}/${node.name}-${index}`}
                      onClick={() => handleSelectNode(node)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {/* Left Icon & Details */}
                      <div className="flex items-center space-x-3 overflow-hidden flex-1 min-w-0 pr-2">
                        <div className="shrink-0">
                          {getFileIcon(dummyObj, 'h-4.5 w-4.5')}
                        </div>

                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="truncate text-xs sm:text-sm font-medium">
                              <HighlightedText text={node.name} highlight={keywords} />
                            </span>
                          </div>

                          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                            {node.parent}
                          </p>
                        </div>
                      </div>

                      {/* Right Metadata & Actions */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {node.is_dir ? (
                          <span className="text-[11px] text-slate-400">
                            {t('home.search.scopes.folder') || '文件夹'}
                          </span>
                        ) : node.size > 0 ? (
                          <span className="text-[11px] font-mono text-slate-400">
                            {getFileSize(node.size)}
                          </span>
                        ) : null}

                        {/* Quick action: Direct Download for file */}
                        {!node.is_dir && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              const filePath = node.parent === '/' ? `/${node.name}` : `${node.parent}/${node.name}`
                              const resp = await fsGet(filePath, password)
                              if (resp.code === 200 && resp.data) {
                                downloadObj(resp.data)
                              }
                            }}
                            title={t('home.preview.download') || '下载'}
                            className="rounded-md p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-opacity cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Enter Key Indicator */}
                        <div className="hidden sm:flex items-center text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CornerDownLeft className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Minimal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30">
              <span>
                {t('home.search.total_results', { count: results.length }) || `共 ${results.length} 项`}
              </span>
              <div className="flex items-center space-x-2">
                <span>{t('home.search.nav_hint') || '↑↓ 切换'}</span>
                <span>·</span>
                <span>{t('home.search.open_hint') || 'Enter 打开'}</span>
                <span>·</span>
                <span>{t('home.search.exit_hint') || 'ESC 退出'}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
