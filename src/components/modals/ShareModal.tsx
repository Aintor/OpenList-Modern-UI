import React, { useState } from 'react'
import { X, Share2, Copy, Check, Lock, Clock, Loader2 } from 'lucide-react'
import { r } from '~/utils/request'
import { Resp } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { useSettingsStore } from '~/store/useSettingsStore'
import { CustomSelect } from '~/components/ui/CustomSelect'

interface ShareModalProps {
  target: { name: string; is_dir?: boolean } | null
  currentPath: string
  isOpen: boolean
  onClose: () => void
}

export const ShareModal: React.FC<ShareModalProps> = ({
  target,
  currentPath,
  isOpen,
  onClose,
}) => {
  const t = useT()
  const { getSetting } = useSettingsStore()
  const [password, setPassword] = useState('')
  const [expireHours, setExpireHours] = useState('0') // 0 = permanent
  const [submitting, setSubmitting] = useState(false)
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null)
  const [createdShareMessage, setCreatedShareMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen || !target) return null

  const fullPath = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + target.name

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    // Calculate ISO expiration string or null
    let expiresIso: string | null = null
    if (expireHours !== '0') {
      const ms = Number(expireHours) * 3600 * 1000
      expiresIso = new Date(Date.now() + ms).toISOString()
    }

    const payload = {
      files: [fullPath],
      pwd: password || '',
      expires: expiresIso,
      max_accessed: 0,
      extract_folder: 0,
      order_by: 0,
      order_direction: 0,
      remark: '',
      readme: '',
      header: '',
    }

    try {
      const resp: Resp<{ id: string }> = await r.post('/share/create', payload)

      if (resp.code === 200 && resp.data) {
        const shareId = resp.data.id
        const link = `${window.location.origin}/@s/${shareId}`
        setCreatedShareLink(link)

        // Build formatted template message
        const siteTitle = getSetting('site_title') || 'Drive'
        let msg = `【${siteTitle}】${t('home.toolbar.share') || 'Shared'}: ${target.name}\nLink: ${link}`
        if (password) {
          msg += `\n${t('shares.pwd') || 'Password'}: ${password}`
        }
        if (expiresIso) {
          msg += `\n${t('shares.expires') || 'Expires'}: ${new Date(expiresIso).toLocaleString()}`
        }
        setCreatedShareMessage(msg)

        notify.success(t('global.save_success') || 'Share link created')
      } else {
        notify.error(resp.message || 'Failed to create share')
      }
    } catch (err: any) {
      notify.error(err.message || 'Failed to create share')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyLink = () => {
    if (!createdShareLink) return
    navigator.clipboard.writeText(createdShareLink)
    setCopied(true)
    notify.success(t('global.copied') || 'Share link copied')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyMessage = () => {
    if (!createdShareMessage) return
    navigator.clipboard.writeText(createdShareMessage)
    notify.success(t('global.copied') || 'Share message copied')
  }

  const handleReset = () => {
    setCreatedShareLink(null)
    setCreatedShareMessage(null)
    setPassword('')
    setExpireHours('0')
    onClose()
  }

  const expireOptions = [
    { value: '0', label: t('global.permanent') || 'Permanent' },
    { value: '1', label: `1 ${t('global.hour') || 'Hour'}` },
    { value: '24', label: `1 ${t('global.day') || 'Day'}` },
    { value: '168', label: `7 ${t('global.days') || 'Days'}` },
    { value: '720', label: `30 ${t('global.days') || 'Days'}` },
  ]

  return (
    <div
      onClick={handleReset}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
      >
        <button
          onClick={handleReset}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('home.toolbar.share') || 'Share Item'}
            </h3>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400 max-w-[280px]">
              {target.name}
            </p>
          </div>
        </div>

        {createdShareLink ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                  {t('shares.copy_msg') || 'Share Link'}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={createdShareLink}
                    className="h-9 w-full rounded-xl border border-indigo-200 bg-white px-3 font-mono text-xs text-slate-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-slate-200"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex h-9 shrink-0 items-center space-x-1 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? (t('global.copied') || 'Copied') : (t('global.copy') || 'Copy')}</span>
                  </button>
                </div>
              </div>

              {createdShareMessage && (
                <button
                  onClick={handleCopyMessage}
                  className="w-full flex items-center justify-center space-x-1.5 rounded-xl border border-indigo-200 bg-white py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t('shares.copy_msg') || 'Copy Full Share Message'}</span>
                </button>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleReset}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                {t('global.close') || 'Close'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateShare} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('shares.pwd') || 'Access Password (Optional)'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('shares.input_password') || 'Leave empty for public access'}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('shares.expires') || 'Expiration Time'}
              </label>
              <CustomSelect
                value={expireHours}
                onChange={(val) => setExpireHours(val)}
                options={expireOptions}
                icon={<Clock className="h-4 w-4 text-slate-400" />}
                className="w-full"
                triggerClassName="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
              >
                {t('global.cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                <span>{t('home.toolbar.share') || 'Generate Link'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
