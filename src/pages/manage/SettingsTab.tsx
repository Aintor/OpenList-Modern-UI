import React, { useState } from 'react'
import { Group } from '~/types'
import { useT } from '~/lang'
import { SettingFormRenderer } from '~/components/settings/SettingFormRenderer'
import { SettingPageSchema } from '~/config/settings/types'
import siteSchema from '~/config/settings/site.json'
import styleSchema from '~/config/settings/style.json'
import previewSchema from '~/config/settings/preview.json'
import globalSchema from '~/config/settings/global.json'
import ssoSchema from '~/config/settings/sso.json'
import ldapSchema from '~/config/settings/ldap.json'
import s3Schema from '~/config/settings/s3.json'
import ftpSchema from '~/config/settings/ftp.json'
import trafficSchema from '~/config/settings/traffic.json'

const schemaMap: Record<number, SettingPageSchema> = {
  [Group.SITE]: siteSchema as unknown as SettingPageSchema,
  [Group.STYLE]: styleSchema as unknown as SettingPageSchema,
  [Group.PREVIEW]: previewSchema as unknown as SettingPageSchema,
  [Group.GLOBAL]: globalSchema as unknown as SettingPageSchema,
  [Group.SSO]: ssoSchema as unknown as SettingPageSchema,
  [Group.LDAP]: ldapSchema as unknown as SettingPageSchema,
  [Group.S3]: s3Schema as unknown as SettingPageSchema,
  [Group.FTP]: ftpSchema as unknown as SettingPageSchema,
  [Group.TRAFFIC]: trafficSchema as unknown as SettingPageSchema,
}

const groupTabs = [
  { id: Group.SITE, name: 'Site' },
  { id: Group.STYLE, name: 'Style' },
  { id: Group.PREVIEW, name: 'Preview' },
  { id: Group.GLOBAL, name: 'Global' },
  { id: Group.SSO, name: 'SSO' },
  { id: Group.LDAP, name: 'LDAP' },
  { id: Group.S3, name: 'S3' },
  { id: Group.FTP, name: 'FTP' },
  { id: Group.TRAFFIC, name: 'Traffic' },
]

export const SettingsTab: React.FC = () => {
  const t = useT()
  const [selectedGroup, setSelectedGroup] = useState<Group>(Group.SITE)

  const activeSchema = schemaMap[selectedGroup] || (siteSchema as unknown as SettingPageSchema)

  return (
    <div className="space-y-6">
      {/* Sub-Group Navigation Pills (Sticky pinned on scroll with frosted glass backdrop) */}
      <div className="sticky -top-6 lg:-top-8 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3.5 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-1.5 transition-colors shadow-xs">
        {groupTabs.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGroup(g.id)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              selectedGroup === g.id
                ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
            }`}
          >
            {t(`manage.sidemenu.${g.name.toLowerCase()}`) || g.name}
          </button>
        ))}
      </div>

      {/* Schema-Driven Dynamic Form Container */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <SettingFormRenderer
          key={activeSchema.id}
          schema={activeSchema}
        />
      </div>
    </div>
  )
}
