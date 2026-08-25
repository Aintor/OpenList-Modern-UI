import React, { useState } from 'react'
import { SettingFieldSchema } from '~/config/settings/types'
import { CustomSelect } from '~/components/ui/CustomSelect'
import { IconPicker } from '~/components/ui/IconPicker'
import { useT } from '~/lang'
import { Eye, EyeOff } from 'lucide-react'

interface SettingItemRendererProps {
  field: SettingFieldSchema
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export const SettingItemRenderer: React.FC<SettingItemRendererProps> = ({
  field,
  value,
  onChange,
  disabled = false,
}) => {
  const t = useT()
  const [showPassword, setShowPassword] = useState(false)

  const label = t(field.labelKey) || field.labelKey
  const helpText = field.helpKey ? t(field.helpKey) || '' : ''
  const isReadOnly = field.readOnly || disabled

  return (
    <div className="space-y-2 py-4 border-b border-slate-100 last:border-0 dark:border-slate-800/60">
      {/* Title & Badges */}
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {label}
          </label>
          {field.readOnly && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {t('global.readonly') || 'ReadOnly'}
            </span>
          )}
        </div>
        {helpText && (
          <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed">
            {helpText}
          </p>
        )}
      </div>

      {/* Input Control on Separate Line */}
      <div className="pt-0.5">
        {field.type === 'switch' ? (
          <div className="flex h-10 items-center">
            <button
              type="button"
              role="switch"
              disabled={isReadOnly}
              aria-checked={value === 'true'}
              onClick={() => onChange(value === 'true' ? 'false' : 'true')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 ${
                value === 'true' ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  value === 'true' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="ml-3 text-xs font-medium text-slate-600 dark:text-slate-300">
              {value === 'true' ? (t('global.enable') || 'Enabled') : (t('global.disable') || 'Disabled')}
            </span>
          </div>
        ) : field.type === 'icon' ? (
          <IconPicker
            value={value || ''}
            defaultValue={typeof field.defaultValue === 'string' ? field.defaultValue : 'folder-tree'}
            disabled={isReadOnly}
            onChange={(val) => onChange(val)}
          />
        ) : field.type === 'select' ? (
          <CustomSelect
            value={value}
            disabled={isReadOnly}
            onChange={(val) => onChange(val)}
            options={(field.options || []).map((opt) => ({
              value: opt.value,
              label: opt.labelKey ? t(opt.labelKey) || opt.label || opt.value : opt.label || opt.value,
            }))}
            className="w-full"
            triggerClassName="h-10 text-base sm:text-xs w-full bg-slate-50 dark:bg-slate-950/60 dark:border-slate-800 font-semibold"
          />
        ) : field.type === 'password' ? (
          <div className="relative flex items-center">
            <input
              type={showPassword ? 'text' : 'password'}
              value={value || ''}
              disabled={isReadOnly}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholderKey ? t(field.placeholderKey) || '' : ''}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-3.5 pr-10 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        ) : field.type === 'number' ? (
          <input
            type="number"
            value={value ?? ''}
            disabled={isReadOnly}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
          />
        ) : field.type === 'code' || field.type === 'textarea' ? (
          <textarea
            rows={field.type === 'code' ? 5 : 3}
            value={value || ''}
            disabled={isReadOnly}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholderKey ? t(field.placeholderKey) || '' : ''}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-base sm:text-xs font-mono text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
          />
        ) : (
          <input
            type="text"
            value={value || ''}
            disabled={isReadOnly}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholderKey ? t(field.placeholderKey) || '' : ''}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base sm:text-xs text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
          />
        )}
      </div>
    </div>
  )
}
