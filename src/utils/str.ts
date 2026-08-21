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
