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
  Menu,
  User as UserIcon,
  Check,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useObjStore } from '~/store/useObjStore'
import { useUserStore } from '~/store/useUserStore'
import { useI18n, useT, languages, Locale } from '~/lang'
import { CustomSelect } from '~/components/ui/CustomSelect'
import { Tooltip } from '~/components/ui/Tooltip'
import { DynamicIcon } from '~/components/ui/DynamicIcon'
import { UserMethods } from '~/types'

import { TransferPopover } from '~/components/layout/TransferPopover'

interface HeaderProps {
  onGoToLogin: () => void
  onToggleManage: () => void
  onOpenSearchModal: () => void
  isManageOpen: boolean
}

export const Header: React.FC<HeaderProps> = ({
  onGoToLogin,
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
  const mobileBreadcrumbRef = useRef<HTMLDivElement>(null)

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

  // Scroll both desktop and mobile breadcrumbs to rightmost on path change
  useEffect(() => {
    if (breadcrumbRef.current) {
      breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth
    }
    if (mobileBreadcrumbRef.current) {
      mobileBreadcrumbRef.current.scrollLeft = mobileBreadcrumbRef.current.scrollWidth
    }
  }, [currentPath])

  const isGuest = UserMethods.is_guest(user)

  return (
    <header className="sticky top-0 z-30 flex flex-col w-full border-b border-slate-200/70 bg-white/95 dark:border-slate-800/70 dark:bg-slate-950/95 backdrop-blur-xl transition-colors select-none">
      {/* Tier 1: Main Header Bar (Logo & Action Controls) */}
      <div className="flex h-13 sm:h-16 w-full items-center justify-between px-3.5 sm:px-6">
        {/* Left: Dynamic Logo & Desktop-Only Inline Breadcrumb Bar */}
        <div className="flex items-center space-x-3 overflow-hidden flex-1 min-w-0 pr-3">
          {/* Brand / Logo */}
          <div
            onClick={() => {
              if (isManageOpen) onToggleManage()
              const target = isShare ? shareRootPath : '/'
              window.history.pushState(null, '', target)
              fetchPath(target)
            }}
            className="flex cursor-pointer items-center space-x-2.5 rounded-xl p-1 transition-opacity hover:opacity-80 shrink-0"
          >
            {logoUrl ? (
              <img src={logoUrl} alt={siteTitle} className="h-7 sm:h-8 w-auto max-h-8 max-w-[150px] object-contain rounded-lg" />
            ) : (
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <HardDrive className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Desktop Inline Breadcrumb Bar (>= 768px) */}
          {!isManageOpen && (
            <>
              <div className="hidden md:block h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

              <nav
                ref={breadcrumbRef}
                aria-label="Desktop Breadcrumb"
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
                      <DynamicIcon
                        name={getSetting('share_icon') || 'share-2'}
                        fallback={Share2}
                        className="h-3.5 w-3.5 text-indigo-500"
                      />
                      <span>{t('manage.sidemenu.shares') || 'Shares'}</span>
                    </>
                  ) : (
                    <>
                      <DynamicIcon
                        name={getSetting('home_icon') || 'folder-tree'}
                        fallback={FolderTree}
                        className="h-3.5 w-3.5"
                      />
                      <span>{t('global.root') || 'Root'}</span>
                    </>
                  )}
                </button>

                {displayParts.map((part, idx) => {
                  const isLast = idx === displayParts.length - 1
                  let decodedName = part
                  try {
                    decodedName = decodeURIComponent(part)
                  } catch {
                    decodedName = part
                  }
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

        {/* Right Controls: Search, View Switcher, Transfer, Desktop Expansion & Mobile Overflow Menu */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Spotlight Command Palette Global Search Trigger */}
          {!isManageOpen && (
            <Tooltip content={`${t('home.search.search') || 'Search'} (⌘K)`} side="bottom">
              <button
                onClick={onOpenSearchModal}
                className="flex items-center space-x-1.5 rounded-xl border border-slate-200/80 bg-white px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline text-slate-400 font-mono text-[10px]">⌘K</span>
              </button>
            </Tooltip>
          )}

          {/* Layout Switcher (Grid / List) */}
          {!isManageOpen && (
            <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-900">
              <Tooltip content={t('home.layouts.grid') || 'Grid View'} side="bottom">
                <button
                  onClick={() => setLayout('grid')}
                  className={`rounded-lg p-1.5 transition-all ${
                    layout === 'grid'
                      ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-indigo-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content={t('home.layouts.list') || 'List View'} side="bottom">
                <button
                  onClick={() => setLayout('list')}
                  className={`rounded-lg p-1.5 transition-all ${
                    layout === 'list'
                      ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-indigo-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <ListIcon className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          )}

          {/* Permanent Transfer Popover / Drawer */}
          {!isShare && <TransferPopover />}

          {/* 1. Desktop Expanded Controls (>= md / 768px) */}
          <div className="hidden md:flex items-center space-x-2">
            {/* Theme Toggle Button (Dark / Light) */}
            <Tooltip content={t('home.toolbar.toggle_theme') || 'Toggle theme'} side="bottom">
              <button
                onClick={toggleTheme}
                className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
              </button>
            </Tooltip>

            {/* Language Selector Dropdown */}
            <CustomSelect
              value={locale}
              onChange={(val) => setLocale(val as Locale)}
              options={languages.map((l) => ({ value: l.code, label: l.name }))}
              icon={<Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />}
              align="end"
              triggerClassName="h-8 text-xs font-semibold px-2.5 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            />

            {/* Manage Admin Navigation Button (Only shown for non-guest authenticated users) */}
            {!isShare && !isGuest && (
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

            {/* User Login (for Guest) or Logout Button (for authenticated users) */}
            {!isShare && (
              isGuest ? (
                <button
                  onClick={onGoToLogin}
                  className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
                >
                  {t('login.login') || 'Sign In'}
                </button>
              ) : (
                <Tooltip content={t('global.logout') || 'Logout'} side="bottom">
                  <button
                    onClick={logout}
                    className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-600 shadow-xs hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 dark:hover:border-rose-900/50 transition-all cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </Tooltip>
              )
            )}
          </div>

          {/* 2. Mobile Compact Profile & Settings Dropdown Menu (< md / 768px) */}
          <div className="flex md:hidden items-center">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-xl border border-slate-200/80 bg-white p-2 text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[200px] rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95 animate-in fade-in zoom-in-95 select-none"
                >
                  {/* User Header Info */}
                  {!isGuest && user && (
                    <div className="flex items-center space-x-2.5 px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs shadow-xs">
                        {user.username.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                          {user.username}
                        </p>
                        <p className="text-[10px] text-indigo-500 font-semibold">
                          {user.role === 2 ? (t('global.admin') || '管理员') : (t('global.user') || '普通用户')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Manage Admin Entry */}
                  {!isShare && !isGuest && (
                    <DropdownMenu.Item
                      onSelect={onToggleManage}
                      className="flex cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/80 outline-none"
                    >
                      <Settings className="h-4 w-4 text-indigo-500" />
                      <span>{t('home.footer.manage') || '管理'}</span>
                    </DropdownMenu.Item>
                  )}

                  {/* Theme Toggle Item */}
                  <DropdownMenu.Item
                    onSelect={toggleTheme}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/80 outline-none"
                  >
                    <div className="flex items-center space-x-2">
                      {theme === 'dark' ? (
                        <Sun className="h-4 w-4 text-amber-400" />
                      ) : (
                        <Moon className="h-4 w-4 text-slate-600" />
                      )}
                      <span>{t('home.toolbar.toggle_theme') || '切换主题'}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {theme === 'dark' ? (t('global.theme_dark') || '深色') : (t('global.theme_light') || '浅色')}
                    </span>
                  </DropdownMenu.Item>

                  {/* Language Switcher Submenu */}
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/80 outline-none">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-slate-500" />
                        <span>{t('global.language') || '语言'}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{languages.find((l) => l.code === locale)?.name}</span>
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.SubContent
                        sideOffset={6}
                        className="z-50 min-w-[140px] rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95"
                      >
                        {languages.map((l) => (
                          <DropdownMenu.Item
                            key={l.code}
                            onSelect={() => setLocale(l.code)}
                            className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 outline-none"
                          >
                            <span>{l.name}</span>
                            {locale === l.code && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Sub>

                  <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />

                  {/* Login or Logout */}
                  {isGuest ? (
                    <DropdownMenu.Item
                      onSelect={onGoToLogin}
                      className="flex cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 outline-none"
                    >
                      <UserIcon className="h-4 w-4" />
                      <span>{t('login.login') || 'Sign In'}</span>
                    </DropdownMenu.Item>
                  ) : (
                    <DropdownMenu.Item
                      onSelect={logout}
                      className="flex cursor-pointer items-center space-x-2 rounded-xl px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 outline-none"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t('global.logout') || '退出登录'}</span>
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </div>

      {/* Tier 2: Dedicated Full-Width Mobile Breadcrumb Path Bar (< md / 768px) */}
      {!isManageOpen && (
        <div className="flex md:hidden w-full items-center px-3.5 pb-2 pt-0 select-none overflow-hidden">
          <nav
            ref={mobileBreadcrumbRef}
            aria-label="Mobile Breadcrumb"
            className="scrollbar-none flex items-center space-x-1.5 text-xs font-medium overflow-x-auto whitespace-nowrap py-0.5 w-full min-w-0 touch-pan-x"
          >
            <button
              onClick={() => handleBreadcrumbClick(-1)}
              className={`flex items-center space-x-1 rounded-lg px-2 py-1 transition-colors shrink-0 ${
                displayParts.length === 0
                  ? 'font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              {isShare ? (
                <>
                  <DynamicIcon
                    name={getSetting('share_icon') || 'share-2'}
                    fallback={Share2}
                    className="h-3.5 w-3.5 text-indigo-500"
                  />
                  <span>{t('manage.sidemenu.shares') || 'Shares'}</span>
                </>
              ) : (
                <>
                  <DynamicIcon
                    name={getSetting('home_icon') || 'folder-tree'}
                    fallback={FolderTree}
                    className="h-3.5 w-3.5"
                  />
                  <span>{t('global.root') || 'Root'}</span>
                </>
              )}
            </button>

            {displayParts.map((part, idx) => {
              const isLast = idx === displayParts.length - 1
              let decodedName = part
              try {
                decodedName = decodeURIComponent(part)
              } catch {
                decodedName = part
              }
              return (
                <React.Fragment key={idx}>
                  <span className="text-slate-300 dark:text-slate-600 shrink-0">/</span>
                  <button
                    onClick={() => handleBreadcrumbClick(idx)}
                    title={decodedName}
                    className={`max-w-[160px] truncate rounded-lg px-2 py-1 transition-colors shrink-0 ${
                      isLast
                        ? 'font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                    }`}
                  >
                    {decodedName}
                  </button>
                </React.Fragment>
              )
            })}
          </nav>
        </div>
      )}
    </header>
  )
}
