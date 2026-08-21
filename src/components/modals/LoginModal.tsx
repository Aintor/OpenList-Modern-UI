import React, { useState, useRef, useEffect } from 'react'
import { X, User, Lock, Loader2, HardDrive, ShieldCheck } from 'lucide-react'
import { useUserStore } from '~/store/useUserStore'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useT } from '~/lang'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showOtp, setShowOtp] = useState(false)
  const otpInputRef = useRef<HTMLInputElement>(null)

  const { login, loading } = useUserStore()
  const { getSetting, getLogoUrl } = useSettingsStore()
  const t = useT()

  const siteTitle = getSetting('site_title') || 'Drive'
  const logoUrl = getLogoUrl()

  useEffect(() => {
    if (showOtp && otpInputRef.current) {
      otpInputRef.current.focus()
    }
  }, [showOtp])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    const res = await login(username, password, showOtp ? otp : undefined)
    if (res.success) {
      onClose()
      setUsername('')
      setPassword('')
      setOtp('')
      setShowOtp(false)
    } else if (res.needOtp) {
      setShowOtp(true)
    }
  }

  const handleClose = () => {
    setShowOtp(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={siteTitle} className="h-12 w-12 object-contain rounded-xl mb-3 shadow-xs" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white mb-3 shadow-md shadow-indigo-500/20">
              <HardDrive className="h-6 w-6" />
            </div>
          )}
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {t('login.login') || 'Sign In'}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
            {siteTitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('login.username') || 'Username'}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('login.username-tips') || 'Username'}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('login.password') || 'Password'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.password-tips') || '••••••••'}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-900"
              />
            </div>
          </div>

          {/* Dynamic 2FA Code Input - only shown if required */}
          {showOtp && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center space-x-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{t('login.otp-tips') || '2FA / OTP Code'}</span>
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
                <input
                  ref={otpInputRef}
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.trim())}
                  placeholder={t('login.otp-tips') || '6-digit code'}
                  className="h-10 w-full rounded-xl border border-indigo-200 bg-indigo-50/30 pl-9 pr-3 text-xs font-mono tracking-widest transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-indigo-900 dark:bg-indigo-950/30"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center rounded-xl bg-indigo-600 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            <span>{t('login.login') || 'Sign In'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
