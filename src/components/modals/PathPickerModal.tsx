import React, { useEffect, useRef, useState } from 'react'
import {
  X,
  Folder,
  File,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Check,
  FolderOpen,
} from 'lucide-react'
import { r } from '~/utils/request'
import { StoreObj, Resp } from '~/types'
import { SmartPath } from '~/components/ui/SmartPath'
import { Checkbox } from '~/components/ui/Checkbox'
import { useT } from '~/lang'
import { getFileSize } from '~/utils/str'

interface PathPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (selectedPaths: string[]) => void
  initialPath?: string
  initialSelectedPaths?: string[]
}

function normalizePath(p: string): string {
  if (!p) return '/'
  let clean = p.trim().replace(/\/+/g, '/')
  if (!clean.startsWith('/')) clean = '/' + clean
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1)
  return clean
}

function getAncestors(path: string): string[] {
  const norm = normalizePath(path)
  if (norm === '/') return []
  const parts = norm.split('/').filter(Boolean)
  const ancestors: string[] = ['/']
  let cur = ''
  for (let i = 0; i < parts.length - 1; i++) {
    cur += '/' + parts[i]
    ancestors.push(cur)
  }
  return ancestors
}

function getPathState(
  path: string,
  selectedPaths: Set<string>,
  excludedPaths: Set<string>
): 'checked' | 'unchecked' | 'indeterminate' {
  const normalized = normalizePath(path)

  // Find all ancestor prefixes including self: ['/', '/a', '/a/b', '/a/b/c']
  const parts = normalized.split('/').filter(Boolean)
  const prefixes: string[] = ['/']
  let cur = ''
  for (const seg of parts) {
    cur += '/' + seg
    prefixes.push(cur)
  }

  // Determine base state by finding deepest explicit rule
  let baseState: 'selected' | 'unselected' | 'none' = 'none'
  for (const p of prefixes) {
    if (selectedPaths.has(p)) {
      baseState = 'selected'
    } else if (excludedPaths.has(p)) {
      baseState = 'unselected'
    }
  }

  const prefixWithSlash = normalized === '/' ? '/' : normalized + '/'

  if (baseState === 'selected') {
    // Check if any excludedPath starts with prefixWithSlash
    let hasExcludedChild = false
    for (const ep of excludedPaths) {
      if (ep.startsWith(prefixWithSlash)) {
        hasExcludedChild = true
        break
      }
    }
    if (hasExcludedChild) {
      return 'indeterminate'
    }
    return 'checked'
  } else {
    // baseState is 'none' or 'unselected'
    // Check if any selectedPath starts with prefixWithSlash
    let hasSelectedChild = false
    for (const sp of selectedPaths) {
      if (sp.startsWith(prefixWithSlash)) {
        hasSelectedChild = true
        break
      }
    }
    if (hasSelectedChild) {
      return 'indeterminate'
    }
    return 'unchecked'
  }
}

function togglePath(
  path: string,
  selectedPaths: Set<string>,
  excludedPaths: Set<string>
): { selectedPaths: Set<string>; excludedPaths: Set<string> } {
  const nextSelected = new Set(selectedPaths)
  const nextExcluded = new Set(excludedPaths)
  const normalized = normalizePath(path)
  const prefixWithSlash = normalized === '/' ? '/' : normalized + '/'
  const currentState = getPathState(normalized, selectedPaths, excludedPaths)

  if (currentState === 'checked') {
    // Turn to unchecked:
    // 1. Remove this path and any descendants from selectedPaths
    for (const sp of Array.from(nextSelected)) {
      if (sp === normalized || sp.startsWith(prefixWithSlash)) {
        nextSelected.delete(sp)
      }
    }
    // 2. Remove any descendants from excludedPaths
    for (const ep of Array.from(nextExcluded)) {
      if (ep.startsWith(prefixWithSlash)) {
        nextExcluded.delete(ep)
      }
    }
    // 3. If an ancestor is selected, we must explicitly exclude this path
    const ancestors = getAncestors(normalized)
    for (const a of ancestors) {
      if (nextSelected.has(a)) {
        nextExcluded.add(normalized)
        break
      }
    }
  } else {
    // Current is 'unchecked' or 'indeterminate' -> Turn to 'checked':
    // 1. Remove this path from excludedPaths and any descendants
    for (const ep of Array.from(nextExcluded)) {
      if (ep === normalized || ep.startsWith(prefixWithSlash)) {
        nextExcluded.delete(ep)
      }
    }
    // 2. Remove any descendants from selectedPaths (they are now subsumed)
    for (const sp of Array.from(nextSelected)) {
      if (sp.startsWith(prefixWithSlash)) {
        nextSelected.delete(sp)
      }
    }
    // 3. Add this path to selectedPaths
    nextSelected.add(normalized)
  }

  return { selectedPaths: nextSelected, excludedPaths: nextExcluded }
}

