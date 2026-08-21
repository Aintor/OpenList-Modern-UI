import { create } from 'zustand'
import { dict as zhCN } from './zh-CN/entry'
import { dict as zhTW } from './zh-TW/entry'
import { dict as en } from './en/entry'

export type Locale = 'zh-CN' | 'zh-TW' | 'en'

// Pre-flatten dictionary into a flat O(1) key-value hash map at module load
function flatten(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') {
      result[fullKey] = v
    } else if (typeof v === 'object' && v !== null) {
      Object.assign(result, flatten(v, fullKey))
    }
  }
  return result
}

const flatDictionaries: Record<Locale, Record<string, string>> = {
  'zh-CN': flatten(zhCN),
  'zh-TW': flatten(zhTW),
  en: flatten(en),
}

export const languages: { code: Locale; name: string }[] = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
]

export const hasTranslation = (locale: Locale, key: string): boolean => {
  const dict = flatDictionaries[locale] || flatDictionaries['zh-CN']
  const fallbackDict = flatDictionaries['zh-CN']
  return dict[key] !== undefined || fallbackDict[key] !== undefined
}

export const translate = (locale: Locale, key: string, vars?: Record<string, string | number>): string => {
  const dict = flatDictionaries[locale] || flatDictionaries['zh-CN']
  const fallbackDict = flatDictionaries['zh-CN']
  let text = dict[key] ?? fallbackDict[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{{${k}}}`, String(v)).replace(`{${k}}`, String(v))
    }
  }
  return text
}

/**
 * Automatically detect browser preferred language
 */
export function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined' || !window.navigator) {
    return 'zh-CN'
  }

  const candidates =
    window.navigator.languages && window.navigator.languages.length > 0
      ? window.navigator.languages
      : [window.navigator.language || '']

  for (const raw of candidates) {
    if (!raw) continue
    const lang = raw.toLowerCase()
    // Traditional Chinese (Taiwan, Hong Kong, Macau, Hant script)
    if (
      lang.includes('zh-tw') ||
      lang.includes('zh-hk') ||
      lang.includes('zh-mo') ||
      lang.includes('hant')
    ) {
      return 'zh-TW'
    }
    // Simplified Chinese (China Mainland, Singapore, Hans script)
    if (lang.startsWith('zh')) {
      return 'zh-CN'
    }
    // English
    if (lang.startsWith('en')) {
      return 'en'
    }
  }

  // Non-Chinese browsers default to English
  return 'en'
}

interface I18nState {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

export const useI18n = create<I18nState>((set, get) => {
  const savedLocale = (localStorage.getItem('openlist-lang') as Locale) || detectBrowserLocale()

  return {
    locale: savedLocale,
    setLocale: (locale: Locale) => {
      localStorage.setItem('openlist-lang', locale)
      set({ locale })
    },
    t: (key: string, vars?: Record<string, string | number>) => {
      return translate(get().locale, key, vars)
    },
  }
})

export type TFunction = {
  (key: string, vars?: Record<string, string | number>): string
  has: (key: string) => boolean
}

export const useT = (): TFunction => {
  const locale = useI18n((s) => s.locale)
  const t = ((key: string, vars?: Record<string, string | number>): string => {
    return translate(locale, key, vars)
  }) as TFunction

  t.has = (key: string): boolean => hasTranslation(locale, key)

  return t
}
