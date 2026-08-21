import React, { useRef, useEffect } from 'react'
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Sun,
  Moon,
  Globe,
  Settings,
  HardDrive,
  LogOut,
  FolderTree,
  Share2,
} from 'lucide-react'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useObjStore } from '~/store/useObjStore'
import { useUserStore } from '~/store/useUserStore'
import { useI18n, useT, languages, Locale } from '~/lang'
import { CustomSelect } from '~/components/ui/CustomSelect'

interface HeaderProps {
  onOpenLoginModal: () => void
  onToggleManage: () => void
  onOpenSearchModal: () => void
  isManageOpen: boolean
}

export const Header: React.FC<HeaderProps> = ({
  onOpenLoginModal,
  onToggleManage,
  onOpenSearchModal,
  isManageOpen,
}) => {
  const { theme, setTheme, layout, setLayout, getSetting, getLogoUrl } = useSettingsStore()
  const { currentPath, fetchPath } = useObjStore()
  const { user, logout } = useUserStore()
  const { locale, setLocale } = useI18n()
  const t = useT()

  const breadcrumbRef = useRef<HTMLDivElement>(null)

  // Dynamic backend site title and logo
  const siteTitle = getSetting('site_title') || 'Drive'
  const logoUrl = getLogoUrl()

  // Share route detection and breadcrumb parsing
  const isShare =
    currentPath.startsWith('/@s') ||
    currentPath.startsWith('/@share') ||
    window.location.pathname.startsWith('/@s') ||
    window.location.pathname.startsWith('/@share')
  const rawParts = currentPath.split('/').filter(Boolean)
  const sharePrefix = currentPath.startsWith('/@share') ? '/@share' : '/@s'
  const shareId = rawParts[1] || ''
  const shareRootPath = `${sharePrefix}/${shareId}`

  // For share routes, breadcrumbs start after the share ID
  const displayParts = isShare ? rawParts.slice(2) : rawParts

  const handleBreadcrumbClick = (index: number) => {
    let targetPath = '/'
    if (isShare) {
      if (index === -1) {
        targetPath = shareRootPath
      } else {
        targetPath = `${shareRootPath}/${displayParts.slice(0, index + 1).join('/')}`
      }
    } else {
      if (index === -1) {
        targetPath = '/'
      } else {
        targetPath = '/' + displayParts.slice(0, index + 1).join('/')
      }
    }
    window.history.pushState(null, '', encodeURI(targetPath))
    fetchPath(targetPath)
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  // Keyboard shortcut (Ctrl/Cmd + K) for spotlight global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenSearchModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenSearchModal])

  // Scroll breadcrumb to rightmost on path change
  useEffect(() => {
    if (breadcrumbRef.current) {
      breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth
    }
  }, [currentPath])

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 sm:px-6 backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-slate-950/80">
      {/* Left: Dynamic Logo & Overflow-Protected Breadcrumb Bar */}
      <div className="flex items-center space-x-3 overflow-hidden flex-1 min-w-0 pr-3">
        {/* Brand / Logo */}
        <div
          onClick={() => {
            if (isManageOpen) onToggleManage()
            const target = isShare ? shareRootPath : '/'
            window.history.pushState(null, '', target)
            fetchPath(target)
          }}
          className="flex cursor-pointer items-center space-x-2.5 rounded-xl p-1.5 transition-opacity hover:opacity-80 shrink-0"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={siteTitle} className="h-8 w-auto max-h-8 max-w-[160px] object-contain rounded-lg" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <HardDrive className="h-4 w-4" />
            </div>
          )}
        </div>

        {!isManageOpen && (
          <>
            <div className="hidden h-5 w-px bg-slate-200 dark:bg-slate-800 md:block shrink-0" />

            {/* Dynamic Breadcrumbs with Overflow Protection and Auto-Scroll */}
            <nav
              ref={breadcrumbRef}
              aria-label="Breadcrumb"
              className="scrollbar-none hidden md:flex items-center space-x-1.5 text-xs font-medium overflow-x-auto whitespace-nowrap py-1 flex-1 min-w-0"
            >
              <button
                onClick={() => handleBreadcrumbClick(-1)}
                className={`flex items-center space-x-1 rounded-lg px-2 py-1 transition-colors shrink-0 ${
                  displayParts.length === 0
                    ? 'font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                {isShare ? (
                  <>
                    <Share2 className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('manage.sidemenu.shares') || 'Shares'}</span>
                  </>
                ) : (
                  <>
                    <FolderTree className="h-3.5 w-3.5" />
                    <span>{t('global.root') || 'Root'}</span>
                  </>
                )}
              </button>

              {displayParts.map((part, idx) => {
                const isLast = idx === displayParts.length - 1
                const decodedName = decodeURIComponent(part)
                return (
                  <React.Fragment key={idx}>
                    <span className="text-slate-300 dark:text-slate-600 shrink-0">/</span>
                    <button
                      onClick={() => handleBreadcrumbClick(idx)}
                      title={decodedName}
                      className={`max-w-[140px] lg:max-w-[200px] truncate rounded-lg px-2 py-1 transition-colors shrink-0 ${
                        isLast
                          ? 'font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                      }`}
                    >
                      {decodedName}
                    </button>
                  </React.Fragment>
                )
              })}
            </nav>
          </>
        )}
      </div>

      {/* Right Controls: Spotlight Search, View Switcher, Theme, Language, Manage, User */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Spotlight Command Palette Global Search Trigger */}
        {!isManageOpen && (
          <button
            onClick={onOpenSearchModal}
            title={`${t('home.search.search') || 'Search'} (⌘K)`}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline text-slate-400 font-mono text-[10px]">⌘K</span>
          </button>
        )}

        {/* Layout Switcher (Grid / List) */}
        {!isManageOpen && (
          <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setLayout('grid')}
              title={t('home.layouts.grid') || 'Grid View'}
              className={`rounded-lg p-1.5 transition-all ${
                layout === 'grid'
                  ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayout('list')}
              title={t('home.layouts.list') || 'List View'}
              className={`rounded-lg p-1.5 transition-all ${
                layout === 'list'
                  ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Theme Toggle Button (Dark / Light) */}
        <button
          onClick={toggleTheme}
          title={t('home.toolbar.toggle_theme') || 'Toggle theme'}
          className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
        </button>

        {/* Language Selector Dropdown */}
        <CustomSelect
          value={locale}
          onChange={(val) => setLocale(val as Locale)}
          options={languages.map((l) => ({ value: l.code, label: l.name }))}
          icon={<Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />}
          align="end"
          triggerClassName="h-8 text-xs font-semibold px-2.5 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
        />

        {/* Manage Admin Navigation Button (Hidden on Share Pages) */}
        {!isShare && (
          <button
            onClick={onToggleManage}
            title={t('home.footer.manage') || 'Management'}
            className={`flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs transition-all cursor-pointer ${
              isManageOpen
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-indigo-500/20'
                : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{t('home.footer.manage') || 'Manage'}</span>
          </button>
        )}

        {/* User Logout Button / Login Button (Hidden on Share Pages) */}
        {!isShare && (
          user ? (
            <button
              onClick={logout}
              title={t('home.toolbar.logout') || 'Logout'}
              className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 shadow-xs hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 dark:hover:border-rose-900/50 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
            >
              {t('login.login') || 'Sign In'}
            </button>
          )
        )}
      </div>
    </header>
  )
}
