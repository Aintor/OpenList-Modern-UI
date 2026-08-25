import React, { useState } from 'react'
import {
  Sliders,
  HardDrive,
  Users,
  Shield,
  ListTodo,
  Share2,
  Search,
  DatabaseBackup,
  UserCheck,
  DownloadCloud,
  Home,
} from 'lucide-react'
import { SettingsTab } from './SettingsTab'
import { StoragesTab } from './StoragesTab'
import { UsersTab } from './UsersTab'
import { MetasTab } from './MetasTab'
import { TasksTab } from './TasksTab'
import { SharesTab } from './SharesTab'
import { IndexesTab } from './IndexesTab'
import { BackupTab } from './BackupTab'
import { ProfileTab } from './ProfileTab'
import { OtherSettingsTab } from './OtherSettingsTab'
import { useT } from '~/lang'

export type ManageTab =
  | 'settings'
  | 'other_settings'
  | 'storages'
  | 'users'
  | 'metas'
  | 'tasks'
  | 'shares'
  | 'indexes'
  | 'backup'
  | 'profile'

interface ManageProps {
  onBackToFiles: () => void
}

export const Manage: React.FC<ManageProps> = ({ onBackToFiles }) => {
  const [activeTab, setActiveTab] = useState<ManageTab>('settings')
  const t = useT()

  const tabs: { id: ManageTab; name: string; icon: any }[] = [
    { id: 'settings', name: t('manage.sidemenu.settings') || 'Settings', icon: Sliders },
    { id: 'other_settings', name: t('manage.sidemenu.other') || 'Downloaders', icon: DownloadCloud },
    { id: 'storages', name: t('manage.sidemenu.storages') || 'Storages', icon: HardDrive },
    { id: 'users', name: t('manage.sidemenu.users') || 'Users', icon: Users },
    { id: 'metas', name: t('manage.sidemenu.metas') || 'Metas', icon: Shield },
    { id: 'tasks', name: t('manage.sidemenu.tasks') || 'Tasks', icon: ListTodo },
    { id: 'shares', name: t('manage.sidemenu.shares') || 'Shares', icon: Share2 },
    { id: 'indexes', name: t('manage.sidemenu.indexes') || 'Indexes', icon: Search },
    { id: 'backup', name: t('manage.sidemenu.backup-restore') || 'Backup', icon: DatabaseBackup },
    { id: 'profile', name: t('manage.sidemenu.profile') || 'Profile', icon: UserCheck },
  ]

  return (
    <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Mobile Top Sticky Category Bar */}
      <div className="lg:hidden sticky top-0 z-20 flex items-center space-x-2 border-b border-slate-200/80 bg-white/90 px-3.5 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 overflow-x-auto scrollbar-none shrink-0 shadow-xs">
        {/* Back to Home Button */}
        <button
          onClick={onBackToFiles}
          className="flex items-center space-x-1.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shrink-0 transition-colors cursor-pointer shadow-xs"
        >
          <Home className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>{t('manage.sidemenu.home') || '主页'}</span>
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Scrollable Category Pills */}
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.name}</span>
            </button>
          )
        })}
      </div>

      {/* Desktop Left Sidebar Menu */}
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-slate-200/80 bg-white/80 p-4 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80 shrink-0">
        <div className="space-y-3">
          {/* Main Home Entry */}
          <button
            onClick={onBackToFiles}
            className="flex w-full items-center space-x-2.5 rounded-2xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-all cursor-pointer shadow-xs"
          >
            <Home className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('manage.sidemenu.home') || '主页'}</span>
          </button>

          <div className="h-px bg-slate-200/80 dark:bg-slate-800/80 my-1" />

          <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-170px)] pr-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center space-x-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Main Manage Panel Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'other_settings' && <OtherSettingsTab />}
        {activeTab === 'storages' && <StoragesTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'metas' && <MetasTab />}
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'shares' && <SharesTab />}
        {activeTab === 'indexes' && <IndexesTab />}
        {activeTab === 'backup' && <BackupTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>
    </div>
  )
}
