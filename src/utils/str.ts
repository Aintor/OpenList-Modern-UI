export const firstUpperCase = (str: string) => {
  if (!str || str.length === 0) {
    return ""
  }
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const trimLeft = (str: string, sub: string) => {
  return str.startsWith(sub) ? str.slice(sub.length) : str
}

export function getFileSize(size: number) {
  if (size === undefined || size === null || isNaN(size) || size < 0) return "-"
  if (size === 0) return "0 B"

  const num = 1024.0

  if (size < num) return size + " B"
  if (size < Math.pow(num, 2)) return (size / num).toFixed(2) + " KB"
  if (size < Math.pow(num, 3)) return (size / Math.pow(num, 2)).toFixed(2) + " MB"
  if (size < Math.pow(num, 4)) return (size / Math.pow(num, 3)).toFixed(2) + " GB"
  return (size / Math.pow(num, 4)).toFixed(2) + " TB"
}

const full = (p: number) => {
  return p < 10 ? "0" + p : p.toString()
}

export function formatDate(dateStr: string) {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr

  const year = date.getFullYear()
  const mon = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const min = date.getMinutes()
  const sec = date.getSeconds()

  return (
    year +
    "-" +
    full(mon) +
    "-" +
    full(day) +
    " " +
    full(hour) +
    ":" +
    full(min) +
    ":" +
    full(sec)
  )
}

export const validateFilename = (
  name: string,
): { valid: boolean; error?: string } => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "empty_input" }
  }
  const INVALID_CHARS = /[\/\\?<>*:|"]/
  if (INVALID_CHARS.test(name)) {
    return { valid: false, error: "invalid_filename_chars" }
  }

  return { valid: true }
}

/**
 * Smartly formats a directory path with maximum visibility.
 * Greedily displays as many directory levels as possible within maxTotalLen,
 * retaining the root level and maximum trailing subfolders with a compact middle ellipsis.
 */
export function formatSmartPath(path: string, maxTotalLen = 46): string {
  if (!path || path === '/') return '/'

  const isAbsolute = path.startsWith('/')
  const parts = path.split('/').filter(Boolean)

  // 1. If entire path fits, show it in full
  const fullFormatted = isAbsolute ? `/${parts.join('/')}` : parts.join('/')
  if (fullFormatted.length <= maxTotalLen) {
    return fullFormatted
  }

  // 2. If only one segment
  if (parts.length <= 1) {
    const name = parts[0] || ''
    if (name.length > maxTotalLen) {
      const half = Math.max(3, Math.floor((maxTotalLen - 5) / 2))
      const truncated = `${name.slice(0, half)}...${name.slice(-half)}`
      return isAbsolute ? `/${truncated}` : truncated
    }
    return fullFormatted
  }

  // 3. Greedily pack as many trailing segments as possible
  const first = parts[0]
  const trailing: string[] = []

  for (let i = parts.length - 1; i >= 1; i--) {
    const candidateTrailing = [parts[i], ...trailing]
    const prefix = isAbsolute ? `/${first}/.../` : `${first}/.../`
    const candidate = `${prefix}${candidateTrailing.join('/')}`

    if (candidate.length <= maxTotalLen) {
      trailing.unshift(parts[i])
    } else {
      break
    }
  }

  if (trailing.length > 0) {
    const prefix = isAbsolute ? `/${first}/.../` : `${first}/.../`
    return `${prefix}${trailing.join('/')}`
  }

  // 4. Fallback if even root + last segment is too long
  const last = parts[parts.length - 1]
  const fallback = isAbsolute ? `/.../${last}` : `.../${last}`
  if (fallback.length <= maxTotalLen) {
    return fallback
  }

  const half = Math.max(3, Math.floor((maxTotalLen - 7) / 2))
  const truncatedLast = `${last.slice(0, half)}...${last.slice(-half)}`
  return isAbsolute ? `/.../${truncatedLast}` : `.../${truncatedLast}`
}
