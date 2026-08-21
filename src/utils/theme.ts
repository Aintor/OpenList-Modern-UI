/**
 * Convert HEX color string to HSL
 */
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  let clean = (hex || '#1890ff').replace('#', '').trim()
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('')
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return { h: 209, s: 100, l: 55 } // default #1890ff
  }

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/**
 * Dynamically apply main theme color & derive immersive dark background tones
 */
export function applyThemeColor(hexColor?: string) {
  const root = document.documentElement
  const windowConfigColor = (window as any)?.OPENLIST_CONFIG?.main_color
  const hex = (hexColor && hexColor.trim()) || windowConfigColor || '#1890ff'
  const { h, s, l } = hexToHSL(hex)

  // 1. Primary Full Scale Palette (50 - 950)
  root.style.setProperty('--primary-50', `hsl(${h}, ${Math.min(s, 95)}%, 97%)`)
  root.style.setProperty('--primary-100', `hsl(${h}, ${Math.min(s, 90)}%, 93%)`)
  root.style.setProperty('--primary-200', `hsl(${h}, ${Math.min(s, 90)}%, 86%)`)
  root.style.setProperty('--primary-300', `hsl(${h}, ${Math.min(s, 90)}%, 74%)`)
  root.style.setProperty('--primary-400', `hsl(${h}, ${Math.min(s, 90)}%, 62%)`)
  root.style.setProperty('--primary-500', hex)
  root.style.setProperty('--primary-600', `hsl(${h}, ${s}%, ${Math.max(15, l - 4)}%)`)
  root.style.setProperty('--primary-700', `hsl(${h}, ${s}%, ${Math.max(12, l - 12)}%)`)
  root.style.setProperty('--primary-800', `hsl(${h}, ${s}%, ${Math.max(10, l - 20)}%)`)
  root.style.setProperty('--primary-900', `hsl(${h}, ${Math.min(s, 60)}%, 18%)`)
  root.style.setProperty('--primary-950', `hsl(${h}, ${Math.min(s, 50)}%, 10%)`)

  root.style.setProperty('--primary', hex)
  root.style.setProperty('--primary-hover', `hsl(${h}, ${s}%, ${Math.max(15, l - 8)}%)`)
  root.style.setProperty('--primary-active', `hsl(${h}, ${s}%, ${Math.max(10, l - 14)}%)`)
  root.style.setProperty('--primary-subtle', `hsla(${h}, ${s}%, ${l}%, 0.12)`)
  root.style.setProperty('--primary-subtle-hover', `hsla(${h}, ${s}%, ${l}%, 0.2)`)
  root.style.setProperty('--primary-ring', `hsla(${h}, ${s}%, ${l}%, 0.25)`)
  root.style.setProperty('--selection-area-bg', `hsla(${h}, ${s}%, ${l}%, 0.15)`)
  root.style.setProperty('--selection-area-border', `hsla(${h}, ${s}%, ${l}%, 0.7)`)

  // 2. Light Theme Surfaces (Clean with subtle primary tint)
  root.style.setProperty('--bg-light-base', `hsl(${h}, 15%, 98%)`)
  root.style.setProperty('--bg-light-surface', '#ffffff')
  root.style.setProperty('--bg-light-elevated', `hsl(${h}, 10%, 95%)`)
  root.style.setProperty('--border-light', `hsl(${h}, 10%, 90%)`)

  // 3. Dark Theme Surfaces (Deep, OLED-rich with primary hue infusion)
  root.style.setProperty('--bg-dark-base', `hsl(${h}, 22%, 4%)`)       // e.g. deep dark tone matching main color
  root.style.setProperty('--bg-dark-surface', `hsl(${h}, 18%, 8%)`)    // cards & dialogs
  root.style.setProperty('--bg-dark-elevated', `hsl(${h}, 15%, 13%)`)  // headers, hover rows
  root.style.setProperty('--border-dark', `hsl(${h}, 14%, 18%)`)       // borders
}
