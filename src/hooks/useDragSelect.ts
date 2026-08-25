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

    // Strictly disable desktop marquee box selection on mobile/touch devices
    const isDesktop =
      typeof window !== 'undefined' &&
      window.innerWidth >= 768 &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches

    if (!isDesktop) {
      return
    }

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

/**
 * Mobile Photo Gallery Drag-to-Select Gesture Engine (iOS Photos / Google Photos pattern)
 * - Tap: Open file / folder
 * - Vertical Drag: Smooth native page scrolling
 * - Long-Press (300ms): Selects item and activates Drag-Select Mode
 * - Continuous Drag after Long-Press: Sequentially selects all items the finger slides over in real time
 */
export function useMobileDragSelect() {
  const selectIndex = useObjStore((state) => state.selectIndex)
  const setSelectedIndices = useObjStore((state) => state.setSelectedIndices)

  const isDraggingRef = useRef(false)
  const startIndexRef = useRef<number>(-1)
  const lastTargetIndexRef = useRef<number>(-1)
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoScrollTimerRef = useRef<number | null>(null)
  const baseSelectedIndicesRef = useRef<Set<number>>(new Set())
  const hasJustFinishedDragRef = useRef(false)

  // Cancel running edge auto-scroll
  const stopAutoScroll = () => {
    if (autoScrollTimerRef.current) {
      cancelAnimationFrame(autoScrollTimerRef.current)
      autoScrollTimerRef.current = null
    }
  }

  // Smooth edge auto-scrolling when finger is near top or bottom edges
  const handleAutoScroll = (clientY: number) => {
    const scrollContainer = document.querySelector('main')
    if (!scrollContainer) return

    const topThreshold = 130
    const bottomThreshold = window.innerHeight - 100

    stopAutoScroll()

    if (clientY < topThreshold) {
      const speed = Math.min(20, Math.max(4, (topThreshold - clientY) / 3))
      const step = () => {
        scrollContainer.scrollTop -= speed
        if (isDraggingRef.current) {
          autoScrollTimerRef.current = requestAnimationFrame(step)
        }
      }
      autoScrollTimerRef.current = requestAnimationFrame(step)
    } else if (clientY > bottomThreshold) {
      const speed = Math.min(20, Math.max(4, (clientY - bottomThreshold) / 3))
      const step = () => {
        scrollContainer.scrollTop += speed
        if (isDraggingRef.current) {
          autoScrollTimerRef.current = requestAnimationFrame(step)
        }
      }
      autoScrollTimerRef.current = requestAnimationFrame(step)
    }
  }

  // Called on card onTouchStart
  const onTouchStartItem = (index: number, e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
    startIndexRef.current = index
    lastTargetIndexRef.current = index
    isDraggingRef.current = false
    hasJustFinishedDragRef.current = false

    const hasSelection = useObjStore.getState().objs.some((o) => o.selected)

    // Snapshot existing selections
    const currentSelected = new Set<number>()
    useObjStore.getState().objs.forEach((o, i) => {
      if (o.selected) currentSelected.add(i)
    })
    baseSelectedIndicesRef.current = currentSelected

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }

    // 300ms long-press (or 180ms if already in multi-select mode)
    const delay = hasSelection ? 180 : 300

    longPressTimerRef.current = setTimeout(() => {
      isDraggingRef.current = true
      // Auto-select starting item
      selectIndex(index, true, false)
    }, delay)
  }

  useEffect(() => {
    const onTouchMoveGlobal = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const touch = e.touches[0]

      // If drag mode is not active yet, test if user is scrolling normally
      if (!isDraggingRef.current) {
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x)
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y)
        if (dx > 10 || dy > 10) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
          }
        }
        return
      }

      // Drag selection is active -> prevent page scrolling
      if (e.cancelable) {
        e.preventDefault()
      }

      handleAutoScroll(touch.clientY)

      // Find item under finger
      const element = document.elementFromPoint(touch.clientX, touch.clientY)
      if (!element) return

      const itemEl = element.closest('.viselect-item') as HTMLElement | null
      if (!itemEl || !itemEl.dataset.index) return

      const targetIndex = parseInt(itemEl.dataset.index, 10)
      if (isNaN(targetIndex) || targetIndex === lastTargetIndexRef.current) return

      lastTargetIndexRef.current = targetIndex
      const start = startIndexRef.current
      if (start === -1) return

      const min = Math.min(start, targetIndex)
      const max = Math.max(start, targetIndex)

      // Sequentially select all items in range
      const nextSet = new Set(baseSelectedIndicesRef.current)
      for (let i = min; i <= max; i++) {
        nextSet.add(i)
      }
      setSelectedIndices(nextSet)
    }

    const onTouchEndGlobal = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      stopAutoScroll()

      if (isDraggingRef.current) {
        hasJustFinishedDragRef.current = true
        isDraggingRef.current = false
        setTimeout(() => {
          hasJustFinishedDragRef.current = false
        }, 120)
      }
    }

    window.addEventListener('touchmove', onTouchMoveGlobal, { passive: false })
    window.addEventListener('touchend', onTouchEndGlobal)
    window.addEventListener('touchcancel', onTouchEndGlobal)

    return () => {
      window.removeEventListener('touchmove', onTouchMoveGlobal)
      window.removeEventListener('touchend', onTouchEndGlobal)
      window.removeEventListener('touchcancel', onTouchEndGlobal)
      stopAutoScroll()
    }
  }, [selectIndex, setSelectedIndices])

  return {
    onTouchStartItem,
    isDragging: () => isDraggingRef.current,
    hasJustFinishedDrag: () => hasJustFinishedDragRef.current,
  }
}
