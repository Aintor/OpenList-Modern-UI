import React, { useEffect, useState } from 'react'
import { X, Shield, Save, Loader2 } from 'lucide-react'
import { r } from '~/utils/request'
import { Meta, Resp } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'

interface AddOrEditMetaModalProps {
  metaId?: number | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddOrEditMetaModal: React.FC<AddOrEditMetaModalProps> = ({
  metaId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const t = useT()
  const [path, setPath] = useState('')
  const [password, setPassword] = useState('')
  const [pSub, setPSub] = useState(false)
  const [hide, setHide] = useState('')
  const [hSub, setHSub] = useState(false)
  const [readme, setReadme] = useState('')
  const [rSub, setRSub] = useState(false)
  const [write, setWrite] = useState(false)
  const [wSub, setWSub] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    if (metaId) {
      setLoading(true)
      r.get<Meta>(`/admin/meta/get?id=${metaId}`).then((resp) => {
        if (resp.code === 200 && resp.data) {
          const m = resp.data
          setPath(m.path)
          setPassword(m.password || '')
          setPSub(m.p_sub || false)
          setHide(m.hide || '')
          setHSub(m.h_sub || false)
          setReadme(m.readme || '')
          setRSub(m.r_sub || false)
          setWrite(m.write || false)
          setWSub(m.w_sub || false)
        }
        setLoading(false)
      })
    } else {
      setPath('/')
      setPassword('')
      setPSub(false)
      setHide('')
      setHSub(false)
      setReadme('')
      setRSub(false)
      setWrite(false)
      setWSub(false)
    }
  }, [isOpen, metaId])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!path.startsWith('/')) {
      notify.error('Path must start with /')
      return
    }

    setSubmitting(true)
    const payload: Partial<Meta> = {
      id: metaId || undefined,
      path,
      password: password || undefined,
      p_sub: pSub,
      hide,
      h_sub: hSub,
      readme,
      r_sub: rSub,
      write,
      w_sub: wSub,
    }

    try {
      const endpoint = metaId ? '/admin/meta/update' : '/admin/meta/create'
      const resp: Resp<any> = await r.post(endpoint, payload)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Meta rule saved successfully')
        onSuccess()
        onClose()
      } else {
        notify.error(resp.message || 'Failed to save meta rule')
      }
    } catch (err: any) {
      notify.error(err.message || 'Failed to save meta rule')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {metaId ? (t('global.edit') || 'Edit Meta Rule') : (t('global.add') || 'Add Meta Rule')}
              </h3>
              <p className="text-[11px] text-slate-400">
                Directory access permissions, password protection, and readme overrides
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-48 items-center justify-center space-x-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="text-sm">{t('global.loading') || 'Loading meta rule...'}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Directory Path */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('metas.path') || 'Directory Path'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/protected-folder"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>

              {/* Password & Sub Checkbox */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('metas.password') || 'Access Password'}
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={pSub}
                      onChange={(e) => setPSub(e.target.checked)}
                      className="h-3.5 w-3.5 rounded text-indigo-600"
                    />
                    <span>{t('metas.apply_sub') || 'Apply to subfolders'}</span>
                  </label>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.password-tips') || 'Leave empty for public access'}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>

              {/* Hide Pattern & Sub Checkbox */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('metas.hide') || 'Hide Regex Pattern'}
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={hSub}
                      onChange={(e) => setHSub(e.target.checked)}
                      className="h-3.5 w-3.5 rounded text-indigo-600"
                    />
                    <span>{t('metas.apply_sub') || 'Apply to subfolders'}</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={hide}
                  onChange={(e) => setHide(e.target.value)}
                  placeholder={t('metas.hide_help') || 'e.g. ^\\..*|secret.*'}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-mono text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>

              {/* Readme Markdown text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('metas.readme') || 'Directory Header / Readme Content'}
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={rSub}
                      onChange={(e) => setRSub(e.target.checked)}
                      className="h-3.5 w-3.5 rounded text-indigo-600"
                    />
                    <span>{t('metas.apply_sub') || 'Apply to subfolders'}</span>
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={readme}
                  onChange={(e) => setReadme(e.target.value)}
                  placeholder={t('metas.readme_help') || 'Markdown announcement text for this directory'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>

              {/* Write Permission Override */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('metas.write') || 'Allow Write / Upload'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Override write permissions for this folder
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1.5 cursor-pointer text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={wSub}
                      onChange={(e) => setWSub(e.target.checked)}
                      className="h-3.5 w-3.5 rounded text-indigo-600"
                    />
                    <span>{t('metas.apply_sub') || 'Apply to sub'}</span>
                  </label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={write}
                    onClick={() => setWrite(!write)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      write ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        write ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t('global.cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{t('global.save') || 'Save'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
