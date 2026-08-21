import React, { useState, useRef, useEffect } from 'react'
import { HardDrive, Lock, User, ShieldCheck, Loader2, ArrowRight, Globe } from 'lucide-react'
import { useUserStore } from '~/store/useUserStore'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useT, useI18n, languages, Locale } from '~/lang'
import { CustomSelect } from '~/components/ui/CustomSelect'

interface LoginPageProps {
  onContinueAsGuest?: () => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onContinueAsGuest }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showOtp, setShowOtp] = useState(false)
  const otpInputRef = useRef<HTMLInputElement>(null)

  const { login, loading, guestDisabled } = useUserStore()
  const { getSetting, getLogoUrl } = useSettingsStore()
  const { locale, setLocale } = useI18n()
  const t = useT()

  const siteTitle = getSetting('site_title') || 'Drive'
  const logoUrl = getLogoUrl()
  const allowGuest = !guestDisabled && getSetting('allow_guest') !== 'false'

  useEffect(() => {
    if (showOtp && otpInputRef.current) {
      otpInputRef.current.focus()
    }
  }, [showOtp])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return

    const res = await login(username, password, showOtp ? otp : undefined)
    if (!res.success && res.needOtp) {
      setShowOtp(true)
    }
  }

  const langOptions = languages.map((l) => ({
    value: l.code,
    label: l.name,
  }))

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-slate-50 p-4 dark:bg-slate-950 font-sans select-none">
      {/* Background Decorative Ambient Blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />

      {/* Top Controls: Styled Language Switcher Dropdown */}
      <div className="absolute top-6 right-6 flex items-center space-x-2">
        <CustomSelect
          value={locale}
          onChange={(val) => setLocale(val as Locale)}
          options={langOptions}
          icon={<Globe className="h-3.5 w-3.5" />}
          align="end"
        />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-[380px] rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-200/40 dark:border-slate-800/80 dark:bg-slate-900 dark:shadow-none animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteTitle}
              className="h-14 w-14 object-contain rounded-2xl mb-3 shadow-xs"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 mb-3">
              <HardDrive className="h-6 w-6" />
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('login.login') || 'Sign In'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
            {siteTitle}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:focus:bg-slate-900"
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
                placeholder={t('login.password-tips') || 'Password'}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:focus:bg-slate-900"
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
                  placeholder={t('login.otp-tips') || '6-digit verification code'}
                  className="h-10 w-full rounded-xl border border-indigo-200 bg-indigo-50/30 pl-9 pr-3 text-xs font-mono tracking-widest transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-indigo-900 dark:bg-indigo-950/30"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center space-x-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{t('login.login') || 'Sign In'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Continue as Guest Button - only shown if guest is NOT disabled */}
        {allowGuest && onContinueAsGuest && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={onContinueAsGuest}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              {t('login.use_guest') || 'Continue as Guest'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
