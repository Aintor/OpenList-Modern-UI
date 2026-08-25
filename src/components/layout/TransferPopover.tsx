import React, { useRef, useEffect, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { useTransferStore } from '~/store/useTransferStore'
import { useT } from '~/lang'
import { Tooltip } from '~/components/ui/Tooltip'
import { TransferPanel } from '~/components/transfer/TransferPanel'
import { Drawer, DrawerContent } from '~/components/ui/drawer'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mediaQuery.matches)

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}

export const TransferPopover: React.FC = () => {
  const t = useT()
  const { tasks, isOpen, setOpen } = useTransferStore()
  const isMobile = useIsMobile(768)
  const containerRef = useRef<HTMLDivElement>(null)

  // Click outside to close desktop popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!isMobile) {
          setOpen(false)
        }
      }
    }
    if (isOpen && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, isMobile, setOpen])

  const activeCount = tasks.filter(
    (t) =>
      t.status === 'uploading' ||
      t.status === 'downloading' ||
      t.status === 'processing' ||
      t.status === 'hashing' ||
      t.status === 'backending'
  ).length

  return (
    <div className="relative" ref={containerRef}>
      {/* Permanent Header Trigger Button */}
      <Tooltip content={t('home.transfer.title') || '传输列表'} side="bottom">
        <button
          onClick={() => setOpen(!isOpen)}
          className={`relative flex items-center justify-center rounded-xl border p-2 shadow-xs transition-all cursor-pointer ${
            isOpen
              ? 'border-indigo-600 bg-indigo-50 text-indigo-600 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-400'
              : activeCount > 0
              ? 'border-indigo-300 bg-indigo-50/50 text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400'
              : 'border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <ArrowUpDown className="h-4 w-4" />

          {/* Active Tasks Pulsing Badge */}
          {activeCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 font-mono text-[9px] font-bold text-white shadow-xs">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60"></span>
              <span className="relative">{activeCount}</span>
            </span>
          ) : tasks.filter((t) => t.status === 'paused').length > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 rounded-full bg-amber-500"></span>
          ) : null}
        </button>
      </Tooltip>

      {/* 1. Desktop Popover Dropdown Card (>= 768px) */}
      {!isMobile && isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[400px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xl shadow-black/15 backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-900/95 animate-in fade-in zoom-in-95 duration-150 select-none">
          <TransferPanel isMobile={false} onClose={() => setOpen(false)} />
        </div>
      )}

      {/* 2. Mobile shadcn Drawer (< 768px) with native gesture physics */}
      {isMobile && (
        <Drawer open={isOpen} onOpenChange={setOpen}>
          <DrawerContent className="p-4 select-none">
            <TransferPanel isMobile={true} onClose={() => setOpen(false)} />
          </DrawerContent>
        </Drawer>
      )}
    </div>
  )
}
