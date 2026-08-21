import { Obj } from '~/types'
import { notify } from './notify'

/**
 * Standardize path string
 */
export const standardizePath = (path: string): string => {
  if (!path.startsWith('/')) {
    path = '/' + path
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  return path
}

/**
 * Encode path preserving forward slashes
 */
export const encodePath = (path: string): string => {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/**
 * Dynamically resolve the direct download URL for any OpenList file object.
 * 
 * Hierarchy:
 * 1. If obj.raw_url is provided (e.g. from fs/get), use it.
 * 2. If in Share mode (/@s or /@share), build /sd/${path}
 * 3. Otherwise build /d/${path}?sign=${sign} (or /p/... for proxy)
 */
export const getDownloadUrl = (
  obj: Obj,
  currentPath: string = '/',
  type: 'direct' | 'proxy' = 'direct',
  isDownload: boolean = false
): string => {
  if (obj.raw_url) {
    if (isDownload) {
      const separator = obj.raw_url.includes('?') ? '&' : '?'
      return `${obj.raw_url}${separator}download`
    }
    return obj.raw_url
  }

  let dir = currentPath || '/'
  const isShare = dir.startsWith('/@s') || dir.startsWith('/@share')

  if (isShare) {
    dir = dir.replace(/^\/@(s|share)/, '')
  }

  dir = standardizePath(dir)
  const fullPath = dir === '/' ? `/${obj.name}` : `${dir}/${obj.name}`
  const encoded = encodePath(fullPath)

  const prefix = isShare ? '/sd' : type === 'direct' ? '/d' : '/p'
  let url = `${window.location.origin}${prefix}${encoded}`

  const params: string[] = []
  if (!isShare && obj.sign) {
    params.push(`sign=${encodeURIComponent(obj.sign)}`)
  }
  if (isDownload) {
    params.push('download')
  }

  if (params.length > 0) {
    url += `?${params.join('&')}`
  }

  return url
}

/**
 * Copy file direct download link to user clipboard
 */
export const copyDirectLink = async (
  obj: Obj,
  currentPath: string = '/',
  t?: (key: string) => string
): Promise<boolean> => {
  try {
    const url = getDownloadUrl(obj, currentPath)
    await navigator.clipboard.writeText(url)
    notify.success(t?.('global.copied') || 'Download link copied to clipboard')
    return true
  } catch (err: any) {
    notify.error(err.message || 'Failed to copy link')
    return false
  }
}
