import React, { useState } from 'react'
import { formatSmartPath } from '~/utils/str'
import { Tooltip } from '~/components/ui/Tooltip'
import { Copy, Check, Folder } from 'lucide-react'
import { notify } from '~/utils/notify'
import { useT } from '~/lang'

interface SmartPathProps {
  path: string
  className?: string
  maxTotalLen?: number
  showCopy?: boolean
}

export const SmartPath: React.FC<SmartPathProps> = ({
  path,
  className = '',
  maxTotalLen = 46,
  showCopy = true,
}) => {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const formatted = formatSmartPath(path, maxTotalLen)
  const isTruncated = formatted !== path

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(path)
    setCopied(true)
    notify.success(t('global.copied') || 'Path copied to clipboard')
    setTimeout(() => setCopied(false), 1500)
  }

  const badge = (
    <span
      className={`inline-flex items-center space-x-1 max-w-full font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 ${className}`}
    >
      <span className="truncate">{formatted}</span>
    </span>
  )

  if (!isTruncated && !showCopy) {
    return badge
  }

  return (
    <Tooltip
      content={
        <div className="flex items-center space-x-2 py-0.5 max-w-sm sm:max-w-md">
          <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="font-mono text-[11px] select-all text-slate-100 break-all leading-tight">
            {path}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title={t('global.copy') || 'Copy'}
            className="ml-1 rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      }
      side="top"
      align="center"
      sideOffset={8}
      delayDuration={100}
    >
      <span className="cursor-help inline-flex items-center max-w-full">
        {badge}
      </span>
    </Tooltip>
  )
}
