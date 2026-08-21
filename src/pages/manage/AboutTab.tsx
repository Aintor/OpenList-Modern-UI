import React from 'react'
import { HardDrive, CheckCircle2 } from 'lucide-react'
import { useSettingsStore } from '~/store/useSettingsStore'

export const AboutTab: React.FC = () => {
  const { getSetting, getLogoUrl } = useSettingsStore()
  const siteTitle = getSetting('site_title') || 'Drive System'
  const logoUrl = getLogoUrl()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center space-x-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {logoUrl ? (
          <img src={logoUrl} alt={siteTitle} className="h-16 w-16 object-contain rounded-2xl" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-2xl shadow-md shadow-indigo-500/20">
            <HardDrive className="h-8 w-8" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {siteTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cloud Storage Management Platform
          </p>
          <div className="mt-2 flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              <span>v4.2.5</span>
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
          Architecture Highlights
        </h3>
        <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-400">
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="font-bold text-slate-800 dark:text-slate-200">Frontend Stack</span>
            <p className="mt-1 text-[11px]">React 18 + Vite 6 + Tailwind CSS v4</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="font-bold text-slate-800 dark:text-slate-200">State Management</span>
            <p className="mt-1 text-[11px]">Zustand fine-grained reactivity</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="font-bold text-slate-800 dark:text-slate-200">Video Player</span>
            <p className="mt-1 text-[11px]">Artplayer with hardware acceleration</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <span className="font-bold text-slate-800 dark:text-slate-200">Selection Engine</span>
            <p className="mt-1 text-[11px]">Vanilla ViSelect with native modifiers</p>
          </div>
        </div>
      </div>
    </div>
  )
}
