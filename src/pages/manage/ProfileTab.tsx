import React, { useState } from 'react'
import { r } from '~/utils/request'
import { notify } from '~/utils/notify'
import { useUserStore } from '~/store/useUserStore'
import { useT } from '~/lang'
import { KeyRound, Copy, Loader2, Save } from 'lucide-react'

export const ProfileTab: React.FC = () => {
  const t = useT()
  const { user } = useUserStore()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      notify.error(t('users.confirm_password_not_same') || 'New passwords do not match')
      return
    }

    setLoading(true)
    try {
      const resp = await r.post('/auth/password', {
        old: oldPassword,
        new: newPassword,
      })
      if (resp.code === 200) {
        notify.success(t('users.update_profile_success') || 'Password updated successfully')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        notify.error(resp.message || 'Failed to update password')
      }
    } catch (e: any) {
      notify.error(e.message || 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyToken = () => {
    const token = localStorage.getItem('token')
    if (token) {
      navigator.clipboard.writeText(token)
      notify.success(t('global.copied') || 'API token copied to clipboard')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-bold text-slate-800 dark:text-white">
          {t('manage.sidemenu.profile') || 'My Profile'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('users.update_profile') ? '管理您的账户密码、安全凭据与 API Token' : 'Manage your account credentials, security settings, and API authentication token'}
        </p>
      </div>

      {/* User Info Card */}
      <div className="flex items-center space-x-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 font-bold text-xl uppercase">
          {user?.username?.charAt(0) || 'U'}
        </div>
        <div className="flex-1">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            {user?.username || 'User'}
          </h4>
          <p className="text-xs text-slate-500">
            {t('users.role') || 'Role'}: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{user?.role === 2 ? 'Administrator' : 'General User'}</span>
          </p>
        </div>
        <button
          onClick={handleCopyToken}
          className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>{t('settings.token') || 'Token'}</span>
        </button>
      </div>

      {/* Change Password Form */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <KeyRound className="h-5 w-5 text-indigo-500" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('users.change_password') || 'Change Password'}
          </h4>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('login.password') || 'Current Password'}
            </label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('users.change_password') || 'New Password'}
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('users.confirm_password') || 'Confirm New Password'}
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{t('global.save') || 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
