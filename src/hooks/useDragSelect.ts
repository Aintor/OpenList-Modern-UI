import { useEffect, useRef } from 'react'
import SelectionArea from '@viselect/vanilla'
import { useObjStore } from '~/store/useObjStore'

export function useDragSelect() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectIndex = useObjStore((state) => state.selectIndex)
  const clearSelection = useObjStore((state) => state.clearSelection)
  const objs = useObjStore((state) => state.objs)

  useEffect(() => {
    if (!containerRef.current) return

    let lastDragEndTime = 0
    let isDragging = false
    let pointerStartX = 0
    let pointerStartY = 0

    // Allow starting drag selection anywhere within the explorer main area, container, or page
    const startAreas: (HTMLElement | string)[] = []
    const mainEl = document.querySelector('main')
    if (mainEl) {
      startAreas.push(mainEl as HTMLElement)
    }
    if (containerRef.current) {
      startAreas.push(containerRef.current)
    }

    const selection = new SelectionArea({
      selectionAreaClass: 'selection-area',
      startAreas: startAreas.length > 0 ? startAreas : [containerRef.current],
      boundaries: ['html'],
      selectables: ['.viselect-item'],
      behaviour: {
        overlap: 'invert',
        intersect: 'touch',
        startThreshold: 8,
      },
    })

    selection.on('beforestart', ({ event }) => {
      const target = (event as MouseEvent)?.target as HTMLElement | null
      if (!target) return false

      // Do not initiate drag selection when clicking on file cards, interactive controls, buttons, links, header, sidebar, modals, etc.
      if (
        target.closest(
          '.viselect-item, header, aside, button, a, input, select, textarea, [role="button"], [role="dialog"], .no-drag-select, .pagination-bar, .context-menu'
        )
      ) {
        return false
      }
      return true
    })

    selection.on('start', ({ event }) => {
      isDragging = true
      const ev = event as MouseEvent
      // If user is actively dragging a selection box without modifier keys, clear previous selections
      if (!ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
        clearSelection()
        selection.clearSelection(true)
      }
    })

    selection.on('move', ({ store: { changed: { added, removed } } }) => {
      for (const el of added) {
        const idx = el.getAttribute('data-index')
        if (idx !== null) {
          selectIndex(Number(idx), true)
        }
      }
      for (const el of removed) {
        const idx = el.getAttribute('data-index')
        if (idx !== null) {
          selectIndex(Number(idx), false)
        }
      }
    })

    selection.on('stop', () => {
      isDragging = false
      lastDragEndTime = Date.now()
    })

    // Track mouse down coordinates for static click detection
    const handlePointerDown = (e: MouseEvent) => {
      pointerStartX = e.clientX
      pointerStartY = e.clientY
    }

    // Click on empty blank area (margins, padding, gap between cards) to clear selection
    const handleBlankClick = (e: MouseEvent) => {
      // 1. Ignore if a drag just occurred or is in progress
      if (isDragging || Date.now() - lastDragEndTime < 400) {
        return
      }

      // 2. Ignore if mouse moved more than 5px (was a drag release, not an intentional static click)
      const moveDist = Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY)
      if (moveDist > 5) {
        return
      }

      const target = e.target as HTMLElement | null
      if (!target) return

      // 3. If click was inside a selectable card, button, modal, or toolbar, ignore
      if (
        target.closest(
          '.viselect-item, header, aside, button, a, input, select, textarea, [role="button"], [role="dialog"], .no-drag-select, .selection-area'
        )
      ) {
        return
      }

      // 4. If items are currently selected, clicking static blank area deselects all
      if (useObjStore.getState().getSelectedObjs().length > 0) {
        clearSelection()
      }
    }

    const currentMain = mainEl || containerRef.current
    currentMain?.addEventListener('mousedown', handlePointerDown as EventListener, true)
    currentMain?.addEventListener('click', handleBlankClick as EventListener)

    return () => {
      currentMain?.removeEventListener('mousedown', handlePointerDown as EventListener, true)
      currentMain?.removeEventListener('click', handleBlankClick as EventListener)
      selection.destroy()
    }
  }, [selectIndex, clearSelection, objs.length])

  return { containerRef }
}
