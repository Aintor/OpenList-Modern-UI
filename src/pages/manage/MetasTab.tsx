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
        notify.error(resp.message || 'Failed to fetch meta rules')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to fetch meta rules')
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
        notify.success(t('global.delete_success') || 'Meta rule deleted successfully')
        setDeletingMeta(null)
        fetchMetas()
      } else {
        notify.error(resp.message || 'Failed to delete meta rule')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to delete meta rule')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {t('manage.sidemenu.metas') || 'Meta Protection Rules'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('metas.meta_desc') || '设置指定目录的访问密码、文件隐藏过滤模式与说明文档'}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
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
            <span>{t('global.add') || 'Add Rule'}</span>
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
          <>
            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-left text-xs">
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
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingMeta(m)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
              {metas.map((m) => (
                <div key={m.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {m.path}
                    </div>
                    {m.password && (
                      <span className="inline-flex items-center space-x-1 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        <Lock className="h-3 w-3 mr-0.5" />
                        <span>Protected</span>
                      </span>
                    )}
                  </div>

                  {m.hide && (
                    <div className="text-[11px] font-mono text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl flex items-center space-x-1.5">
                      <EyeOff className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{m.hide}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-50 dark:border-slate-800/40">
                    <button
                      onClick={() => setEditingMetaId(m.id)}
                      className="flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t('global.edit') || 'Edit'}</span>
                    </button>
                    <button
                      onClick={() => setDeletingMeta(m)}
                      className="flex items-center space-x-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t('global.delete') || 'Delete'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
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
        title={t('metas.delete_meta') || t('global.delete') || '删除元信息'}
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
