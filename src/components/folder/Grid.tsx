import React from 'react'
import { StoreObj } from '~/types'
import { GridItem } from './GridItem'
import { useObjStore } from '~/store/useObjStore'
import { useDragSelect } from '~/hooks/useDragSelect'

interface GridProps {
  objs: StoreObj[]
  onOpen: (obj: StoreObj) => void
  onContextMenu: (e: React.MouseEvent, obj: StoreObj) => void
}

export const Grid: React.FC<GridProps> = ({ objs, onOpen, onContextMenu }) => {
  const { selectIndex, selectRange, lastCheckedIndex } = useObjStore()
  const { containerRef } = useDragSelect()

  const handleSelect = (index: number, selected: boolean, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastCheckedIndex >= 0) {
      selectRange(lastCheckedIndex, index)
    } else {
      selectIndex(index, selected, false)
    }
  }

  return (
    <div
      ref={containerRef}
      className="viselect-container flex-1 pb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 content-start"
    >
      {objs.map((obj, i) => (
        <GridItem
          key={obj.name + i}
          obj={obj}
          index={i}
          onOpen={onOpen}
          onSelect={handleSelect}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  )
}
