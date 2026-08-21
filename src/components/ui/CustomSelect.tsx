import React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string | number
  label: string
  icon?: React.ReactNode
  description?: string
}

interface CustomSelectProps {
  value: string | number
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  icon?: React.ReactNode
  className?: string
  triggerClassName?: string
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  icon,
  className = '',
  triggerClassName = '',
  disabled = false,
  align = 'start',
}) => {
  const selectedOption = options.find((o) => String(o.value) === String(value))

  return (
    <div className={`relative inline-block ${className}`}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          disabled={disabled}
          className={`flex h-9 w-full items-center justify-between space-x-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 text-xs font-semibold text-slate-700 shadow-xs backdrop-blur-md transition-all hover:bg-slate-50 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 ${triggerClassName}`}
        >
          <div className="flex items-center space-x-2 truncate">
            {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
            {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
            <span className="truncate">{selectedOption?.label || placeholder}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align={align}
            sideOffset={6}
            className="z-50 min-w-[140px] max-h-64 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 dark:border-slate-800 dark:bg-slate-900/95"
          >
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value)
              return (
                <DropdownMenu.Item
                  key={String(opt.value)}
                  onSelect={() => onChange(String(opt.value))}
                  className={`flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium transition-colors outline-none ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <div className="truncate">
                      <div>{opt.label}</div>
                      {opt.description && (
                        <div className="text-[10px] text-slate-400 font-normal">{opt.description}</div>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-400 ml-2" />}
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
