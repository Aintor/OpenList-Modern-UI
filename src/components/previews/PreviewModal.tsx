import React, { useEffect, useState } from 'react'
import {
  X,
  Download,
  Copy,
  FileText,
  Music,
  Video as VideoIcon,
  Image as ImageIcon,
  Archive,
  FileCode,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Obj, ObjType } from '~/types'
import { notify } from '~/utils/notify'
import { fsGet } from '~/utils/api'
import { ArchivePreview } from './ArchivePreview'
import { useI18n, useT } from '~/lang'
import { useObjStore } from '~/store/useObjStore'
import { useSettingsStore } from '~/store/useSettingsStore'
import '@videojs/react/video/skin.css'
import '@videojs/react/audio/skin.css'
import { VideoPlayer, VideoSkin, Video as VideoElement } from '@videojs/react/video'
import { AudioPlayer, AudioSkin, Audio as AudioElement } from '@videojs/react/audio'
import { I18nProvider } from '@videojs/react/i18n'

interface PreviewModalProps {
  obj: Obj | null
  currentPath: string
  isOpen: boolean
  onClose: () => void
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  obj,
  currentPath,
  isOpen,
  onClose,
}) => {
  const t = useT()
  const { password } = useObjStore()
  const { getSettingBool } = useSettingsStore()
  const { locale } = useI18n()

  const videoAutoPlay = getSettingBool('video_autoplay', true)
  const audioAutoPlay = getSettingBool('audio_autoplay', true)

  const [fileDetail, setFileDetail] = useState<(Obj & { raw_url?: string; readme?: string; provider?: string }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)

  const fullPath = obj
    ? (currentPath.endsWith('/') ? currentPath : currentPath + '/') + obj.name
    : ''

  const targetObj = fileDetail || obj
  const ext = targetObj ? targetObj.name.toLowerCase().split('.').pop() || '' : ''

  const isVideo =
    targetObj &&
    (targetObj.type === ObjType.VIDEO ||
      ['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm', 'm3u8', 'ts'].includes(ext))

  const isImage =
    targetObj &&
    (targetObj.type === ObjType.IMAGE ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'].includes(ext))

  const isAudio =
    targetObj &&
    (targetObj.type === ObjType.AUDIO ||
      ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'opus', 'ape'].includes(ext))

  const isArchive =
    targetObj &&
    (targetObj.name.endsWith('.zip') ||
      targetObj.name.endsWith('.rar') ||
      targetObj.name.endsWith('.7z') ||
      targetObj.name.endsWith('.tar') ||
      targetObj.name.endsWith('.gz'))

  const isPdf = targetObj && targetObj.name.toLowerCase().endsWith('.pdf')
  const isOffice =
    targetObj &&
    (targetObj.name.endsWith('.docx') ||
      targetObj.name.endsWith('.doc') ||
      targetObj.name.endsWith('.xlsx') ||
      targetObj.name.endsWith('.xls') ||
      targetObj.name.endsWith('.pptx') ||
      targetObj.name.endsWith('.ppt'))

  const isText =
    targetObj &&
    (targetObj.type === ObjType.TEXT ||
      ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'go', 'rs', 'c', 'cpp', 'sh', 'yaml', 'yml', 'toml', 'log', 'ini', 'conf', 'xml'].includes(ext))

  // Fetch full file details (including direct stream/download raw_url) via /api/fs/get
  useEffect(() => {
    if (!isOpen || !obj) {
      setFileDetail(null)
      setFetchError(null)
      setTextContent(null)
      return
    }

    if (obj.raw_url) {
      setFileDetail(obj)
      setFetchError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setFetchError(null)

    fsGet(fullPath, password)
      .then((resp) => {
        if (!isMounted) return
        if (resp.code === 200 && resp.data) {
          setFileDetail(resp.data)
        } else {
          setFetchError(resp.message || 'Failed to get file information')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setFetchError(err.message || 'Network error fetching file details')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, obj, fullPath, password])

  // Load text file content if text type
  useEffect(() => {
    const rawUrl = fileDetail?.raw_url || obj?.raw_url
    if (isOpen && isText && rawUrl) {
      setTextLoading(true)
      fetch(rawUrl)
        .then((res) => res.text())
        .then((text) => {
          setTextContent(text)
          setTextLoading(false)
        })
        .catch(() => {
          setTextContent('Failed to load text content')
          setTextLoading(false)
        })
    } else {
      setTextContent(null)
    }
  }, [isOpen, isText, fileDetail?.raw_url, obj?.raw_url])

  if (!isOpen || !obj) return null

  const effectiveRawUrl = fileDetail?.raw_url || obj.raw_url

  const handleCopyLink = () => {
    if (effectiveRawUrl) {
      navigator.clipboard.writeText(effectiveRawUrl)
      notify.success(t('global.copied') || 'Download link copied')
    }
  }

  const handleDownload = () => {
    if (effectiveRawUrl) {
      window.open(effectiveRawUrl, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden text-slate-100">
        {/* Top Preview Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/90">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-950 text-indigo-400 shrink-0">
              {isImage && <ImageIcon className="h-4 w-4" />}
              {isVideo && <VideoIcon className="h-4 w-4" />}
              {isAudio && <Music className="h-4 w-4" />}
              {isArchive && <Archive className="h-4 w-4" />}
              {isText && <FileCode className="h-4 w-4" />}
              {!isImage && !isVideo && !isAudio && !isArchive && !isText && <FileText className="h-4 w-4" />}
            </div>
            <span className="truncate text-sm font-bold text-slate-200">
              {obj.name}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            {effectiveRawUrl && (
              <>
                <button
                  onClick={handleCopyLink}
                  title={t('home.toolbar.copy_link') || 'Copy Direct Link'}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={handleDownload}
                  title={t('home.preview.download') || 'Download File'}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              title={t('global.close') || 'Close'}
              className="rounded-xl p-2 text-slate-400 hover:bg-rose-950/60 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-4 sm:p-6 bg-slate-950/60 min-h-[350px]">
          {loading && !effectiveRawUrl && !isArchive ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">{t('global.loading') || 'Loading file preview...'}</span>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center space-y-2 py-12 text-rose-400">
              <AlertCircle className="h-8 w-8" />
              <span className="text-sm font-medium">{fetchError}</span>
            </div>
          ) : (
            <>
              {/* Image Preview */}
              {isImage && effectiveRawUrl && (
                <img
                  src={effectiveRawUrl}
                  alt={obj.name}
                  className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-md"
                />
              )}

              {/* Video.js v10 Modern React Player */}
              {isVideo && effectiveRawUrl && (
                <div className="relative flex items-center justify-center h-[65vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-black">
                  <VideoPlayer>
                    <I18nProvider locale={locale === 'zh-TW' ? 'zh-TW' : locale === 'en' ? 'en' : 'zh-CN'}>
                      <VideoSkin>
                        <VideoElement src={effectiveRawUrl} playsInline autoPlay={videoAutoPlay} />
                      </VideoSkin>
                    </I18nProvider>
                  </VideoPlayer>
                </div>
              )}

              {/* Video.js v10 Modern Audio Player */}
              {isAudio && effectiveRawUrl && (
                <div className="flex flex-col items-center space-y-6 rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl w-full max-w-lg">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-950/80 text-indigo-400 shadow-inner border border-indigo-500/20">
                    <Music className="h-12 w-12" />
                  </div>
                  <div className="text-center w-full px-4">
                    <h4 className="font-bold text-slate-100 truncate text-base">{obj.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      {(obj.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="w-full">
                    <AudioPlayer>
                      <I18nProvider locale={locale === 'zh-TW' ? 'zh-TW' : locale === 'en' ? 'en' : 'zh-CN'}>
                        <AudioSkin>
                          <AudioElement src={effectiveRawUrl} autoPlay={audioAutoPlay} />
                        </AudioSkin>
                      </I18nProvider>
                    </AudioPlayer>
                  </div>
                </div>
              )}

              {/* Archive Preview */}
              {isArchive && (
                <div className="w-full max-w-4xl">
                  <ArchivePreview filePath={fullPath} />
                </div>
              )}

              {/* PDF Viewer */}
              {isPdf && effectiveRawUrl && (
                <iframe
                  src={effectiveRawUrl}
                  title={obj.name}
                  className="h-[75vh] w-full rounded-2xl border border-slate-800"
                />
              )}

              {/* Office Document Embed Viewer */}
              {isOffice && effectiveRawUrl && (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(effectiveRawUrl)}`}
                  title={obj.name}
                  className="h-[75vh] w-full rounded-2xl border border-slate-800"
                />
              )}

              {/* Text / Markdown / Code Reader */}
              {isText && (
                <div className="h-[70vh] w-full overflow-auto rounded-2xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs text-slate-200">
                  {textLoading ? (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      {t('global.loading') || 'Loading code content...'}
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap">{textContent}</pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
