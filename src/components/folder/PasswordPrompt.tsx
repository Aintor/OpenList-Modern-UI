import React, { useState } from 'react'
import { Lock, ArrowRight, Loader2 } from 'lucide-react'
import { useObjStore } from '~/store/useObjStore'
import { useUserStore } from '~/store/useUserStore'
import { useT } from '~/lang'

import { UserMethods } from '~/types'

interface PasswordPromptProps {
  onGoToLogin?: () => void
}

export const PasswordPrompt: React.FC<PasswordPromptProps> = ({ onGoToLogin }) => {
  const { currentPath, loading, fetchPath } = useObjStore()
  const { user } = useUserStore()
  const t = useT()
  const [pwdInput, setPwdInput] = useState('')

  const isShare = currentPath.startsWith('/@s') || currentPath.startsWith('/@share')
  const title = isShare
    ? t('shares.input_password') || 'Please enter Share Code'
    : t('home.input_password') || 'Please input password'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwdInput.trim()) return
    fetchPath(currentPath, pwdInput, false, true)
  }

  return (
    <div className="flex h-[60vh] w-full items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-none">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-4 shadow-inner">
            <Lock className="h-6 w-6" />
          </div>

          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isShare
              ? (t('shares.input_password') || 'Please enter Share Code')
              : (t('home.input_password') || 'Please input password')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <input
              type="password"
              autoFocus
              value={pwdInput}
              onChange={(e) => setPwdInput(e.target.value)}
              placeholder={title}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !pwdInput.trim()}
            className="flex h-11 w-full items-center justify-center space-x-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{t('global.ok') || 'Confirm'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {!isShare && UserMethods.is_guest(user) && onGoToLogin && (
          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>{t('global.have_account') || 'Already have an account?'}</span>{' '}
            <button
              type="button"
              onClick={onGoToLogin}
              className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
            >
              {t('global.go_login') || 'Go to login'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
