import React, { useEffect, useState } from 'react'
import { r } from '~/utils/request'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { useSettingsStore } from '~/store/useSettingsStore'
import { formatDate } from '~/utils/str'
import {
  Share2,
  Trash2,
  RefreshCw,
  Loader2,
  Copy,
  Lock,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
} from 'lucide-react'
import { ConfirmModal } from '~/components/ui/ConfirmModal'

export interface ShareItem {
  id: string
  files: string[]
  creator: string
  creator_role: number
  expires: string | null
  pwd?: string
  accessed: number
  max_accessed: number
  disabled: boolean
  remark?: string
  readme?: string
}

export const SharesTab: React.FC = () => {
  const t = useT()
  const { getSetting } = useSettingsStore()
  const [shares, setShares] = useState<ShareItem[]>([])
  const [loading, setLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingShare, setDeletingShare] = useState<ShareItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchShares = async () => {
    setLoading(true)
    try {
      // The real backend endpoint in OpenList is /share/list (not /admin/share/list)
      const resp = await r.get<{ content: ShareItem[]; total: number }>('/share/list')
      if (resp.code === 200 && resp.data) {
        setShares(resp.data.content || [])
      } else {
        setShares([])
      }
    } catch (e: any) {
      setShares([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShares()
  }, [])

  const handleConfirmDelete = async () => {
    if (!deletingShare) return
    setDeleteLoading(true)
    try {
      const resp = await r.post(`/share/delete?id=${deletingShare.id}`)
      if (resp.code === 200) {
        notify.success(t('global.delete_success') || 'Share link deleted')
        setDeletingShare(null)
        fetchShares()
      } else {
        notify.error(resp.message || 'Delete failed')
      }
    } catch (e: any) {
      notify.error(e.message || 'Delete failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleEnable = async (share: ShareItem) => {
    setTogglingId(share.id)
    const action = share.disabled ? 'enable' : 'disable'
    try {
      const resp = await r.post(`/share/${action}?id=${share.id}`)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || `Share link ${share.disabled ? 'enabled' : 'disabled'}`)
        fetchShares()
      } else {
        notify.error(resp.message || 'Action failed')
      }
    } catch (e: any) {
      notify.error(e.message || 'Action failed')
    } finally {
      setTogglingId(null)
    }
  }

  const handleCopyLink = (share: ShareItem) => {
    const link = `${window.location.origin}/@s/${share.id}`
    navigator.clipboard.writeText(link)
    notify.success(t('global.copied') || 'Share link copied')
  }

  const handleCopyFullMessage = (share: ShareItem) => {
    const siteTitle = getSetting('site_title') || 'Drive'
    const link = `${window.location.origin}/@s/${share.id}`
    let msg = `【${siteTitle}】${t('home.toolbar.share') || 'Shared'}: ${share.files.join(', ')}\nLink: ${link}`
    if (share.pwd) {
      msg += `\n${t('shares.pwd') || 'Password'}: ${share.pwd}`
    }
    if (share.expires) {
      msg += `\n${t('shares.expires') || 'Expires'}: ${new Date(share.expires).toLocaleString()}`
    }
    navigator.clipboard.writeText(msg)
    notify.success(t('global.copied') || 'Share message copied')
  }

  const getStatusBadge = (share: ShareItem) => {
    if (share.disabled) {
      return (
        <span className="inline-flex items-center space-x-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <AlertCircle className="h-3 w-3 mr-0.5" />
          <span>{t('shares.status_list.disabled') || 'Disabled'}</span>
        </span>
      )
    }

    const isExpired = share.expires && new Date(share.expires).getTime() < Date.now()
    const isLimitReached = share.max_accessed > 0 && share.accessed >= share.max_accessed

    if (isExpired || isLimitReached || share.files.length === 0) {
      return (
        <span className="inline-flex items-center space-x-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-950 dark:text-rose-400">
          <AlertCircle className="h-3 w-3 mr-0.5" />
          <span>{t('shares.status_list.invalid') || 'Expired / Reached Limit'}</span>
        </span>
      )
    }

    return (
      <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3 mr-0.5" />
        <span>{t('shares.status_list.work') || 'Active'}</span>
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {t('manage.sidemenu.shares') || 'Shares Management'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('shares.no_permission_tip') ? '查看、复制与停用所有公开分享链接' : 'Inspect, copy, toggle, and revoke all generated file and folder share links'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchShares}
            disabled={loading}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('global.refresh') || 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Share Links Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex h-48 items-center justify-center space-x-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="text-sm">{t('global.loading') || 'Loading share links...'}</span>
          </div>
        ) : shares.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Share2 className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2 stroke-[1.5]" />
            <p className="text-sm font-semibold">{t('global.empty') || 'No active share links'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="border-b border-slate-200/80 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="p-3.5">{t('shares.files') || 'Target Path'}</th>
                  <th className="p-3.5">{t('shares.id') || 'Share Code'}</th>
                  <th className="p-3.5">{t('shares.creator') || 'Creator'}</th>
                  <th className="p-3.5">{t('shares.pwd') || 'Password'}</th>
                  <th className="p-3.5">{t('shares.accessed') || 'Accessed'}</th>
                  <th className="p-3.5">{t('shares.expires') || 'Expires'}</th>
                  <th className="p-3.5">{t('shares.status') || 'Status'}</th>
                  <th className="p-3.5 text-right">{t('global.operations') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {shares.map((s) => {
                  const accessDisplay = s.max_accessed > 0 ? `${s.accessed} / ${s.max_accessed}` : `${s.accessed}`

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 max-w-[200px] truncate font-semibold text-slate-800 dark:text-slate-200" title={s.files?.join(', ')}>
                        {s.files?.join(', ') || '/'}
                      </td>
                      <td className="p-3.5 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {s.id}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">
                        {s.creator || 'admin'}
                      </td>
                      <td className="p-3.5 font-mono">
                        {s.pwd ? (
                          <span className="inline-flex items-center space-x-1 text-slate-700 dark:text-slate-300">
                            <Lock className="h-3 w-3 text-indigo-500 mr-1" />
                            <span>{s.pwd}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">
                        {accessDisplay}
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {s.expires ? formatDate(s.expires) : (t('global.permanent') || 'Permanent')}
                      </td>
                      <td className="p-3.5">
                        {getStatusBadge(s)}
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleCopyFullMessage(s)}
                          title={t('shares.copy_msg') || 'Copy share details'}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCopyLink(s)}
                          title="Copy Link"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleEnable(s)}
                          disabled={togglingId === s.id}
                          title={s.disabled ? (t('global.enable') || 'Enable') : (t('global.disable') || 'Disable')}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors"
                        >
                          {s.disabled ? (
                            <ToggleLeft className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ToggleRight className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeletingShare(s)}
                          title={t('global.delete') || 'Delete'}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deletingShare !== null}
        title={t('global.delete') || '删除分享'}
        description={
          deletingShare
            ? t('global.delete_confirm', { name: deletingShare.id })
            : ''
        }
        loading={deleteLoading}
        onClose={() => setDeletingShare(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
