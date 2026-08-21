import { Obj } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useObjStore } from '~/store/useObjStore'
import { getDownloadUrl } from '~/utils/link'
import { fsGet, fsList } from '~/utils/api'
import axios from 'axios'
import { useTransferStore } from '~/store/useTransferStore'

interface Aria2File {
  path: string
  dir: string
  url: string
  name: string
}

export const useDownload = () => {
  const t = useT()
  const { getSetting } = useSettingsStore()
  const { currentPath: storePath, password } = useObjStore()

  const resolveDownloadUrl = async (obj: Obj, path: string): Promise<string> => {
    let url = obj.raw_url

    // 1. If raw_url is not pre-populated, resolve the real direct link via /fs/get
    if (!url) {
      try {
        const fullPath = path === '/' ? `/${obj.name}` : `${path}/${obj.name}`
        const res = await fsGet(fullPath, password)
        if (res.code === 200 && res.data?.raw_url) {
          url = res.data.raw_url
        }
      } catch (_) {}
    }

    // 2. Fallback to standard constructed /d/ link
    if (!url) {
      url = getDownloadUrl(obj, path, 'direct')
    }

    if (!url) return ''

    // 3. Append download parameter to trigger ESA custom response header rules
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}download`
  }

  const downloadObj = async (obj: Obj, customPath?: string) => {
    if (obj.is_dir) {
      notify.warning(t('home.toolbar.package_download-tips') || 'Directories cannot be downloaded directly, please use Package Download')
      return
    }

    const path = customPath !== undefined ? customPath : storePath
    notify.info(t('home.toolbar.download_start', { name: obj.name }) || `Downloading: ${obj.name}`)

    const url = await resolveDownloadUrl(obj, path)
    if (!url) {
      notify.error(t('home.toolbar.download_not_available') || 'Download link not available')
      return
    }

    useTransferStore.getState().addDownloadTask(obj.name, obj.size || 0, url)
  }

  const batchDownload = async (objs: Obj[], customPath?: string) => {
    const path = customPath !== undefined ? customPath : storePath
    const files = objs.filter((o) => !o.is_dir)
    if (files.length === 0) {
      notify.warning(t('home.toolbar.batch_download_empty') || 'No files selected to download')
      return
    }

    notify.info(
      t('home.toolbar.batch_download_start', { count: files.length }) ||
      `Batch downloading ${files.length} file(s)...`
    )

    const taskItems: Array<{ name: string; size: number; url: string }> = []
    await Promise.all(
      files.map(async (file) => {
        const url = await resolveDownloadUrl(file, path)
        if (url) {
          taskItems.push({
            name: file.name,
            size: file.size || 0,
            url,
          })
        }
      })
    )

    if (taskItems.length > 0) {
      useTransferStore.getState().addDownloadTasks(taskItems)
    }
  }

  const exportPlaylist = (objs: Obj[], customPath?: string) => {
    const path = customPath !== undefined ? customPath : storePath
    const mediaFiles = objs.filter((o) => !o.is_dir)
    if (mediaFiles.length === 0) {
      notify.warning('No media files selected for playlist')
      return
    }

    let m3u8Content = '#EXTM3U\n'
    mediaFiles.forEach((file) => {
      const url = getDownloadUrl(file, path)
      m3u8Content += `#EXTINF:-1,${file.name}\n${url}\n`
    })

    const blob = new Blob([m3u8Content], { type: 'application/x-mpegURL' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `playlist-${new Date().toISOString().slice(0, 10)}.m3u8`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    notify.success(t('home.toolbar.playlist_download') || 'Playlist exported (.m3u8)')
  }

  const sendToAria2 = async (objs: Obj[], customPath?: string) => {
    const basePath = customPath !== undefined ? customPath : storePath
    if (objs.length === 0) {
      notify.warning('No items selected to send to Aria2')
      return
    }

    const aria2Uri = getSetting('aria2_uri') || 'http://127.0.0.1:6800/jsonrpc'
    const aria2Secret = getSetting('aria2_secret') || ''

    if (!aria2Uri) {
      notify.warning(t('home.toolbar.aria2_not_set') || 'Please set Aria2 RPC URL in settings')
      return
    }

    const fetchFolderStructure = async (
      subDir: string,
      targetObj: Obj
    ): Promise<Aria2File[] | string> => {
      const currentFolder = subDir ? `${basePath.replace(/\/$/, '')}/${subDir}` : basePath
      if (!targetObj.is_dir) {
        return [
          {
            path: subDir ? `${subDir}/${targetObj.name}` : targetObj.name,
            dir: subDir ? `/${subDir}` : '',
            url: getDownloadUrl(targetObj, currentFolder),
            name: targetObj.name,
          },
        ]
      } else {
        const nextFolder = `${currentFolder.replace(/\/$/, '')}/${targetObj.name}`
        const resp = await fsList(nextFolder, password)
        if (resp.code !== 200) {
          return resp.message || 'Failed to list directory'
        }
        const res: Aria2File[] = []
        for (const child of resp.data?.content || []) {
          const nextSub = subDir ? `${subDir}/${targetObj.name}` : targetObj.name
          const subRes = await fetchFolderStructure(nextSub, child)
          if (typeof subRes === 'string') {
            return subRes
          }
          res.push(...subRes)
        }
        return res
      }
    }

    try {
      notify.info(t('home.package_download.fetching_struct') || 'Scanning files for Aria2...')
      
      // Get base save directory from Aria2
      let saveDir = '/downloads/openlist'
      try {
        const optResp = await axios.post(aria2Uri, {
          id: Math.random().toString(),
          jsonrpc: '2.0',
          method: 'aria2.getGlobalOption',
          params: ['token:' + aria2Secret],
        })
        if (optResp.data?.result?.dir) {
          saveDir = optResp.data.result.dir.replace(/\/$/, '')
        }
      } catch (e) {
        // fallback to default saveDir
      }

      const allFiles: Aria2File[] = []
      for (const obj of objs) {
        const res = await fetchFolderStructure('', obj)
        if (typeof res === 'string') {
          notify.error(`${t('home.package_download.fetching_struct_failed') || 'Failed'}: ${res}`)
          return
        }
        allFiles.push(...res)
      }

      if (allFiles.length === 0) {
        notify.warning('No downloadable files found')
        return
      }

      notify.info(`${t('home.package_download.downloading') || 'Sending tasks to Aria2...'} (${allFiles.length})`)

      for (const file of allFiles) {
        await axios.post(aria2Uri, {
          id: Math.random().toString(),
          jsonrpc: '2.0',
          method: 'aria2.addUri',
          params: [
            'token:' + aria2Secret,
            [file.url],
            {
              out: file.name,
              dir: saveDir + file.dir,
              'check-certificate': 'false',
            },
          ],
        })
      }
      notify.success(t('home.toolbar.send_aria2_success') || 'Sent to Aria2 successfully')
    } catch (e: any) {
      notify.error(t('home.toolbar.aria2_not_set') || `Aria2 error: ${e.message}`)
    }
  }

  return {
    downloadObj,
    batchDownload,
    exportPlaylist,
    sendToAria2,
  }
}
