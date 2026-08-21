import React, { useState } from 'react'
import { r } from '~/utils/request'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { Download, Upload, Loader2 } from 'lucide-react'

export const BackupTab: React.FC = () => {
  const t = useT()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const [settings, users, storages, metas] = await Promise.all([
        r.get('/admin/setting/list'),
        r.get('/admin/user/list'),
        r.get('/admin/storage/list'),
        r.get('/admin/meta/list'),
      ])

      const backupData = {
        version: '4.2.5',
        timestamp: new Date().toISOString(),
        settings: settings.data || [],
        users: (users.data as any)?.content || [],
        storages: (storages.data as any)?.content || [],
        metas: (metas.data as any)?.content || [],
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      notify.success(t('global.save_success') || 'System backup JSON downloaded')
    } catch (e: any) {
      notify.error(e.message || 'Backup failed')
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (data.settings && Array.isArray(data.settings)) {
        await r.post('/admin/setting/save', data.settings)
      }

      notify.success(t('global.save_success') || 'Configuration restored successfully')
    } catch (e: any) {
      notify.error(`Invalid backup file: ${e.message}`)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-bold text-slate-800 dark:text-white">
          {t('manage.sidemenu.backup-restore') || 'Backup & Restore'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('storages.common.export_tips') ? '导出全站配置、存储挂载与用户账号为 JSON，或从备份一键还原' : 'Export server configuration or restore from JSON backup'}
        </p>
      </div>

      <div className="space-y-4">
        {/* Export Card */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mb-3">
              <Download className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('storages.common.export') || 'Export Backup'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('storages.common.export_title') || 'Download all settings, user accounts, and mount configurations'}
            </p>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-6 flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span>{t('storages.common.export') || 'Export JSON'}</span>
          </button>
        </div>

        {/* Import Card */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mb-3">
              <Upload className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('storages.common.import') || 'Restore Backup'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('storages.common.import_tips') || 'Upload exported .json file to restore settings'}
            </p>
          </div>

          <label className="mt-6 flex cursor-pointer items-center justify-center space-x-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors">
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span>{t('storages.common.import') || 'Select JSON File'}</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  )
}
