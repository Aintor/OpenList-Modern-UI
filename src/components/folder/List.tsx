import React from 'react'
import { StoreObj } from '~/types'
import { ListItem } from './ListItem'
import { useObjStore } from '~/store/useObjStore'
import { useDragSelect } from '~/hooks/useDragSelect'
import { useT } from '~/lang'

interface ListProps {
  objs: StoreObj[]
  onOpen: (obj: StoreObj) => void
  onContextMenu: (e: React.MouseEvent, obj: StoreObj) => void
}

export const List: React.FC<ListProps> = ({ objs, onOpen, onContextMenu }) => {
  const { selectIndex, selectRange, lastCheckedIndex, orderBy, orderReverse, setOrderBy } = useObjStore()
  const { containerRef } = useDragSelect()
  const t = useT()

  const handleSelect = (index: number, selected: boolean, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastCheckedIndex >= 0) {
      selectRange(lastCheckedIndex, index)
    } else {
      selectIndex(index, selected, false)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Table Header with Sort Actions */}
      <div className="flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-slate-400 border-b border-slate-200/80 dark:border-slate-800/80 select-none mb-1">
        <div
          onClick={() => setOrderBy('name')}
          className="flex-1 flex items-center space-x-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <span>{t('home.obj.name') || 'Name'}</span>
          {orderBy === 'name' && (
            <span className="text-indigo-500 ml-1">{orderReverse ? '↓' : '↑'}</span>
          )}
        </div>

        <div
          onClick={() => setOrderBy('size')}
          className="hidden sm:block w-28 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors mr-4"
        >
          <span>{t('home.obj.size') || 'Size'}</span>
          {orderBy === 'size' && (
            <span className="text-indigo-500 ml-1">{orderReverse ? '↓' : '↑'}</span>
          )}
        </div>

        <div
          onClick={() => setOrderBy('modified')}
          className="hidden sm:block w-36 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <span>{t('home.obj.modified') || 'Date Modified'}</span>
          {orderBy === 'modified' && (
            <span className="text-indigo-500 ml-1">{orderReverse ? '↓' : '↑'}</span>
          )}
        </div>
      </div>

      {/* Rows Container spanning full remaining vertical space for drag-select */}
      <div ref={containerRef} className="viselect-container flex-1 pb-6 space-y-0.5">
        {objs.map((obj, i) => (
          <ListItem
            key={obj.name + i}
            obj={obj}
            index={i}
            onOpen={onOpen}
            onSelect={handleSelect}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    </div>
  )
}
