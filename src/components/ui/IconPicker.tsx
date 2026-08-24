import React, { useState, useRef, useEffect } from 'react'
import { DynamicIcon, isValidLucideIcon } from './DynamicIcon'
import { ChevronDown, Check, FolderTree } from 'lucide-react'

// Curated list of clean, professional, high-utility icons for Drive / NAS / Shares
export const CURATED_ICONS = [
  // Storage & Hierarchy
  'folder-tree',
  'folder',
  'folder-git-2',
  'hard-drive',
  'server',
  'database',
  'cloud',
  'box',
  'boxes',
  'layers',
  'archive',
  'disc',
  'cpu',
  // Navigation & Home
  'home',
  'layout-grid',
  'compass',
  'globe',
  'sparkles',
  'star',
  'bookmark',
  'terminal',
  'shield',
  // Sharing & Links
  'share-2',
  'share',
  'send',
  'link',
  'link-2',
  'external-link',
  'download-cloud',
  'upload-cloud',
  'gift',
]

interface IconPickerProps {
  value: string
  defaultValue?: string
  onChange: (value: string) => void
  disabled?: boolean
}

export const IconPicker: React.FC<IconPickerProps> = ({
  value,
  defaultValue = 'folder-tree',
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Verify whether the read value is a valid Lucide icon (and not legacy emoji like 🏠 or arbitrary text)
  const isValueValid = isValidLucideIcon(value)
  const effectiveIcon = isValueValid ? value : defaultValue

  // If initial/read value is invalid or legacy emoji, normalize it to defaultValue
  useEffect(() => {
    if (value && !isValueValid) {
      onChange(defaultValue)
    }
  }, [value, isValueValid, defaultValue, onChange])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectIcon = (iconName: string) => {
    onChange(iconName)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Unified Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-10 w-full items-center justify-between space-x-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-800 shadow-xs transition-all hover:bg-slate-100/80 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:bg-slate-800/80 cursor-pointer select-none ${
          isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : ''
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400 shrink-0">
            <DynamicIcon name={effectiveIcon} fallback={FolderTree} className="h-3.5 w-3.5" />
          </div>
          <span className="font-mono text-xs text-slate-700 dark:text-slate-200 truncate">{effectiveIcon}</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Icon Selection Grid */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 animate-in fade-in zoom-in-95 duration-150">
          <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 max-h-52 overflow-y-auto p-1 scrollbar-thin">
            {CURATED_ICONS.map((iconName) => {
              const isSelected = effectiveIcon === iconName
              return (
                <button
                  key={iconName}
                  type="button"
                  title={iconName}
                  onClick={() => handleSelectIcon(iconName)}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <DynamicIcon name={iconName} fallback={FolderTree} className="h-4 w-4" />
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-indigo-600 shadow-xs dark:bg-slate-950 dark:text-indigo-400">
                      <Check className="h-2 w-2 stroke-[3]" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
