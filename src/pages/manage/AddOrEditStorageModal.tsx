import React, { useEffect, useState } from 'react'
import { X, HardDrive, Loader2, Save } from 'lucide-react'
import { r } from '~/utils/request'
import { DriverItem, Storage, Type, Resp } from '~/types'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { CustomSelect } from '~/components/ui/CustomSelect'

interface DriverInfo {
  common: DriverItem[]
  additional: DriverItem[]
  config: {
    name: string
    alert?: string
    need_ms?: boolean
  }
}

type Drivers = Record<string, DriverInfo>

interface AddOrEditStorageModalProps {
  storageId?: number | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const AddOrEditStorageModal: React.FC<AddOrEditStorageModalProps> = ({
  storageId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const t = useT()
  const [drivers, setDrivers] = useState<Drivers>({})
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [mountPath, setMountPath] = useState('')
  const [remark, setRemark] = useState('')
  const [commonValues, setCommonValues] = useState<Record<string, any>>({})
  const [additionalValues, setAdditionalValues] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    r.get<Drivers>('/admin/driver/list').then(async (resp) => {
      if (resp.code === 200 && resp.data) {
        setDrivers(resp.data)
        const driverKeys = Object.keys(resp.data)

        if (storageId) {
          // Editing existing storage
          const getResp: Resp<Storage> = await r.get(`/admin/storage/get?id=${storageId}`)
          if (getResp.code === 200 && getResp.data) {
            const data = getResp.data
            setSelectedDriver(data.driver)
            setMountPath(data.mount_path)
            setRemark(data.remark || '')

            try {
              setAdditionalValues(JSON.parse(data.addition || '{}'))
            } catch (e) {
              setAdditionalValues({})
            }
            setCommonValues(data as any)
          }
        } else {
          // Adding new storage
          const defaultDriver = driverKeys[0] || 'Local'
          setSelectedDriver(defaultDriver)
          setMountPath('/')
          setRemark('')
          setCommonValues({})
          setAdditionalValues({})
        }
      }
      setLoading(false)
    })
  }, [isOpen, storageId])

  if (!isOpen) return null

  const currentDriverInfo = drivers[selectedDriver]

  const handleDriverChange = (driver: string) => {
    setSelectedDriver(driver)
    const info = drivers[driver]
    if (!info) return

    const newCommon: Record<string, any> = {}
    info.common.forEach((item) => {
      newCommon[item.name] = item.default || (item.type === Type.Bool ? false : '')
    })

    const newAdd: Record<string, any> = {}
    info.additional.forEach((item) => {
      newAdd[item.name] = item.default || (item.type === Type.Bool ? false : '')
    })

    setCommonValues(newCommon)
    setAdditionalValues(newAdd)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mountPath.startsWith('/')) {
      notify.error(t('storages.common.mount_path-tips') || 'Mount path must start with /')
      return
    }

    setSubmitting(true)
    const payload: Partial<Storage> = {
      ...commonValues,
      id: storageId || undefined,
      driver: selectedDriver,
      mount_path: mountPath,
      remark: remark,
      addition: JSON.stringify(additionalValues),
    }

