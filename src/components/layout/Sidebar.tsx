import React from 'react'
import {
  Folder,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Files,
} from 'lucide-react'
import { ObjType } from '~/types'
import { useObjStore } from '~/store/useObjStore'
import { useT } from '~/lang'

interface SidebarProps {
  currentFilter?: ObjType
  onSelectFilter: (type?: ObjType) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentFilter,
  onSelectFilter,
}) => {
  const { objs } = useObjStore()
  const t = useT()

  const categories = [
    {
      id: undefined,
      label: t('global.types.all') || 'All',
      icon: Files,
    },
    {
      id: ObjType.IMAGE,
      label: t('global.types.image') || 'Images',
      icon: ImageIcon,
    },
    {
      id: ObjType.VIDEO,
      label: t('global.types.video') || 'Videos',
      icon: Video,
    },
    {
      id: ObjType.AUDIO,
      label: t('global.types.audio') || 'Audio',
      icon: Music,
    },
    {
      id: ObjType.TEXT,
      label: t('global.types.doc') || 'Documents',
      icon: FileText,
    },
  ]

  // Count items
  const folderCount = objs.filter((o) => o.is_dir).length
  const fileCount = objs.filter((o) => !o.is_dir).length

  return (
    <aside className="hidden h-full w-56 flex-col justify-between border-r border-slate-200/80 bg-white/50 p-4 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/50 md:flex">
      {/* Quick Media Filter Categories */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          {t('tasks.filter') || 'Filter'}
        </div>
        {categories.map((cat) => {
          const Icon = cat.icon
          const isActive = currentFilter === cat.id
          return (
            <button
              key={cat.label}
              onClick={() => onSelectFilter(cat.id)}
              className={`flex w-full items-center space-x-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* Directory Stats Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Folder className="h-4 w-4 text-indigo-500" />
          <span>{t('home.obj.count.count_folders', { folders: folderCount })}</span>
        </div>
        <div className="mt-1 flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Files className="h-4 w-4 text-slate-400" />
          <span>{t('home.obj.count.count_files', { files: fileCount })}</span>
        </div>
      </div>
    </aside>
  )
}
