import React, { useEffect, useState } from 'react'
import { r } from '~/utils/request'
import { User, Resp } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { Users, Trash2, RefreshCw, Loader2, ShieldCheck, User as UserIcon, Plus, Edit3 } from 'lucide-react'
import { AddOrEditUserModal } from './AddOrEditUserModal'
import { ConfirmModal } from '~/components/ui/ConfirmModal'

export const UsersTab: React.FC = () => {
  const t = useT()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const resp: Resp<{ content: User[]; total: number }> = await r.get('/admin/user/list')
      if (resp.code === 200 && resp.data) {
        setUsers(resp.data.content || [])
      } else {
        notify.error(resp.message || 'Failed to fetch users')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleConfirmDelete = async () => {
    if (!deletingUser) return
    setDeleteLoading(true)
    try {
      const resp: Resp<any> = await r.post(`/admin/user/delete?id=${deletingUser.id}`)
      if (resp.code === 200) {
        notify.success(t('global.delete_success') || 'User deleted successfully')
        setDeletingUser(null)
        fetchUsers()
      } else {
        notify.error(resp.message || 'Failed to delete user')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to delete user')
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
            {t('manage.sidemenu.users') || 'User Management'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('users.user_desc') || '管理用户访问角色、权限体系与主目录限制'}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
          <button
            onClick={fetchUsers}
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
            <span>{t('global.add') || 'Add User'}</span>
          </button>
        </div>
      </div>

      {/* Users List Table & Cards */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex h-48 items-center justify-center space-x-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="text-sm">{t('global.loading') || 'Loading users...'}</span>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Users className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2 stroke-[1.5]" />
            <p className="text-sm font-semibold">{t('global.empty') || 'No users found'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-left text-xs">
              <thead className="border-b border-slate-200/80 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="p-3.5">{t('users.username') || 'User'}</th>
                  <th className="p-3.5">{t('users.role') || 'Role'}</th>
                  <th className="p-3.5">{t('users.base_path') || 'Base Path'}</th>
                  <th className="p-3.5 text-right">{t('global.operations') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center space-x-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold uppercase dark:bg-indigo-950 dark:text-indigo-400">
                          {u.username.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{u.username}</div>
                          {u.disabled && (
                            <span className="text-[10px] text-rose-500 font-semibold">{t('users.disabled') || 'Disabled'}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        u.role === 2
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {u.role === 2 ? <ShieldCheck className="h-3 w-3 mr-1" /> : <UserIcon className="h-3 w-3 mr-1" />}
                        <span>{u.role === 2 ? (t('users.admin_user') || 'Admin') : (t('users.general_user') || 'General')}</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                      {u.base_path || '/'}
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => setEditingUserId(u.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {u.id !== 1 && (
                        <button
                          onClick={() => setDeletingUser(u)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
              {users.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-bold uppercase dark:bg-indigo-950 dark:text-indigo-400 text-sm">
                        {u.username.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">{u.username}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {t('users.base_path') || 'Path'}: {u.base_path || '/'}
                        </div>
                      </div>
                    </div>

                    <span className={`inline-flex items-center space-x-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      u.role === 2
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {u.role === 2 ? <ShieldCheck className="h-3 w-3 mr-1" /> : <UserIcon className="h-3 w-3 mr-1" />}
                      <span>{u.role === 2 ? (t('users.admin_user') || 'Admin') : (t('users.general_user') || 'General')}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-50 dark:border-slate-800/40">
                    <button
                      onClick={() => setEditingUserId(u.id)}
                      className="flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t('global.edit') || 'Edit'}</span>
                    </button>
                    {u.id !== 1 && (
                      <button
                        onClick={() => setDeletingUser(u)}
                        className="flex items-center space-x-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{t('global.delete') || 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <AddOrEditUserModal
        userId={editingUserId}
        isOpen={isAddOpen || editingUserId !== null}
        onClose={() => {
          setIsAddOpen(false)
          setEditingUserId(null)
        }}
        onSuccess={fetchUsers}
      />

      <ConfirmModal
        isOpen={deletingUser !== null}
        title={t('users.delete_user') || t('global.delete') || '删除用户'}
        description={
          deletingUser
            ? t('global.delete_confirm', { name: deletingUser.username })
            : ''
        }
        loading={deleteLoading}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
