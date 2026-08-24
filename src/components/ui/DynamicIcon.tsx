import React from 'react'
import * as LucideIcons from 'lucide-react'
import { FolderTree, LucideProps } from 'lucide-react'

// Convert kebab-case to PascalCase (e.g. 'folder-tree' -> 'FolderTree', 'share-2' -> 'Share2')
export function toPascalCase(str: string): string {
  if (!str) return ''
  return str
    .replace(/(^\w|-\w)/g, (clearAndUpper) => clearAndUpper.replace('-', '').toUpperCase())
    .replace(/^\w/, (c) => c.toUpperCase())
}

// Check if a given string is a valid Lucide icon name (filtering out emojis and arbitrary text)
export function isValidLucideIcon(name?: string): boolean {
  if (!name || typeof name !== 'string') return false
  const trimmed = name.trim()
  if (!trimmed) return false
  // Reject emojis or non-identifier characters
  if (/[\uD800-\uDFFF]/.test(trimmed) || /[\u2600-\u27BF]/.test(trimmed)) return false
  const pascalName = toPascalCase(trimmed)
  const IconComponent = (LucideIcons as Record<string, any>)[pascalName]
  return typeof IconComponent === 'function' || typeof IconComponent === 'object'
}

interface DynamicIconProps extends LucideProps {
  name?: string
  fallback?: React.ComponentType<LucideProps>
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({
  name,
  fallback: FallbackIcon = FolderTree,
  ...props
}) => {
  if (!name || typeof name !== 'string') {
    return <FallbackIcon {...props} />
  }

  const trimmed = name.trim()
  if (!trimmed || !isValidLucideIcon(trimmed)) {
    return <FallbackIcon {...props} />
  }

  const pascalName = toPascalCase(trimmed)
  const IconComponent = (LucideIcons as Record<string, any>)[pascalName]

  if (typeof IconComponent === 'function' || typeof IconComponent === 'object') {
    const Component = IconComponent as React.ComponentType<LucideProps>
    return <Component {...props} />
  }

  return <FallbackIcon {...props} />
}
