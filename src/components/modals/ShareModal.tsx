import React, { useState } from 'react'
import {
  X,
  Share2,
  Copy,
  Check,
  Lock,
  Clock,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Hash,
  Calendar,
  Eye,
} from 'lucide-react'
import { r } from '~/utils/request'
import { Resp } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useUserStore } from '~/store/useUserStore'
import { CustomSelect } from '~/components/ui/CustomSelect'
import { Checkbox } from '~/components/ui/Checkbox'
import { randomPwd } from '~/utils/share'
import { ExtractFolder, OrderBy, OrderDirection } from '~/types/storage'

interface ShareModalProps {
  target?: { name: string; is_dir?: boolean } | null
  targets?: { name: string; is_dir?: boolean }[]
  currentPath: string
  isOpen: boolean
  onClose: () => void
}

/**
 * Format a Date into local datetime-local format: YYYY-MM-DDTHH:mm
 */
const toDateTimeLocalValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}

export const ShareModal: React.FC<ShareModalProps> = ({
  target,
  targets,
  currentPath,
  isOpen,
  onClose,
}) => {
  const t = useT()
  const { getSetting } = useSettingsStore()
  const { user } = useUserStore()

  // Form states
  const [customId, setCustomId] = useState('')
  const [password, setPassword] = useState('')
  const [expireMode, setExpireMode] = useState('0') // 0 = permanent, custom = custom datetime
  const [customExpireDateTime, setCustomExpireDateTime] = useState('')

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isUnlimitedAccessed, setIsUnlimitedAccessed] = useState(true)
  const [maxAccessed, setMaxAccessed] = useState<string>('')

  const [extractFolder, setExtractFolder] = useState<string>('')
  const [orderBy, setOrderBy] = useState<string>('')
  const [orderDirection, setOrderDirection] = useState<string>('')
  const [remark, setRemark] = useState('')
  const [readme, setReadme] = useState('')
  const [header, setHeader] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null)
  const [createdShareMessage, setCreatedShareMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const actualTargets = targets && targets.length > 0 ? targets : target ? [target] : []
  if (actualTargets.length === 0) return null

  const userBasePath = user?.base_path && user.base_path !== '/' ? user.base_path : ''

  const fullPaths = actualTargets.map((item) => {
    let p = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + item.name
    if (userBasePath && !p.startsWith(userBasePath)) {
      p = (userBasePath.endsWith('/') ? userBasePath.slice(0, -1) : userBasePath) + (p.startsWith('/') ? p : '/' + p)
    }
    return p
  })

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    // Calculate ISO expiration string or null
    let expiresIso: string | null = null
    if (expireMode === 'custom') {
      if (customExpireDateTime.trim()) {
        const dt = new Date(customExpireDateTime.trim())
        if (isNaN(dt.getTime())) {
          notify.error(t('shares.expires') ? `${t('shares.expires')} invalid` : 'Invalid expiration date')
          setSubmitting(false)
          return
        }
        expiresIso = dt.toISOString()
      }
    } else if (expireMode !== '0') {
      const ms = Number(expireMode) * 3600 * 1000
      expiresIso = new Date(Date.now() + ms).toISOString()
    }

    const payload = {
      id: customId.trim() || undefined,
      files: fullPaths,
      pwd: password || '',
      expires: expiresIso,
      max_accessed: isUnlimitedAccessed ? 0 : Math.max(0, parseInt(maxAccessed, 10) || 0),
      extract_folder: extractFolder || '',
      order_by: orderBy || '',
      order_direction: orderDirection || '',
      remark: remark.trim(),
      readme: readme.trim(),
      header: header.trim(),
    }

    try {
      const resp: Resp<{ id: string }> = await r.post('/share/create', payload)

      if (resp.code === 200 && resp.data) {
        const shareId = resp.data.id
        const link = `${window.location.origin}/@s/${shareId}`
        setCreatedShareLink(link)

        // Build formatted template message
        const siteTitle = getSetting('site_title') || 'Drive'
        const namesText = actualTargets.map((i) => i.name).join(', ')
        let msg = `【${siteTitle}】${t('home.toolbar.share') || 'Shared'}: ${namesText}\nLink: ${link}`
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
    setCustomId('')
    setPassword('')
    setExpireMode('0')
    setCustomExpireDateTime('')
    setIsUnlimitedAccessed(true)
    setMaxAccessed('')
    setExtractFolder('')
    setOrderBy('')
    setOrderDirection('')
    setRemark('')
    setReadme('')
    setHeader('')
    setShowAdvanced(false)
    onClose()
  }

  // No toast on random password generation
  const handleGenerateRandomPwd = () => {
    setPassword(randomPwd(5))
  }

  const handleCustomModeInit = () => {
    setExpireMode('custom')
    if (!customExpireDateTime) {
      // Default to 7 days later
      const defaultDate = new Date(Date.now() + 7 * 86400000)
      setCustomExpireDateTime(toDateTimeLocalValue(defaultDate))
    }
  }

  const expireOptions = [
    { value: '0', label: t('global.permanent') || '永久 (Permanent)' },
    { value: '1', label: `1 ${t('global.hour') || '小时 (Hour)'}` },
    { value: '24', label: `1 ${t('global.day') || '天 (Day)'}` },
    { value: '168', label: `7 ${t('global.days') || '天 (Days)'}` },
    { value: '720', label: `30 ${t('global.days') || '天 (Days)'}` },
    { value: 'custom', label: t('shares.custom_expires') || '自定义日期时间 (Custom)' },
  ]

  const defaultOptionLabel = t('shares.extract_folders.default') || t('global.default') || '系统默认'

  const extractFolderOptions = [
    { value: '', label: defaultOptionLabel },
    { value: ExtractFolder.Front, label: t('shares.extract_folders.front') || '文件夹置顶' },
    { value: ExtractFolder.Back, label: t('shares.extract_folders.back') || '文件夹置底' },
  ]

  const orderByOptions = [
    { value: '', label: defaultOptionLabel },
    { value: OrderBy.Name, label: t('shares.order_bys.name') || '名称' },
    { value: OrderBy.Size, label: t('shares.order_bys.size') || '大小' },
    { value: OrderBy.Modified, label: t('shares.order_bys.modified') || '修改时间' },
  ]

  const orderDirectionOptions = [
    { value: '', label: defaultOptionLabel },
    { value: OrderDirection.Asc, label: t('shares.order_directions.asc') || '升序' },
    { value: OrderDirection.Desc, label: t('shares.order_directions.desc') || '降序' },
  ]

  const displayName =
    actualTargets.length === 1
      ? actualTargets[0].name
      : t('shares.selected_items', { count: actualTargets.length }) || `${actualTargets.length} items selected`

  return (
    <div
      onClick={handleReset}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] flex flex-col"
      >
        {/* Close Button */}
        <button
          onClick={handleReset}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-4 flex items-center space-x-3 shrink-0 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <Share2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('home.toolbar.share') || 'Share Item'}
            </h3>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={actualTargets.map((i) => i.name).join(', ')}>
              {displayName}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        {createdShareLink ? (
          <div className="space-y-4 my-auto">
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
                    className="h-9 w-full rounded-xl border border-indigo-200 bg-white px-3 font-mono text-xs text-slate-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-slate-200 select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex h-9 shrink-0 items-center space-x-1 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? (t('global.copied') || 'Copied') : (t('global.copy') || 'Copy')}</span>
                  </button>
                </div>
              </div>

              {createdShareMessage && (
                <button
                  onClick={handleCopyMessage}
                  className="w-full flex items-center justify-center space-x-1.5 rounded-xl border border-indigo-200 bg-white py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 transition-colors cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t('shares.copy_msg') || 'Copy Full Share Message'}</span>
                </button>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleReset}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
              >
                {t('global.close') || 'Close'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateShare} className="flex flex-col min-h-0 flex-1">
            <div className="space-y-3.5 overflow-y-auto pr-1 flex-1 py-1">
              {/* Target items overview if multiple */}
              {actualTargets.length > 1 && (
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                    <span>{t('shares.files') || 'Share Paths'}</span>
                    <span className="font-mono">{actualTargets.length}</span>
                  </div>
                  <div className="max-h-20 overflow-y-auto space-y-1 text-xs text-slate-700 dark:text-slate-300 font-mono">
                    {actualTargets.map((item, idx) => (
                      <div key={idx} className="truncate" title={item.name}>
                        • {item.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. Custom Share ID (Optional) */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('shares.id') || 'Custom ID'}
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={customId}
                    maxLength={64}
                    onChange={(e) => setCustomId(e.target.value)}
                    placeholder={t('shares.id_placeholder') || 'Custom ID (optional, leave empty for random)'}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* 2. Access Password / Share Code */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('shares.pwd') || 'Share Code'}
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('shares.input_password') || 'Leave empty for public access'}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-10 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateRandomPwd}
                    title={t('shares.random_pwd') || 'Generate random share code'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 3. Expiration Time */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('shares.expires') || 'Expiration Time'}
                </label>
                <CustomSelect
                  value={expireMode}
                  onChange={(val) => {
                    if (val === 'custom') {
                      handleCustomModeInit()
                    } else {
                      setExpireMode(val)
                    }
                  }}
                  options={expireOptions}
                  icon={<Clock className="h-4 w-4 text-slate-400" />}
                  className="w-full"
                  triggerClassName="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                />

                {expireMode === 'custom' && (
                  <div className="relative pt-1 animate-in fade-in duration-150">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="datetime-local"
                      value={customExpireDateTime}
                      onChange={(e) => setCustomExpireDateTime(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* 4. Advanced Settings Collapsible Accordion */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-100 dark:border-slate-800"
                >
                  <span className="flex items-center space-x-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{t('shares.advanced_settings') || 'Advanced Settings'}</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                      showAdvanced ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showAdvanced && (
                  <div className="mt-3 space-y-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/30 animate-in fade-in zoom-in-95 duration-150">
                    {/* Max Accessed Count with Checkbox & Eye Icon */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {t('shares.max_accessed') || 'Maximum Access Count'}
                        </label>

                        <div className="flex items-center space-x-1.5">
                          <Checkbox
                            id="share-modal-unlimited-accessed"
                            checked={isUnlimitedAccessed}
                            onCheckedChange={(checked) => {
                              setIsUnlimitedAccessed(!!checked)
                              if (checked) setMaxAccessed('')
                            }}
                          />
                          <label
                            htmlFor="share-modal-unlimited-accessed"
                            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer select-none"
                          >
                            {t('global.unlimited') || '无限制'}
                          </label>
                        </div>
                      </div>

                      <div className="relative">
                        <Eye className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="number"
                          min="1"
                          disabled={isUnlimitedAccessed}
                          value={isUnlimitedAccessed ? '' : maxAccessed}
                          onChange={(e) => setMaxAccessed(e.target.value)}
                          placeholder={isUnlimitedAccessed ? (t('global.unlimited') || '无限制 (0)') : (t('shares.max_accessed') || '输入允许最大访问次数')}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 font-mono disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/40"
                        />
                      </div>
                    </div>

                    {/* Sorting Rules Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Folder Order */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                          {t('shares.extract_folder') || 'Folder Order'}
                        </label>
                        <CustomSelect
                          value={extractFolder}
                          onChange={(val) => setExtractFolder(val)}
                          options={extractFolderOptions}
                          className="w-full"
                          triggerClassName="h-9 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>

                      {/* Order By */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                          {t('shares.order_by') || 'Order By'}
                        </label>
                        <CustomSelect
                          value={orderBy}
                          onChange={(val) => setOrderBy(val)}
                          options={orderByOptions}
                          className="w-full"
                          triggerClassName="h-9 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>

                      {/* Order Direction */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                          {t('shares.order_direction') || 'Direction'}
                        </label>
                        <CustomSelect
                          value={orderDirection}
                          onChange={(val) => setOrderDirection(val)}
                          options={orderDirectionOptions}
                          className="w-full"
                          triggerClassName="h-9 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    {/* Remark */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        {t('shares.remark') || 'Remark'}
                      </label>
                      <input
                        type="text"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder={t('shares.remark') || 'Remark for administrators'}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs transition-all focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>

                    {/* Header Announcement */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        {t('shares.header') || 'Header Description'}
                      </label>
                      <textarea
                        rows={2}
                        value={header}
                        onChange={(e) => setHeader(e.target.value)}
                        placeholder={t('shares.header') || 'Notice at the top of the share page'}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs transition-all focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 resize-y"
                      />
                    </div>

                    {/* Readme Documentation */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        {t('shares.readme') || 'Description (Readme)'}
                      </label>
                      <textarea
                        rows={2}
                        value={readme}
                        onChange={(e) => setReadme(e.target.value)}
                        placeholder={t('shares.readme') || 'Markdown text shown at bottom'}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs transition-all focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 resize-y"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t('global.cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
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
