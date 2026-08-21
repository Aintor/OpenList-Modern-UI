import { create } from 'zustand'
import { getPublicSettings } from '~/utils/api'
import { applyThemeColor } from '~/utils/theme'

export type LayoutMode = 'grid' | 'list'
export type ThemeMode = 'light' | 'dark' | 'system'
export type PaginationType = 'all' | 'pagination' | 'load_more' | 'auto_load_more'

export interface PaginationConfig {
  type: PaginationType
  size: number
}

interface SettingsState {
  settings: Record<string, string>
  layout: LayoutMode
  theme: ThemeMode
  searchKeywords: string
  fetchSettings: () => Promise<void>
  getSetting: (key: string, defaultValue?: string) => string
  getSettingBool: (key: string, defaultValue?: boolean) => boolean
  getMainColor: () => string
  getPagination: () => PaginationConfig
  getLogoUrl: () => string
  setLayout: (layout: LayoutMode) => void
  setTheme: (theme: ThemeMode) => void
  setSearchKeywords: (keywords: string) => void
}

const applyTheme = (t: ThemeMode) => {
  const isDark =
    t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export const setDynamicFaviconAndIcons = (iconUrl: string, appleIconUrl?: string) => {
  if (!iconUrl) return

  // 1. Remove all old icon links from DOM to force browser to flush cache
  const existingLinks = document.querySelectorAll("link[rel*='icon'], link[rel*='apple-touch']")
  existingLinks.forEach((el) => el.parentNode?.removeChild(el))

  // 2. Append new clean rel="icon"
  const favLink = document.createElement('link')
  favLink.rel = 'icon'
  favLink.href = iconUrl
  document.head.appendChild(favLink)

  // 3. Append new clean rel="shortcut icon"
  const shortcutLink = document.createElement('link')
  shortcutLink.rel = 'shortcut icon'
  shortcutLink.href = iconUrl
  document.head.appendChild(shortcutLink)

  // 4. Append new clean rel="apple-touch-icon"
  const appleLink = document.createElement('link')
  appleLink.rel = 'apple-touch-icon'
  appleLink.href = appleIconUrl || iconUrl
  document.head.appendChild(appleLink)
}

const applyDocumentSettings = (settings: Record<string, string>) => {
  // 1. Set document title
  if (settings.site_title) {
    document.title = settings.site_title
  }

  // 2. Set Favicon & Apple Touch Icon
  const faviconUrl = settings.favicon || settings.logo || ''
  const appleIconUrl = settings.logo || settings.favicon || ''
  if (faviconUrl) {
    setDynamicFaviconAndIcons(faviconUrl, appleIconUrl)
  }

  // 3. Set dynamic theme color & derived immersive dark background tones
  applyThemeColor(settings.main_color)
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  // 1. Initialize theme
  const savedTheme = (localStorage.getItem('theme-mode') as ThemeMode) || 'light'
  const savedLayout = (localStorage.getItem('layout-mode') as LayoutMode) || 'grid'
  applyTheme(savedTheme)

  // 2. Restore cached settings immediately on script boot (Zero flash of unstyled icons)
  let initialSettings: Record<string, string> = {}
  try {
    const rawCached = localStorage.getItem('cached-public-settings')
    if (rawCached) {
      initialSettings = JSON.parse(rawCached)
      applyDocumentSettings(initialSettings)
    } else {
      applyThemeColor()
    }
  } catch (e) {
    applyThemeColor()
  }

  const store: SettingsState = {
    settings: initialSettings,
    layout: savedLayout,
    theme: savedTheme,
    searchKeywords: '',

    getSetting: (key: string, defaultValue = '') => {
      return get().settings[key] || defaultValue
    },

    getSettingBool: (key: string, defaultValue = false) => {
      const val = get().settings[key]
      if (val === undefined || val === '') return defaultValue
      return val === 'true' || val === '1'
    },

    getMainColor: () => {
      return get().settings['main_color'] || '#1890ff'
    },

    getPagination: () => {
      const type = (get().settings['pagination_type'] || 'all') as PaginationType
      const rawSize = get().settings['default_page_size'] || '30'
      const size = parseInt(rawSize, 10) || 30
      return { type, size }
    },

    getLogoUrl: () => {
      const rawLogo = get().settings['logo'] || get().settings['favicon'] || ''
      if (!rawLogo) return ''
      const logos = rawLogo.split('\n').map((s) => s.trim()).filter(Boolean)
      if (logos.length === 0) return ''
      const isDark = document.documentElement.classList.contains('dark')
      if (logos.length > 1 && isDark) {
        return logos[1]
      }
      return logos[0]
    },

    fetchSettings: async () => {
      try {
        const resp = await getPublicSettings()
        if (resp.code === 200 && resp.data) {
          set({ settings: resp.data })
          localStorage.setItem('cached-public-settings', JSON.stringify(resp.data))
          applyDocumentSettings(resp.data)
        }
      } catch (err) {
        console.error('Failed to fetch public settings:', err)
      }
    },

    setLayout: (layout: LayoutMode) => {
      localStorage.setItem('layout-mode', layout)
      set({ layout })
    },

    setTheme: (theme: ThemeMode) => {
      localStorage.setItem('theme-mode', theme)
      applyTheme(theme)
      set({ theme })
    },

    setSearchKeywords: (searchKeywords: string) => {
      set({ searchKeywords })
    },
  }

  // Automatically trigger fetchSettings immediately
  setTimeout(() => {
    store.fetchSettings()
  }, 0)

  return store
})
