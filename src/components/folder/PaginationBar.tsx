import React, { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Loader2, ArrowDown } from 'lucide-react'
import { useObjStore } from '~/store/useObjStore'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useT } from '~/lang'

export const PaginationBar: React.FC = () => {
  const { objs, total, page, pageSize, loading, loadingMore, loadMore, goToPage } = useObjStore()
  const { getPagination } = useSettingsStore()
  const t = useT()
  const sentinelRef = useRef<HTMLDivElement>(null)

  const pagination = getPagination()
  const isAllLoaded = objs.length >= total && total > 0
  const totalPages = Math.max(1, Math.ceil(total / (pageSize || 30)))

  // Auto Load More using IntersectionObserver
  useEffect(() => {
    if (pagination.type !== 'auto_load_more') return
    if (isAllLoaded || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isAllLoaded && !loading && !loadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )

    const el = sentinelRef.current
    if (el) {
      observer.observe(el)
    }

    return () => {
      if (el) {
        observer.unobserve(el)
      }
      observer.disconnect()
    }
  }, [pagination.type, isAllLoaded, loading, loadingMore, loadMore])

  // If "all" mode or no items, no pagination UI needed
  if (pagination.type === 'all' || objs.length === 0) {
    return null
  }

  // 1. Classic Pagination Controls
  if (pagination.type === 'pagination') {
    if (totalPages <= 1) return null

    // Generate page numbers with smart ellipsis
    const getPageNumbers = () => {
      const delta = 2
      const range: (number | string)[] = []
      const left = Math.max(2, page - delta)
      const right = Math.min(totalPages - 1, page + delta)

      range.push(1)
      if (left > 2) range.push('...')
      for (let i = left; i <= right; i++) {
        range.push(i)
      }
      if (right < totalPages - 1) range.push('...')
      if (totalPages > 1) range.push(totalPages)

      return range
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-8 px-4 border-t border-slate-100 dark:border-slate-800/80">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span>{t('home.toolbar.offline_download_enhanced.files_count') ? `共 ${total} 项` : `Total ${total} items`}</span>
          <span className="mx-2 text-slate-300 dark:text-slate-700">·</span>
          <span>{t('home.toolbar.page') || 'Page'} {page} / {totalPages}</span>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Previous Page */}
          <button
            onClick={() => goToPage(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            aria-label="Previous Page"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer shadow-xs transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Page Number Buttons */}
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-400">
                  ...
                </span>
              )
            }
            const pageNum = Number(p)
            const isActive = pageNum === page
            return (
              <button
                key={`page-${pageNum}`}
                onClick={() => goToPage(pageNum)}
                disabled={loading}
                className={`flex h-8 min-w-[32px] px-2 items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {pageNum}
              </button>
            )
          })}

          {/* Next Page */}
          <button
            onClick={() => goToPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
            aria-label="Next Page"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer shadow-xs transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // 2. Click to Load More Button
  if (pagination.type === 'load_more') {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        {!isAllLoaded ? (
          <button
            onClick={loadMore}
            disabled={loadingMore || loading}
            className="flex items-center space-x-2 rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            ) : (
              <ArrowDown className="h-4 w-4 text-indigo-500" />
            )}
            <span>
              {loadingMore
                ? (t('global.loading') || 'Loading...')
                : `${t('home.load_more') || '加载更多'} (${objs.length}/${total})`}
            </span>
          </button>
        ) : (
          <p className="text-xs italic text-slate-400 dark:text-slate-500">
            {t('home.no_more') || `已加载全部 ${total} 项`}
          </p>
        )}
      </div>
    )
  }

  // 3. Auto Load More on Scroll (Infinite Scroll)
  if (pagination.type === 'auto_load_more') {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <div ref={sentinelRef} className="h-4 w-full" />
        {loadingMore && (
          <div className="flex items-center space-x-2 py-3 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span>{t('global.loading') || 'Loading more...'}</span>
          </div>
        )}
        {isAllLoaded && total > (pageSize || 30) && (
          <p className="text-xs italic text-slate-400 dark:text-slate-500 py-2">
            {t('home.no_more') || `已加载全部 ${total} 项`}
          </p>
        )}
      </div>
    )
  }

  return null
}
