import React, { useEffect, useState } from 'react'
import {
  X,
  Share2,
  Save,
  Loader2,
  Lock,
  RefreshCw,
  Hash,
  Calendar,
  Eye,
  FolderOpen,
} from 'lucide-react'
import { r } from '~/utils/request'
import { Resp } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { CustomSelect } from '~/components/ui/CustomSelect'
import { Checkbox } from '~/components/ui/Checkbox'
import { randomPwd } from '~/utils/share'
import { ExtractFolder, OrderBy, OrderDirection } from '~/types/storage'
import { ShareInfo } from '~/types/share'
import { PathPickerModal } from '~/components/modals/PathPickerModal'

interface AddOrEditShareModalProps {
  shareId?: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
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

export const AddOrEditShareModal: React.FC<AddOrEditShareModalProps> = ({
  shareId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const t = useT()

  const [filesText, setFilesText] = useState('')
  const [newId, setNewId] = useState('')
  const [password, setPassword] = useState('')

  // Expiration: permanent boolean + datetime-local string
  const [isPermanentExpire, setIsPermanentExpire] = useState(true)
  const [expireDateTime, setExpireDateTime] = useState('')

  // Max Accessed: unlimited boolean + number string
  const [isUnlimitedAccessed, setIsUnlimitedAccessed] = useState(true)
  const [maxAccessed, setMaxAccessed] = useState('')

  const [accessed, setAccessed] = useState(0)
  const [disabled, setDisabled] = useState(false)
  const [extractFolder, setExtractFolder] = useState<string>('')
  const [orderBy, setOrderBy] = useState<string>('')
  const [orderDirection, setOrderDirection] = useState<string>('')
  const [remark, setRemark] = useState('')
  const [readme, setReadme] = useState('')
  const [header, setHeader] = useState('')

  const [isPathPickerOpen, setIsPathPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    if (shareId) {
      setLoading(true)
      r.get<ShareInfo>(`/share/get?id=${shareId}`)
        .then((resp) => {
          if (resp.code === 200 && resp.data) {
            const d = resp.data
            setFilesText(d.files ? d.files.join('\n') : '')
            setNewId(d.id || '')
            setPassword(d.pwd || '')

            // Expiration
            if (d.expires) {
              const dt = new Date(d.expires)
              if (!isNaN(dt.getTime())) {
                setIsPermanentExpire(false)
                setExpireDateTime(toDateTimeLocalValue(dt))
              } else {
                setIsPermanentExpire(true)
                setExpireDateTime('')
              }
            } else {
              setIsPermanentExpire(true)
              setExpireDateTime('')
            }

            // Max Accessed
            if (d.max_accessed && d.max_accessed > 0) {
              setIsUnlimitedAccessed(false)
              setMaxAccessed(String(d.max_accessed))
            } else {
              setIsUnlimitedAccessed(true)
              setMaxAccessed('')
            }

            setAccessed(d.accessed || 0)
            setDisabled(d.disabled || false)
            setExtractFolder(d.extract_folder || '')
            setOrderBy(d.order_by || '')
            setOrderDirection(d.order_direction || '')
            setRemark(d.remark || '')
            setReadme(d.readme || '')
            setHeader(d.header || '')
          } else {
            notify.error(resp.message || 'Failed to fetch share details')
          }
        })
        .catch((e: any) => {
          notify.error(e.message || 'Failed to fetch share details')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setFilesText('')
      setNewId('')
      setPassword('')
      setIsPermanentExpire(true)
      setExpireDateTime('')
      setIsUnlimitedAccessed(true)
      setMaxAccessed('')
      setAccessed(0)
      setDisabled(false)
      setExtractFolder('')
      setOrderBy('')
      setOrderDirection('')
      setRemark('')
      setReadme('')
      setHeader('')
    }
  }, [isOpen, shareId])

  if (!isOpen) return null

  // No toast upon generating random password
  const handleGenerateRandomPwd = () => {
    setPassword(randomPwd(5))
  }

  const handleAddQuickDays = (days: number) => {
    const d = new Date(Date.now() + days * 86400000)
    setIsPermanentExpire(false)
    setExpireDateTime(toDateTimeLocalValue(d))
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const files = filesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    if (files.length === 0) {
      notify.error(t('shares.files_placeholder') || 'Please enter at least 1 path')
      return
    }

    let expiresIso: string | null = null
    if (!isPermanentExpire && expireDateTime) {
      const dt = new Date(expireDateTime)
      if (isNaN(dt.getTime())) {
        notify.error(t('shares.expires') ? `${t('shares.expires')} invalid` : 'Invalid expiration date')
        return
      }
      expiresIso = dt.toISOString()
    }

    setSubmitting(true)

    const payload: any = {
      files,
      pwd: password || '',
      expires: expiresIso,
      max_accessed: isUnlimitedAccessed ? 0 : Math.max(0, parseInt(maxAccessed, 10) || 0),
      disabled,
      extract_folder: extractFolder || '',
      order_by: orderBy || '',
      order_direction: orderDirection || '',
      remark: remark.trim(),
      readme: readme.trim(),
      header: header.trim(),
    }

    if (shareId) {
      payload.id = shareId
      payload.new_id = newId.trim() || shareId
      payload.accessed = Number(accessed) || 0
    } else {
      if (newId.trim()) {
        payload.id = newId.trim()
      }
    }

    try {
      const endpoint = shareId ? '/share/update' : '/share/create'
      const resp: Resp<any> = await r.post(endpoint, payload)

      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Share saved successfully')
        onSuccess()
        onClose()
      } else {
        notify.error(resp.message || 'Failed to save share')
      }
    } catch (err: any) {
      notify.error(err.message || 'Failed to save share')
    } finally {
      setSubmitting(false)
    }
  }

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

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] flex flex-col"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Modal Header */}
          <div className="mb-4 flex items-center space-x-3 shrink-0 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {shareId ? (t('global.edit') || 'Edit Share') : (t('global.add') || 'Create Share')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {shareId ? `ID: ${shareId}` : (t('shares.no_permission_tip') ? '创建或修改文件分享链接及其访问规则' : 'Configure file share paths and permission rules')}
              </p>
            </div>
          </div>

          {/* Modal Body */}
          {loading ? (
            <div className="flex h-64 items-center justify-center space-x-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="text-sm">{t('global.loading') || 'Loading...'}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
              <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
                {/* Paths (Files) & Browse Button */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t('shares.files') || 'Share Paths'} <span className="text-rose-500">*</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsPathPickerOpen(true)}
                      className="flex items-center space-x-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-400 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span>{t('global.choose_path') || '浏览选择路径'}</span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    required
                    value={filesText}
                    onChange={(e) => setFilesText(e.target.value)}
                    placeholder={t('shares.files_placeholder') || 'Enter file or folder paths, one per line (e.g. /photos/travel.jpg)'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 resize-y"
                  />
                </div>

                {/* ID & Password 2-col Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Share ID */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t('shares.id') || 'Share ID'}
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        maxLength={64}
                        value={newId}
                        onChange={(e) => setNewId(e.target.value)}
                        placeholder={shareId ? shareId : (t('shares.id_placeholder') || 'Custom ID (optional)')}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  {/* Share Password / Code */}
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
                        title={t('shares.random_pwd') || 'Generate random code'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-indigo-600 dark:hover:bg-slate-700 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expiration & Max Access 2-col Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Expiration Date Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {t('shares.expires') || 'Expiration Time'}
                      </label>

                      <div className="flex items-center space-x-1.5">
                        <Checkbox
                          id="edit-share-permanent-expire"
                          checked={isPermanentExpire}
                          onCheckedChange={(checked) => {
                            setIsPermanentExpire(!!checked)
                            if (checked) setExpireDateTime('')
                          }}
                        />
                        <label
                          htmlFor="edit-share-permanent-expire"
                          className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer select-none"
                        >
                          {t('global.permanent') || '永久 (Permanent)'}
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="datetime-local"
                          disabled={isPermanentExpire}
                          value={expireDateTime}
                          onChange={(e) => {
                            setExpireDateTime(e.target.value)
                            if (e.target.value) setIsPermanentExpire(false)
                          }}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 font-mono disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/40"
                        />
                      </div>

                      {/* Quick preset tags */}
                      {!isPermanentExpire && (
                        <div className="flex items-center space-x-1.5 pt-0.5">
                          <span className="text-[11px] text-slate-400">快捷:</span>
                          {[1, 7, 30].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => handleAddQuickDays(days)}
                              className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              +{days}天
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Max Accessed Count with Shadcn Checkbox & Eye Icon */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {t('shares.max_accessed') || 'Maximum Access Count'}
                      </label>

                      <div className="flex items-center space-x-1.5">
                        <Checkbox
                          id="edit-share-unlimited-accessed"
                          checked={isUnlimitedAccessed}
                          onCheckedChange={(checked) => {
                            setIsUnlimitedAccessed(!!checked)
                            if (checked) setMaxAccessed('')
                          }}
                        />
                        <label
                          htmlFor="edit-share-unlimited-accessed"
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
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 font-mono disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/40"
                      />
                    </div>
                  </div>
                </div>

                {/* Accessed count & Disabled status (when editing) */}
                {shareId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        {t('shares.accessed') || 'Current Accessed Count'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={accessed}
                        onChange={(e) => setAccessed(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-4 sm:pt-0">
                      <Checkbox
                        id="edit-share-disabled"
                        checked={disabled}
                        onCheckedChange={(checked) => setDisabled(!!checked)}
                      />
                      <label
                        htmlFor="edit-share-disabled"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                      >
                        {t('shares.status_list.disabled') || 'Disable this share'}
                      </label>
                    </div>
                  </div>
                )}

                {/* Sorting Rules Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Folder Order */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('shares.extract_folder') || 'Folder Order'}
                    </label>
                    <CustomSelect
                      value={extractFolder}
                      onChange={(val) => setExtractFolder(val)}
                      options={extractFolderOptions}
                      className="w-full"
                      triggerClassName="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  {/* Order By */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('shares.order_by') || 'Order By'}
                    </label>
                    <CustomSelect
                      value={orderBy}
                      onChange={(val) => setOrderBy(val)}
                      options={orderByOptions}
                      className="w-full"
                      triggerClassName="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  {/* Order Direction */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('shares.order_direction') || 'Direction'}
                    </label>
                    <CustomSelect
                      value={orderDirection}
                      onChange={(val) => setOrderDirection(val)}
                      options={orderDirectionOptions}
                      className="w-full"
                      triggerClassName="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Remark */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('shares.remark') || 'Remark'}
                  </label>
                  <input
                    type="text"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder={t('shares.remark') || 'Remark for administrators'}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                {/* Header Description */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('shares.header') || 'Header Description'}
                  </label>
                  <textarea
                    rows={2}
                    value={header}
                    onChange={(e) => setHeader(e.target.value)}
                    placeholder={t('shares.header') || 'Notice at the top of the share page'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 resize-y"
                  />
                </div>

                {/* Readme Documentation */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('shares.readme') || 'Description (Readme)'}
                  </label>
                  <textarea
                    rows={2}
                    value={readme}
                    onChange={(e) => setReadme(e.target.value)}
                    placeholder={t('shares.readme') || 'Markdown description shown at bottom'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 resize-y"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
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
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>{t('global.save') || 'Save Share'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Path Picker Modal */}
      <PathPickerModal
        isOpen={isPathPickerOpen}
        onClose={() => setIsPathPickerOpen(false)}
        initialSelectedPaths={filesText.split('\n').map((s) => s.trim()).filter(Boolean)}
        onSelect={(newPaths) => {
          setFilesText(newPaths.join('\n'))
        }}
      />
    </>
  )
}
