import React, { useEffect, useState } from 'react'
import { r } from '~/utils/request'
import { Storage, Resp } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import {
  HardDrive,
  Trash2,
  Power,
  RefreshCw,
  Loader2,
  FolderOpen,
  Plus,
  Edit3,
} from 'lucide-react'
import { AddOrEditStorageModal } from './AddOrEditStorageModal'
import { ConfirmModal } from '~/components/ui/ConfirmModal'

export const StoragesTab: React.FC = () => {
  const t = useT()
  const [storages, setStorages] = useState<Storage[]>([])
  const [loading, setLoading] = useState(false)
  const [editingStorageId, setEditingStorageId] = useState<number | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deletingStorage, setDeletingStorage] = useState<Storage | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchStorages = async () => {
    setLoading(true)
    try {
      const resp: Resp<{ content: Storage[]; total: number }> = await r.get('/admin/storage/list')
      if (resp.code === 200 && resp.data) {
        setStorages(resp.data.content || [])
      } else {
        notify.error(resp.message || 'Failed to fetch storages')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to fetch storages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStorages()
  }, [])

  const handleToggleEnable = async (storage: Storage) => {
    const action = storage.disabled ? 'enable' : 'disable'
    try {
      const resp: Resp<any> = await r.post(`/admin/storage/${action}?id=${storage.id}`)
      if (resp.code === 200) {
        notify.success(t('global.update_success') || `Storage ${action}d successfully`)
        fetchStorages()
      } else {
        notify.error(resp.message || `Failed to ${action} storage`)
      }
    } catch (e: any) {
      notify.error(e.message || `Failed to ${action} storage`)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingStorage) return
    setDeleteLoading(true)
    try {
      const resp: Resp<any> = await r.post(`/admin/storage/delete?id=${deletingStorage.id}`)
      if (resp.code === 200) {
        notify.success(t('global.delete_success') || 'Storage mount deleted')
        setDeletingStorage(null)
        fetchStorages()
      } else {
        notify.error(resp.message || 'Failed to delete storage')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to delete storage')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {t('manage.sidemenu.storages') || 'Storage Mounts'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('storages.common.mount_path-tips') || 'Manage attached clouds, local disks, S3 buckets, and WebDAV endpoints'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchStorages}
            disabled={loading}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('global.refresh') || 'Refresh'}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('global.add') || 'Add Storage'}</span>
          </button>
        </div>
      </div>

      {/* Storage Cards List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center space-x-2 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <span className="text-sm">{t('global.loading') || 'Loading storages...'}</span>
        </div>
      ) : storages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400 dark:border-slate-800">
          <HardDrive className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2 stroke-[1.5]" />
          <p className="text-sm font-semibold">{t('global.empty') || 'No storages mounted yet'}</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-3 flex items-center space-x-1 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('global.add') || 'Add Storage'}</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {storages.map((storage) => (
            <div
              key={storage.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-200">
                      {storage.mount_path}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      storage.disabled
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        : storage.status === 'work' || !storage.status
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                    }`}
                  >
                    {storage.disabled ? t('storages.table_fields.status.disabled') || 'Disabled' : t('storages.table_fields.status.work') || 'Active'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 dark:text-slate-500">{t('storages.common.driver') || '驱动'}:</span>
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-mono text-[11px]">
                      {storage.driver}
                    </span>
                  </div>
                  {storage.remark && (
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 dark:text-slate-500">{t('storages.common.remark') || '备注'}:</span>
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{storage.remark}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 flex items-center justify-end space-x-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  onClick={() => setEditingStorageId(storage.id)}
                  title="Edit storage"
                  className="flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{t('global.edit') || 'Edit'}</span>
                </button>

                <button
                  onClick={() => handleToggleEnable(storage)}
                  title={storage.disabled ? 'Enable storage' : 'Disable storage'}
                  className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    storage.disabled
                      ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>{storage.disabled ? t('global.enable') || 'Enable' : t('global.disable') || 'Disable'}</span>
                </button>

                <button
                  onClick={() => setDeletingStorage(storage)}
                  title="Delete storage mount"
                  className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Storage Modal */}
      <AddOrEditStorageModal
        storageId={editingStorageId}
        isOpen={isAddModalOpen || editingStorageId !== null}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingStorageId(null)
        }}
        onSuccess={fetchStorages}
      />

      <ConfirmModal
        isOpen={deletingStorage !== null}
        title={t('global.delete') || '删除存储'}
        description={
          deletingStorage
            ? t('global.delete_confirm', { name: deletingStorage.mount_path })
            : ''
        }
        loading={deleteLoading}
        onClose={() => setDeletingStorage(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