    try {
      const endpoint = storageId ? '/admin/storage/update' : '/admin/storage/create'
      const resp: Resp<any> = await r.post(endpoint, payload)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Storage saved successfully')
        onSuccess()
        onClose()
      } else {
        notify.error(resp.message || 'Failed to save storage')
      }
    } catch (err: any) {
      notify.error(err.message || 'Failed to save storage')
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (
    item: DriverItem,
    values: Record<string, any>,
    setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    isCommon: boolean = false
  ) => {
    const val = values[item.name] ?? item.default ?? ''
    const labelKey = isCommon
      ? `storages.common.${item.name}`
      : `drivers.${selectedDriver}.${item.name}`
    const label = t.has(labelKey) ? t(labelKey) : item.name

    const descKey = isCommon
      ? `storages.common.${item.name}-tips`
      : `drivers.${selectedDriver}.${item.name}-tips`
    const desc = t.has(descKey) ? t(descKey) : (item.description || item.help || '')

    return (
      <div key={item.name} className="space-y-1.5">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
          {label} {item.required && <span className="text-rose-500">*</span>}
        </label>
        {desc && (
          <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed">
            {desc}
          </p>
        )}

        <div className="pt-0.5">
          {item.type === Type.Bool ? (
            <div className="flex h-10 items-center">
              <button
                type="button"
                role="switch"
                aria-checked={val === true || val === 'true'}
                onClick={() => setValues((prev) => ({ ...prev, [item.name]: !(val === true || val === 'true') }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                  val === true || val === 'true' ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    val === true || val === 'true' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="ml-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                {val === true || val === 'true' ? (t('global.enable') || 'Enabled') : (t('global.disable') || 'Disabled')}
              </span>
            </div>
          ) : item.type === Type.Select && item.options ? (
            <CustomSelect
              value={val}
              onChange={(selected) => setValues((prev) => ({ ...prev, [item.name]: selected }))}
              options={item.options.split(',').map((opt) => {
                const optKey = isCommon
                  ? `storages.common.${item.name}s.${opt}`
                  : `drivers.${selectedDriver}.${item.name}s.${opt}`
                const optLabel = t.has(optKey) ? t(optKey) : opt
                return {
                  value: opt,
                  label: optLabel,
                }
              })}
              className="w-full"
              triggerClassName="h-10 text-xs w-full bg-slate-50 dark:bg-slate-950/60 dark:border-slate-800 font-semibold"
            />
          ) : item.type === Type.Text ? (
            <textarea
              rows={3}
              value={val}
              onChange={(e) => setValues((prev) => ({ ...prev, [item.name]: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
            />
          ) : (
            <input
              type={item.type === Type.Number ? 'number' : 'text'}
              value={val}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [item.name]: item.type === Type.Number ? Number(e.target.value) : e.target.value,
                }))
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {storageId ? (t('global.edit') || 'Edit Storage') : (t('global.add') || 'Add Storage')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {selectedDriver} {t('storages.common.driver') || 'Driver configuration'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-64 items-center justify-center space-x-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="text-sm">{t('global.loading') || 'Loading driver schema...'}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Driver Selection & Mount Path */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('storages.common.driver') || 'Storage Driver'}
                  </label>
                  <CustomSelect
                    value={selectedDriver}
                    disabled={!!storageId}
                    onChange={(val) => handleDriverChange(val)}
                    options={Object.keys(drivers).map((d) => ({
                      value: d,
                      label: d,
                    }))}
                    className="w-full"
                    triggerClassName="h-10 text-xs w-full bg-slate-50 dark:bg-slate-950/60 dark:border-slate-800 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('storages.common.mount_path') || 'Mount Path'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={mountPath}
                    onChange={(e) => setMountPath(e.target.value)}
                    placeholder="/my-folder"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                  />
                </div>
              </div>

              {/* Remark */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('storages.common.remark') || 'Remark / Note'}
                </label>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Optional description"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>

              {/* Additional driver fields */}
              {currentDriverInfo && (
                <div className="space-y-4 pt-2">
                  <h4 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
                    {selectedDriver}
                  </h4>
                  <div className="space-y-4">
                    {currentDriverInfo.additional.map((item) =>
                      renderField(item, additionalValues, setAdditionalValues, false)
                    )}
                  </div>
                </div>
              )}

              {/* Common driver parameters */}
              {currentDriverInfo && currentDriverInfo.common.length > 0 && (
                <div className="space-y-4 pt-2">
                  <h4 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
                    {t('storages.common.web_proxy') ? '通用配置' : 'Common Config'}
                  </h4>
                  <div className="space-y-4">
                    {currentDriverInfo.common.map((item) =>
                      renderField(item, commonValues, setCommonValues, true)
                    )}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t('global.cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{t('global.save') || 'Save'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
