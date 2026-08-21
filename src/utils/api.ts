import axios, { CancelToken } from 'axios'
import {
  PEmptyResp,
  FsGetResp,
  FsListResp,
  Obj,
  PResp,
  FsSearchResp,
  RenameObj,
  User,
  ArchiveList,
  ArchiveMeta,
} from '~/types'
import { r } from './request'

// ========== File System API ==========

export const fsGet = (
  path: string = '/',
  password = '',
  cancelToken?: CancelToken
): Promise<FsGetResp> => {
  return r.post(
    '/fs/get',
    {
      path,
      password,
    },
    {
      cancelToken,
    }
  )
}

export const fsList = (
  path: string = '/',
  password = '',
  page = 1,
  per_page = 0,
  refresh = false,
  cancelToken?: CancelToken
): Promise<FsListResp> => {
  return r.post(
    '/fs/list',
    {
      path,
      password,
      page,
      per_page,
      refresh,
    },
    {
      cancelToken,
    }
  )
}

export const fsDirs = (
  path = '/',
  password = '',
  forceRoot = false
): PResp<Obj[]> => {
  return r.post('/fs/dirs', { path, password, force_root: forceRoot })
}

export const fsMkdir = (path: string): PEmptyResp => {
  return r.post('/fs/mkdir', { path })
}

export const fsRename = (
  path: string,
  name: string,
  overwrite: boolean = false
): PEmptyResp => {
  return r.post('/fs/rename', { path, name, overwrite })
}

export const fsBatchRename = (
  src_dir: string,
  rename_objects: RenameObj[]
): PEmptyResp => {
  return r.post('/fs/batch_rename', { src_dir, rename_objects })
}

export const fsMove = (
  src_dir: string,
  dst_dir: string,
  names: string[],
  overwrite: boolean = false,
  skip_existing: boolean = false
): PEmptyResp => {
  return r.post('/fs/move', {
    src_dir,
    dst_dir,
    names,
    overwrite,
    skip_existing,
  })
}

export const fsCopy = (
  src_dir: string,
  dst_dir: string,
  names: string[],
  overwrite: boolean = false,
  skip_existing: boolean = false,
  merge: boolean = false
): PEmptyResp => {
  return r.post('/fs/copy', {
    src_dir,
    dst_dir,
    names,
    overwrite,
    skip_existing,
    merge,
  })
}

export const fsRemove = (dir: string, names: string[]): PEmptyResp => {
  return r.post('/fs/remove', { dir, names })
}

export const fsRemoveEmptyDirectory = (src_dir: string): PEmptyResp => {
  return r.post('/fs/remove_empty_directory', { src_dir })
}

export const fsNewFile = (
  path: string,
  password: string,
  overwrite: boolean = false
): PEmptyResp => {
  return r.put('/fs/put', undefined, {
    headers: {
      'File-Path': encodeURIComponent(path),
      Password: password,
      Overwrite: overwrite.toString(),
    },
  })
}

export const fsStreamUpload = (
  path: string,
  file: File,
  password = '',
  overwrite = false,
  asTask = false,
  onProgress?: (percent: number, loaded: number, total: number) => void,
  cancelToken?: CancelToken
): PEmptyResp => {
  return r.put('/fs/put', file, {
    headers: {
      'File-Path': encodeURIComponent(path),
      'Content-Type': file.type || 'application/octet-stream',
      'Last-Modified': file.lastModified,
      Password: password,
      Overwrite: overwrite.toString(),
      'As-Task': asTask ? 'true' : 'false',
    },
    cancelToken,
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100)
        onProgress(percent, progressEvent.loaded, progressEvent.total)
      }
    },
  })
}

export const fsFormUpload = (
  path: string,
  file: File,
  password = '',
  overwrite = false,
  asTask = false,
  onProgress?: (percent: number, loaded: number, total: number) => void,
  cancelToken?: CancelToken
): PEmptyResp => {
  const form = new FormData()
  form.append('file', file)
  return r.put('/fs/form', form, {
    headers: {
      'File-Path': encodeURIComponent(path),
      'Content-Type': 'multipart/form-data',
      'Last-Modified': file.lastModified,
      Password: password,
      Overwrite: overwrite.toString(),
      'As-Task': asTask ? 'true' : 'false',
    },
    cancelToken,
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100)
        onProgress(percent, progressEvent.loaded, progressEvent.total)
      }
    },
  })
}

export const fsSearch = async (
  parent: string,
  keywords: string,
  password = '',
  scope = 0,
  page = 1,
  per_page = 100
): Promise<FsSearchResp> => {
  return r.post('/fs/search', {
    parent,
    keywords,
    scope,
    page,
    per_page,
    password,
  })
}

export const offlineDownload = (
  path: string,
  urls: string[],
  tool: string = 'aria2'
): PEmptyResp => {
  return r.post('/fs/offline_download', {
    path,
    urls,
    tool,
  })
}

export const fsArchiveMeta = (
  path: string,
  password = '',
  archive_password = ''
): PResp<ArchiveMeta> => {
  return r.post('/fs/archive/meta', {
    path,
    password,
    archive_password,
  })
}

export const fsArchiveList = (
  path: string,
  password = '',
  archive_password = '',
  inner_path = '/'
): PResp<ArchiveList> => {
  return r.post('/fs/archive/list', {
    path,
    password,
    archive_password,
    inner_path,
  })
}

export const fsArchiveDecompress = (
  src_path: string,
  dst_dir: string,
  password = '',
  inner_path = ''
): PEmptyResp => {
  return r.post('/fs/archive/decompress', {
    src_path,
    dst_dir,
    password,
    inner_path,
  })
}

export const fetchText = async (
  url: string
): Promise<{
  content: ArrayBuffer | string
  contentType?: string
}> => {
  try {
    const resp = await axios.get(url, {
      responseType: 'blob',
    })
    const content = await resp.data.arrayBuffer()
    const rawContentType = resp.headers['content-type']
    const contentType =
      typeof rawContentType === 'string' ? rawContentType : undefined
    return { content, contentType }
  } catch (e) {
    return {
      content: `Failed to fetch ${url}: ${e}`,
      contentType: '',
    }
  }
}

// ========== Settings & Auth API ==========

export const getPublicSettings = (): PResp<Record<string, string>> => {
  return r.get('/public/settings')
}

export const authLogin = (username: string, password: string, otp_code?: string): PResp<{ token: string }> => {
  return r.post('/auth/login', { username, password, otp_code })
}

export const me = (): PResp<User> => {
  return r.get('/me')
}
