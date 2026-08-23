import React, { useEffect, useState } from 'react'
import { r } from '~/utils/request'
import { Meta, Resp } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { Shield, Trash2, RefreshCw, Loader2, Lock, EyeOff, Plus, Edit3 } from 'lucide-react'
import { AddOrEditMetaModal } from './AddOrEditMetaModal'
import { ConfirmModal } from '~/components/ui/ConfirmModal'

export const MetasTab: React.FC = () => {
  const t = useT()
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(false)
  const [editingMetaId, setEditingMetaId] = useState<number | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [deletingMeta, setDeletingMeta] = useState<Meta | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchMetas = async () => {
    setLoading(true)
    try {
      const resp: Resp<{ content: Meta[]; total: number }> = await r.get('/admin/meta/list')
      if (resp.code === 200 && resp.data) {
        setMetas(resp.data.content || [])
      } else {
        notify.error(resp.message || 'Failed to fetch metas')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to fetch metas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetas()
  }, [])

  const handleConfirmDelete = async () => {
    if (!deletingMeta) return
    setDeleteLoading(true)
    try {
      const resp: Resp<any> = await r.post(`/admin/meta/delete?id=${deletingMeta.id}`)
      if (resp.code === 200) {
        notify.success(t('global.delete_success') || 'Meta rule deleted')
        setDeletingMeta(null)
        fetchMetas()
      } else {
        notify.error(resp.message || 'Failed to delete meta')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to delete meta')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {t('manage.sidemenu.metas') || 'Meta Rules'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('metas.readme_help') ? '设置目录访问密码、正则表达式隐藏与公告渲染' : 'Configure passwords, hidden regex patterns, and write permissions for directory paths'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchMetas}
            disabled={loading}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('global.refresh') || 'Refresh'}</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('global.add') || 'Add Meta Rule'}</span>
          </button>
        </div>
      </div>

      {/* Meta Rules List */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex h-48 items-center justify-center space-x-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="text-sm">{t('global.loading') || 'Loading meta rules...'}</span>
          </div>
        ) : metas.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Shield className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2 stroke-[1.5]" />
            <p className="text-sm font-semibold">{t('global.empty') || 'No meta rules created yet'}</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="p-3.5">{t('metas.path') || 'Path'}</th>
                <th className="p-3.5">{t('metas.password') || 'Password'}</th>
                <th className="p-3.5">{t('metas.hide') || 'Hide Pattern'}</th>
                <th className="p-3.5 text-right">{t('global.operations') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {metas.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">
                    {m.path}
                  </td>
                  <td className="p-3.5">
                    {m.password ? (
                      <span className="inline-flex items-center space-x-1 text-amber-600 dark:text-amber-400">
                        <Lock className="h-3.5 w-3.5 mr-1" />
                        <span>Protected</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3.5 font-mono text-[11px] text-slate-500">
                    {m.hide ? (
                      <span className="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-400">
                        <EyeOff className="h-3.5 w-3.5 mr-1" />
                        <span>{m.hide}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3.5 text-right space-x-1">
                    <button
                      onClick={() => setEditingMetaId(m.id)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingMeta(m)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddOrEditMetaModal
        metaId={editingMetaId}
        isOpen={isAddOpen || editingMetaId !== null}
        onClose={() => {
          setIsAddOpen(false)
          setEditingMetaId(null)
        }}
        onSuccess={fetchMetas}
      />

      <ConfirmModal
        isOpen={deletingMeta !== null}
        title={t('global.delete') || '删除元信息'}
        description={
          deletingMeta
            ? t('global.delete_confirm', { name: deletingMeta.path })
            : ''
        }
        loading={deleteLoading}
        onClose={() => setDeletingMeta(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
