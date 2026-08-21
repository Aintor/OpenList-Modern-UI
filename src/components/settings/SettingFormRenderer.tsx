import React, { useEffect, useState } from 'react'
import { SettingPageSchema } from '~/config/settings/types'
import { SettingItem, Resp, Type, Flag } from '~/types'
import { r } from '~/utils/request'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'
import { useSettingsStore } from '~/store/useSettingsStore'
import { SettingItemRenderer } from './SettingItemRenderer'
import { Save, RefreshCw, RotateCcw, Loader2 } from 'lucide-react'

interface SettingFormRendererProps {
  schema: SettingPageSchema
  onSaved?: () => void
}

export const SettingFormRenderer: React.FC<SettingFormRendererProps> = ({
  schema,
  onSaved,
}) => {
  const t = useT()
  const [values, setValues] = useState<Record<string, string>>({})
  const [rawSettingsMap, setRawSettingsMap] = useState<Record<string, SettingItem>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Fetch settings from API
  const fetchSettings = async () => {
    if (schema.groupNumber === undefined) return
    setLoading(true)
    try {
      const resp: Resp<SettingItem[]> = await r.get(
        `/admin/setting/list?group=${schema.groupNumber}`
      )
      if (resp.code === 200 && resp.data) {
        const map: Record<string, string> = {}
        const rawMap: Record<string, SettingItem> = {}
        resp.data.forEach((item) => {
          map[item.key] = item.value
          rawMap[item.key] = item
        })
        setRawSettingsMap(rawMap)
        setValues(map)
      } else {
        notify.error(resp.message || 'Failed to fetch settings')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [schema.id, schema.groupNumber])

  // Handle single field change
  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  // Save all settings preserving original type, group, and flag
  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: SettingItem[] = Object.entries(values).map(([key, value]) => {
        const original = rawSettingsMap[key]
        if (original) {
          return {
            ...original,
            value: String(value),
          }
        }
        return {
          key,
          value: String(value),
          type: Type.String,
          group: (schema.groupNumber ?? 0) as any,
          flag: Flag.PUBLIC,
          help: '',
          options: '',
        }
      })
      const resp: Resp<any> = await r.post('/admin/setting/save', payload)
      if (resp.code === 200) {
        notify.success(t('global.save_success') || 'Settings saved successfully')
        useSettingsStore.getState().fetchSettings()
        onSaved?.()
      } else {
        notify.error(resp.message || 'Failed to save settings')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // Load default settings
  const handleResetDefaults = async () => {
    if (schema.groupNumber === undefined) return
    setResetting(true)
    try {
      const resp: Resp<SettingItem[]> = await r.post(
        `/admin/setting/default?group=${schema.groupNumber}`
      )
      if (resp.code === 200 && resp.data) {
        const map: Record<string, string> = {}
        const rawMap: Record<string, SettingItem> = {}
        resp.data.forEach((item) => {
          map[item.key] = item.value
          rawMap[item.key] = item
        })
        setRawSettingsMap((prev) => ({ ...prev, ...rawMap }))
        setValues((prev) => ({ ...prev, ...map }))
        notify.info(t('manage.load_default_setting_success') || 'Loaded default settings (not saved yet)')
      } else {
        notify.error(resp.message || 'Failed to load default settings')
      }
    } catch (e: any) {
      notify.error(e.message || 'Failed to load default settings')
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center space-x-2 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">{t('global.loading') || 'Loading settings...'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {schema.sections.map((section) => (
        <div key={section.id} className="space-y-4">
          {section.titleKey && (
            <div className="border-b border-slate-100 pb-2 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t(section.titleKey) || section.id}
              </h3>
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {section.fields.map((field) => {
              // Evaluate dependsOn condition if defined
              if (field.dependsOn) {
                const currentVal = values[field.dependsOn.field]
                const expected = field.dependsOn.value
                const isMatch = Array.isArray(expected)
                  ? expected.includes(currentVal)
                  : String(currentVal) === String(expected)
                if (!isMatch) return null
              }

              const val = values[field.key] ?? (field.defaultValue !== undefined ? String(field.defaultValue) : '')

              return (
                <SettingItemRenderer
                  key={field.key}
                  field={field}
                  value={val}
                  onChange={(newVal) => handleChange(field.key, newVal)}
                />
              )
            })}
          </div>
        </div>
      ))}

      {/* Global Actions Bar */}
      {schema.features?.allowSave !== false && (
        <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
          {schema.features?.allowRefresh !== false && (
            <button
              type="button"
              onClick={fetchSettings}
              disabled={loading || saving}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('global.refresh') || 'Refresh'}</span>
            </button>
          )}

          {schema.features?.allowResetDefault !== false && schema.groupNumber !== undefined && (
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={loading || resetting}
              className="flex items-center space-x-1.5 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-2 text-xs font-semibold text-amber-700 shadow-xs hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/60 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} />
              <span>{t('manage.load_default_setting') || 'Load Defaults'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all dark:bg-indigo-500 dark:hover:bg-indigo-600 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>{t('global.save') || 'Save'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
