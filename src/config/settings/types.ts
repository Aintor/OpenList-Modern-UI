import { Group } from '~/types'

export type SettingFieldType =
  | 'text'
  | 'number'
  | 'switch'
  | 'select'
  | 'textarea'
  | 'password'
  | 'code'
  | 'tags'
  | 'folder'
  | 'icon'
  | 'action_btn'

export interface SettingFieldSchema {
  key: string
  type: SettingFieldType
  labelKey: string
  helpKey?: string
  defaultValue?: string | number | boolean
  placeholderKey?: string
  options?: Array<{
    value: string
    labelKey?: string
    label?: string
  }>
  span?: 1 | 2
  dependsOn?: {
    field: string
    value: string | boolean | string[]
  }
  readOnly?: boolean
  deprecated?: boolean
}

export interface SettingSectionSchema {
  id: string
  titleKey?: string
  descriptionKey?: string
  fields: SettingFieldSchema[]
}

export interface SettingPageSchema {
  id: string
  groupNumber?: Group
  titleKey: string
  sections: SettingSectionSchema[]
  features?: {
    allowSave?: boolean
    allowRefresh?: boolean
    allowResetDefault?: boolean
  }
}
