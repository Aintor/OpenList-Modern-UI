import React, { useEffect, useState } from 'react'
import { r } from '~/utils/request'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { DownloadCloud, HardDrive, Save, Loader2 } from 'lucide-react'

export const OtherSettingsTab: React.FC = () => {
  const t = useT()
  const [aria2Uri, setAria2Uri] = useState('')
  const [aria2Secret, setAria2Secret] = useState('')
  const [qbitUrl, setQbitUrl] = useState('')
  const [qbitSeedTime, setQbitSeedTime] = useState('')
  const [transmissionUrl, setTransmissionUrl] = useState('')
  const [transmissionSeedTime, setTransmissionSeedTime] = useState('')

  // Cloud drive temp dirs
  const [tempDirs, setTempDirs] = useState<Record<string, string>>({
    '115_temp_dir': '',
    '115_open_temp_dir': '',
    '123_temp_dir': '',
    '123_open_temp_dir': '',
    '123_open_callback_url': '',
    'pikpak_temp_dir': '',
    'thunder_temp_dir': '',
    'thunderx_temp_dir': '',
    'thunder_browser_temp_dir': '',
    'guangyapan_temp_dir': '',
  })

  const [loading, setLoading] = useState(false)
  const [savingSection, setSavingSection] = useState<string | null>(null)

  const fetchDownloaderSettings = async () => {
    setLoading(true)
    try {
      const resp = await r.get<any[]>('/admin/setting/list?groups=5,0')
      if (resp.code === 200 && resp.data) {
        const list = resp.data
        setAria2Uri(list.find((i: any) => i.key === 'aria2_uri')?.value || '')
        setAria2Secret(list.find((i: any) => i.key === 'aria2_secret')?.value || '')
        setQbitUrl(list.find((i: any) => i.key === 'qbittorrent_url')?.value || '')
        setQbitSeedTime(list.find((i: any) => i.key === 'qbittorrent_seedtime')?.value || '')
        setTransmissionUrl(list.find((i: any) => i.key === 'transmission_uri')?.value || '')
        setTransmissionSeedTime(list.find((i: any) => i.key === 'transmission_seedtime')?.value || '')

        const updatedDirs: Record<string, string> = { ...tempDirs }
        Object.keys(updatedDirs).forEach((k) => {
          const found = list.find((i: any) => i.key === k)
          if (found) updatedDirs[k] = found.value
        })
        setTempDirs(updatedDirs)
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDownloaderSettings()
  }, [])

  const handleSaveAria2 = async () => {
    setSavingSection('aria2')
    try {
      const resp = await r.post<string>('/admin/setting/set_aria2', { uri: aria2Uri, secret: aria2Secret })
      if (resp.code === 200) {
        notify.success(`Aria2: ${resp.data || t('global.save_success') || 'OK'}`)
      } else {
        notify.error(resp.message || 'Failed to connect Aria2')
      }
    } catch (e: any) {
      notify.error(e.message || 'Save failed')
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveQbit = async () => {
    setSavingSection('qbit')
    try {
      const resp = await r.post<string>('/admin/setting/set_qbit', { url: qbitUrl, seedtime: qbitSeedTime })
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'qBittorrent settings saved')
      } else {
        notify.error(resp.message || 'Failed to connect qBittorrent')
      }
    } catch (e: any) {
      notify.error(e.message || 'Save failed')
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveTransmission = async () => {
    setSavingSection('transmission')
    try {
      const resp = await r.post<string>('/admin/setting/set_transmission', { uri: transmissionUrl, seedtime: transmissionSeedTime })
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Transmission settings saved')
      } else {
        notify.error(resp.message || 'Failed to connect Transmission')
      }
    } catch (e: any) {
      notify.error(e.message || 'Save failed')
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveTempDirs = async () => {
    setSavingSection('temp_dirs')
    try {
      const payload = Object.entries(tempDirs).map(([key, value]) => ({ key, value }))
      const resp = await r.post('/admin/setting/save', payload)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Cloud drive transfer directories saved')
      } else {
        notify.error(resp.message || 'Failed to save directories')
      }
    } catch (e: any) {
      notify.error(e.message || 'Save failed')
    } finally {
      setSavingSection(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-base font-bold text-slate-800 dark:text-white">
          {t('manage.sidemenu.other') || 'Offline Downloaders & Extensions'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('home.toolbar.offline_download_enhanced.download_tool') || 'Configure Aria2, qBittorrent, Transmission, and cloud drive transfer paths'}
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center space-x-2 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="text-sm">{t('global.loading') || 'Loading downloaders...'}</span>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Aria2 Card */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
              <DownloadCloud className="h-4 w-4 text-indigo-500" />
              <span>{t('settings_other.aria2') || 'Aria2 RPC'}</span>
            </h4>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('settings.aria2_uri') || 'RPC URI'}
                </label>
                <input
                  type="text"
                  value={aria2Uri}
                  onChange={(e) => setAria2Uri(e.target.value)}
                  placeholder="http://127.0.0.1:6800/jsonrpc"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('settings.aria2_secret') || 'RPC Secret'}
                </label>
                <input
                  type="password"
                  value={aria2Secret}
                  onChange={(e) => setAria2Secret(e.target.value)}
                  placeholder="token:..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveAria2}
                disabled={savingSection === 'aria2'}
                className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {savingSection === 'aria2' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{t('global.save') || 'Save Aria2'}</span>
              </button>
            </div>
          </div>

          {/* qBittorrent Card */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
              <DownloadCloud className="h-4 w-4 text-sky-500" />
              <span>{t('settings_other.qbittorrent') || 'qBittorrent WebUI'}</span>
            </h4>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('settings.qbittorrent_url') || 'WebUI URL'}
                </label>
                <input
                  type="text"
                  value={qbitUrl}
                  onChange={(e) => setQbitUrl(e.target.value)}
                  placeholder="http://admin:adminadmin@127.0.0.1:8080"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('settings.qbittorrent_seedtime') || 'Seed Time (Minutes)'}
                </label>
                <input
                  type="number"
                  value={qbitSeedTime}
                  onChange={(e) => setQbitSeedTime(e.target.value)}
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveQbit}
                disabled={savingSection === 'qbit'}
                className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {savingSection === 'qbit' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{t('global.save') || 'Save qBittorrent'}</span>
              </button>
            </div>
          </div>

          {/* Transmission Card */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
              <DownloadCloud className="h-4 w-4 text-rose-500" />
              <span>{t('settings_other.transmission') || 'Transmission RPC'}</span>
            </h4>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('settings.transmission_uri') || 'RPC URL'}
                </label>
                <input
                  type="text"
                  value={transmissionUrl}
                  onChange={(e) => setTransmissionUrl(e.target.value)}
                  placeholder="http://admin:admin@127.0.0.1:9091/transmission/rpc"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('settings.transmission_seedtime') || 'Seed Time (Minutes)'}
                </label>
                <input
                  type="number"
                  value={transmissionSeedTime}
                  onChange={(e) => setTransmissionSeedTime(e.target.value)}
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveTransmission}
                disabled={savingSection === 'transmission'}
                className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {savingSection === 'transmission' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{t('global.save') || 'Save Transmission'}</span>
              </button>
            </div>
          </div>

          {/* Cloud Drives Temp Dirs Card */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
              <HardDrive className="h-4 w-4 text-emerald-500" />
              <span>{t('settings_other.offline_download_temp_dir') || 'Cloud Drive Transfer Directories'}</span>
            </h4>
            <div className="space-y-4">
              {Object.keys(tempDirs).map((k) => (
                <div key={k} className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t(`settings_other.${k}`) || k}
                  </label>
                  <input
                    type="text"
                    value={tempDirs[k]}
                    onChange={(e) => setTempDirs({ ...tempDirs, [k]: e.target.value })}
                    placeholder="/"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveTempDirs}
                disabled={savingSection === 'temp_dirs'}
                className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {savingSection === 'temp_dirs' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{t('global.save') || 'Save Transfer Dirs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
