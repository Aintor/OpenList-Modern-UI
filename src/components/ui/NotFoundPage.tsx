import React from 'react'
import { FolderX, Home } from 'lucide-react'
import { useT } from '~/lang'

interface NotFoundPageProps {
  onGoHome: () => void
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onGoHome }) => {
  const t = useT()

  return (
    <div className="flex h-[60vh] w-full items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-none">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-inner dark:bg-indigo-950/60 dark:text-indigo-400">
          <FolderX className="h-6 w-6" />
        </div>

        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('global.not_found.title') || '目录不存在'}
        </h2>

        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {t('global.not_found.subtitle') || '请检查访问路径或返回首页'}
        </p>

        <button
          type="button"
          onClick={onGoHome}
          className="mt-6 flex h-11 w-full items-center justify-center space-x-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer"
        >
          <Home className="h-4 w-4" />
          <span>{t('global.not_found.go_home') || '返回首页'}</span>
        </button>
      </div>
    </div>
  )
}