function resolveEffectivePaths(
  selectedPaths: Set<string>,
  excludedPaths: Set<string>,
  dirCache: Map<string, StoreObj[]>
): string[] {
  const result: string[] = []

  function expand(path: string) {
    const prefixWithSlash = path === '/' ? '/' : path + '/'
    let hasExcludedChild = false
    for (const ep of excludedPaths) {
      if (ep.startsWith(prefixWithSlash)) {
        hasExcludedChild = true
        break
      }
    }

    if (!hasExcludedChild) {
      result.push(path)
      return
    }

    const children = dirCache.get(path)
    if (children && children.length > 0) {
      for (const child of children) {
        const childPath = normalizePath(`${prefixWithSlash}${child.name}`)
        const childState = getPathState(childPath, selectedPaths, excludedPaths)
        if (childState === 'checked') {
          result.push(childPath)
        } else if (childState === 'indeterminate') {
          expand(childPath)
        }
      }
    } else {
      result.push(path)
    }
  }

  for (const sp of selectedPaths) {
    expand(sp)
  }

  return Array.from(new Set(result))
}

export const PathPickerModal: React.FC<PathPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath = '/',
  initialSelectedPaths = [],
}) => {
  const t = useT()
  const [currentPath, setCurrentPath] = useState(initialPath || '/')
  const [items, setItems] = useState<StoreObj[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [excludedPaths, setExcludedPaths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const dirCache = useRef<Map<string, StoreObj[]>>(new Map())

  const fetchDirectory = async (path: string) => {
    setLoading(true)
    try {
      const resp: Resp<{ content: StoreObj[] }> = await r.post('/fs/list', {
        path,
        password: '',
        page: 1,
        per_page: 0,
        refresh: false,
      })

      if (resp.code === 200 && resp.data) {
        const sorted = (resp.data.content || []).sort((a, b) => {
          if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        })
        setItems(sorted)
        dirCache.current.set(normalizePath(path), sorted)
      } else {
        setItems([])
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      const startPath = initialPath || '/'
      setCurrentPath(startPath)
      const initialNorm = (initialSelectedPaths || []).map(normalizePath).filter(Boolean)
      setSelectedPaths(new Set(initialNorm))
      setExcludedPaths(new Set())
      dirCache.current.clear()
      fetchDirectory(startPath)
    }
  }, [isOpen, initialPath])

  if (!isOpen) return null

  const handleEnterFolder = (name: string) => {
    const newPath = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + name
    setCurrentPath(newPath)
    fetchDirectory(newPath)
  }

  const handleGoUp = () => {
    if (currentPath === '/' || !currentPath) return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    const parent = '/' + parts.join('/')
    setCurrentPath(parent)
    fetchDirectory(parent)
  }

  const handleToggleItem = (itemPath: string) => {
    const updated = togglePath(itemPath, selectedPaths, excludedPaths)
    setSelectedPaths(updated.selectedPaths)
    setExcludedPaths(updated.excludedPaths)
  }

  const handleToggleCurrentDir = () => {
    const updated = togglePath(currentPath, selectedPaths, excludedPaths)
    setSelectedPaths(updated.selectedPaths)
    setExcludedPaths(updated.excludedPaths)
  }

  const effectiveSelected = resolveEffectivePaths(selectedPaths, excludedPaths, dirCache.current)

  const handleConfirmSelected = () => {
    onSelect(effectiveSelected)
    onClose()
  }

  const handleSelectCurrentDir = () => {
    onSelect([normalizePath(currentPath)])
    onClose()
  }

  const currentDirState = getPathState(currentPath, selectedPaths, excludedPaths)
  const currentDirCheckedProp =
    currentDirState === 'checked'
      ? true
      : currentDirState === 'indeterminate'
      ? 'indeterminate'
      : false

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden transition-all dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('global.choose_or_input_path') || 'Select Path'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('shares.no_permission_tip') ? '浏览并勾选要分享的文件或文件夹' : 'Browse and pick files or folders to share'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Destination Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2 overflow-hidden flex-1 min-w-0">
            <button
              onClick={handleGoUp}
              disabled={currentPath === '/'}
              title="Go to parent directory"
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <SmartPath path={currentPath} className="text-xs font-mono font-semibold" />
            </div>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleToggleCurrentDir}
              className="flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 shrink-0 cursor-pointer"
            >
              <Checkbox
                checked={currentDirCheckedProp}
                onCheckedChange={handleToggleCurrentDir}
                className="pointer-events-none"
              />
              <span className="text-xs font-medium">
                {t('global.select_all') || t('shares.select_all') || '全选'}
              </span>
            </button>
          )}
        </div>

        {/* Directory Navigator Body */}
        <div className="flex-1 overflow-y-auto p-3 min-h-[260px] max-h-[380px] select-none">
          {loading ? (
            <div className="flex h-48 items-center justify-center space-x-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="text-xs">{t('global.loading') || 'Loading files...'}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center space-y-1 text-slate-400">
              <Folder className="h-9 w-9 text-slate-300 dark:text-slate-700 stroke-[1.5]" />
              <span className="text-xs font-medium">{t('global.empty') || 'Empty folder'}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => {
                const itemPath = normalizePath(
                  `${currentPath === '/' ? '' : currentPath}/${item.name}`
                )
                const state = getPathState(itemPath, selectedPaths, excludedPaths)
                const checkedProp =
                  state === 'checked' ? true : state === 'indeterminate' ? 'indeterminate' : false
                const isSelectedOrIndeterminate = state === 'checked' || state === 'indeterminate'

                return (
                  <div
                    key={item.name}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-colors ${
                      isSelectedOrIndeterminate
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {/* Checkbox & Item Info */}
                    <div
                      onClick={() => handleToggleItem(itemPath)}
                      className="flex items-center space-x-2.5 truncate flex-1 cursor-pointer pr-2"
                    >
                      <div className="shrink-0">
                        <Checkbox
                          checked={checkedProp}
                          onCheckedChange={() => handleToggleItem(itemPath)}
                          className="pointer-events-none"
                        />
                      </div>

                      {item.is_dir ? (
                        <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-slate-400 shrink-0" />
                      )}

                      <span className="truncate font-medium" title={item.name}>
                        {item.name}
                      </span>
                    </div>

                    {/* Right side: size or Enter folder button */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {!item.is_dir && item.size !== undefined && (
                        <span className="font-mono text-[11px] text-slate-400">
                          {getFileSize(item.size)}
                        </span>
                      )}

                      {item.is_dir && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEnterFolder(item.name)
                          }}
                          title="Enter folder"
                          className="flex items-center space-x-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                        >
                          <span>{t('shares.open_folder') || t('global.enter') || t('global.open') || '进入'}</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
          <button
            type="button"
            onClick={handleSelectCurrentDir}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <Check className="h-3.5 w-3.5 text-indigo-500" />
            <span>{t('shares.select_current_dir') || t('global.choose_folder') || '选择当前目录'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t('global.cancel') || 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleConfirmSelected}
              className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>
                {effectiveSelected.length > 0
                  ? `${t('global.confirm') || 'Confirm'} (${effectiveSelected.length})`
                  : t('global.confirm') || 'Confirm'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
