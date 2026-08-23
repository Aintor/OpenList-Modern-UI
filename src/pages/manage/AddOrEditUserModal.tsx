import React, { useEffect, useState } from 'react'
import { X, UserPlus, Save, Loader2 } from 'lucide-react'
import { r } from '~/utils/request'
import { User, UserPermissions, UserRole } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { CustomSelect } from '~/components/ui/CustomSelect'

interface AddOrEditUserModalProps {
  userId?: number | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddOrEditUserModal: React.FC<AddOrEditUserModalProps> = ({
  userId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const t = useT()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [basePath, setBasePath] = useState('/')
  const [role, setRole] = useState<UserRole>(UserRole.GENERAL)
  const [permission, setPermission] = useState<number>(0)
  const [disabled, setDisabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    if (userId) {
      setLoading(true)
      r.get<User>(`/admin/user/get?id=${userId}`).then((resp) => {
        if (resp.code === 200 && resp.data) {
          setUsername(resp.data.username)
          setPassword('')
          setBasePath(resp.data.base_path || '/')
          setRole(resp.data.role)
          setPermission(resp.data.permission)
          setDisabled(resp.data.disabled)
        }
        setLoading(false)
      })
    } else {
      setUsername('')
      setPassword('')
      setBasePath('/')
      setRole(UserRole.GENERAL)
      setPermission(0)
      setDisabled(false)
    }
  }, [isOpen, userId])

  if (!isOpen) return null

  const handleTogglePermission = (index: number) => {
    setPermission((prev) => (prev ^ (1 << index)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const payload: Partial<User> = {
      id: userId || undefined,
      username,
      password: password || undefined,
      base_path: basePath,
      role,
      permission,
      disabled,
    }

    try {
      const endpoint = userId ? '/admin/user/update' : '/admin/user/create'
      const resp = await r.post(endpoint, payload)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'User saved successfully')
        onSuccess()
        onClose()
      } else {
        notify.error(resp.message || 'Failed to save user')
      }
    } catch (err: any) {
      notify.error(err.message || 'Failed to save user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {userId ? (t('global.edit') || 'Edit User') : (t('global.add') || 'Add User')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {userId ? `User ID #${userId}` : (t('users.create_user_tips') || '创建新的用户账户')}
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
              <span className="text-sm">{t('global.loading') || 'Loading user...'}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('users.username') || 'Username'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('users.password') || 'Password'} {userId ? `(${t('users.change_password-tips') || 'Leave empty to keep current'})` : '*'}
                  </label>
                  <input
                    type="password"
                    required={!userId}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('users.base_path') || 'Base Path'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={basePath}
                    onChange={(e) => setBasePath(e.target.value)}
                    placeholder="/"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('users.role') || 'Role'}
                  </label>
                  <CustomSelect
                    value={role}
                    onChange={(val) => setRole(Number(val))}
                    options={[
                      { value: UserRole.GENERAL, label: t('users.general_user') || 'General User' },
                      { value: UserRole.ADMIN, label: t('users.admin_user') || 'Administrator' },
                      { value: UserRole.GUEST, label: t('users.guest_user') || 'Guest' },
                    ]}
                    className="w-full"
                    triggerClassName="h-10 text-xs w-full bg-slate-50 dark:bg-slate-950/60 dark:border-slate-800 font-semibold"
                  />
                </div>
              </div>

              {/* Permissions Checkbox Grid / Flow */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('users.permission') || 'Permissions'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {UserPermissions.map((permName, index) => {
                    const isChecked = (permission & (1 << index)) !== 0
                    const labelText = t(`users.permissions.${permName}`) || permName
                    return (
                      <button
                        type="button"
                        key={permName}
                        onClick={() => handleTogglePermission(index)}
                        title={labelText}
                        className={`inline-flex items-center space-x-2 rounded-xl border px-3 py-2 text-left text-xs transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'border-indigo-500/50 bg-indigo-50/70 font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-xs'
                            : 'border-slate-200/80 bg-slate-50/60 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isChecked
                              ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                              : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
                          }`}
                        >
                          {isChecked && <span className="text-[10px] font-bold leading-none">✓</span>}
                        </div>
                        <span>{labelText}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Disabled Status Toggle */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('users.disabled') || 'Disable Account'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {t('users.disabled-tips') || 'Prevent this user from logging in'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={disabled}
                  onClick={() => setDisabled(!disabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    disabled ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      disabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
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
