import { gsap } from 'gsap'

export type DesktopPlayerMode = 'collapsed' | 'expanded' | 'queue'

export interface DesktopPlayerElements {
  container: HTMLDivElement | null
  card: HTMLDivElement | null
  disc: HTMLDivElement | null
  svgRing: SVGSVGElement | null
  content: HTMLDivElement | null
  header: HTMLDivElement | null
  playlistView: HTMLDivElement | null
  scrubber: HTMLDivElement | null
  controls: HTMLDivElement | null
  volumeCapsule: HTMLDivElement | null
}

export const DESKTOP_CONSTANTS = {
  collapsed: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  expanded: {
    width: 384,
    height: 160,
    borderRadius: 24,
  },
  queue: {
    width: 384,
    height: 440,
    borderRadius: 24,
  },
}

/**
 * Instantly applies geometry layout for a given mode without transition animation
 */
export function applyDesktopModeInstant(
  elements: DesktopPlayerElements,
  mode: DesktopPlayerMode
) {
  const { collapsed, expanded, queue } = DESKTOP_CONSTANTS

  if (mode === 'collapsed') {
    if (elements.card) {
      gsap.set(elements.card, {
        width: collapsed.width,
        height: collapsed.height,
        borderRadius: collapsed.borderRadius,
        overflow: 'hidden',
      })
    }
    if (elements.disc) gsap.set(elements.disc, { scale: 1, x: 0, y: 0 })
    if (elements.svgRing) gsap.set(elements.svgRing, { opacity: 1, display: 'block' })
    if (elements.content) gsap.set(elements.content, { display: 'none', opacity: 0 })
    if (elements.playlistView) gsap.set(elements.playlistView, { display: 'none', opacity: 0, pointerEvents: 'none' })
    return
  }

  if (mode === 'expanded') {
    if (elements.card) {
      gsap.set(elements.card, {
        width: expanded.width,
        height: expanded.height,
        borderRadius: expanded.borderRadius,
        overflow: 'visible',
      })
    }
    if (elements.disc) gsap.set(elements.disc, { scale: 0.9, x: 10, y: 8 })
    if (elements.svgRing) gsap.set(elements.svgRing, { opacity: 0, display: 'none' })
    if (elements.content) gsap.set(elements.content, { display: 'flex', opacity: 1 })
    if (elements.playlistView) gsap.set(elements.playlistView, { display: 'none', opacity: 0, pointerEvents: 'none' })
    return
  }

  // mode === 'queue'
  if (elements.card) {
    gsap.set(elements.card, {
      width: queue.width,
      height: queue.height,
      borderRadius: queue.borderRadius,
      overflow: 'visible',
    })
  }
  if (elements.disc) gsap.set(elements.disc, { scale: 0.9, x: 10, y: 8 })
  if (elements.svgRing) gsap.set(elements.svgRing, { opacity: 0, display: 'none' })
  if (elements.content) gsap.set(elements.content, { display: 'flex', opacity: 1 })
  if (elements.playlistView) gsap.set(elements.playlistView, { display: 'flex', opacity: 1, pointerEvents: 'auto' })
}

/**
 * Runs seamless spring morphing transition between any of the 3 desktop states
 */
export function runDesktopModeTransition(
  fromMode: DesktopPlayerMode,
  toMode: DesktopPlayerMode,
  elements: DesktopPlayerElements,
  onComplete?: () => void
) {
  if (fromMode === toMode) {
    onComplete?.()
    return
  }

  const { card, disc, svgRing, content, playlistView, container } = elements
  if (!card) {
    onComplete?.()
    return
  }

  gsap.killTweensOf([card, disc, svgRing, content, playlistView, container].filter(Boolean))

  const { collapsed, expanded, queue } = DESKTOP_CONSTANTS
  const tl = gsap.timeline({
    onComplete: () => {
      applyDesktopModeInstant(elements, toMode)
      onComplete?.()
    },
  })

  // Ensure window boundary clamping when expanding (Physical Bottom-Right Anchor Model)
  if (container && toMode !== 'collapsed') {
    const rect = container.getBoundingClientRect()
    const targetHeight = toMode === 'queue' ? queue.height : expanded.height
    const targetWidth = expanded.width
    const margin = 16

    let adjustX = 0
    let adjustY = 0

    // Since the card is anchored to bottom-right, it extends upwards and leftwards:
    const futureTop = rect.bottom - targetHeight
    const futureLeft = rect.right - targetWidth

    // 1. Vertical clamping: only adjust if top edge clips above window top (< margin)
    // or if the bottom is currently out of window bottom (> innerHeight - margin)
    if (futureTop < margin) {
      adjustY = margin - futureTop
    } else if (rect.bottom > window.innerHeight - margin) {
      adjustY = window.innerHeight - margin - rect.bottom
    }

    // 2. Horizontal clamping: only adjust if left edge clips past window left (< margin)
    // or if the right is currently out of window right (> innerWidth - margin)
    if (futureLeft < margin) {
      adjustX = margin - futureLeft
    } else if (rect.right > window.innerWidth - margin) {
      adjustX = window.innerWidth - margin - rect.right
    }

    if (adjustX !== 0 || adjustY !== 0) {
      tl.to(
        container,
        {
          x: `+=${adjustX}`,
          y: `+=${adjustY}`,
          duration: 0.32,
          ease: 'power3.out',
        },
        0
      )
    }
  }

  // 1. Morphing between Expanded <-> Queue (Card height tween with synchronized in-card playlist unfold)
  if ((fromMode === 'expanded' && toMode === 'queue') || (fromMode === 'queue' && toMode === 'expanded')) {
    const isExpandingQueue = toMode === 'queue'
    const targetHeight = isExpandingQueue ? queue.height : expanded.height

    tl.to(
      card,
      {
        height: targetHeight,
        duration: 0.34,
        ease: 'power3.out',
      },
      0
    )

    if (playlistView) {
      if (isExpandingQueue) {
        gsap.set(playlistView, {
          display: 'flex',
          height: 0,
          opacity: 0,
          overflow: 'hidden',
          pointerEvents: 'auto',
        })
        tl.to(
          playlistView,
          {
            height: 260,
            opacity: 1,
            duration: 0.34,
            ease: 'power3.out',
          },
          0
        )
      } else {
        tl.to(
          playlistView,
          {
            height: 0,
            opacity: 0,
            duration: 0.28,
            ease: 'power3.inOut',
            onComplete: () => {
              gsap.set(playlistView, { display: 'none', pointerEvents: 'none' })
            },
          },
          0
        )
      }
    }
    return
  }

  // 2. Morphing Collapsed -> Expanded / Queue
  if (fromMode === 'collapsed') {
    const targetDims = toMode === 'queue' ? queue : expanded

    if (svgRing) tl.to(svgRing, { opacity: 0, duration: 0.15 }, 0)
    if (disc) {
      tl.to(
        disc,
        {
          x: 10,
          y: 8,
          scale: 0.9,
          duration: 0.36,
          ease: 'power3.out',
        },
        0
      )
    }

    tl.to(
      card,
      {
        width: targetDims.width,
        height: targetDims.height,
        borderRadius: targetDims.borderRadius,
        duration: 0.38,
        ease: 'power3.out',
        onStart: () => {
          card.style.overflow = 'visible'
        },
      },
      0
    )

    if (content) {
      gsap.set(content, { display: 'flex' })
      tl.fromTo(
        content,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 0.28, ease: 'power2.out' },
        0.1
      )
    }

    if (toMode === 'queue' && playlistView) {
      gsap.set(playlistView, { display: 'flex', height: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'auto' })
      tl.to(
        playlistView,
        { height: 260, opacity: 1, duration: 0.34, ease: 'power3.out' },
        0.06
      )
    }
    return
  }

  // 3. Morphing Expanded / Queue -> Collapsed
  if (toMode === 'collapsed') {
    if (playlistView) {
      tl.to(playlistView, { height: 0, opacity: 0, duration: 0.16, ease: 'power2.in' }, 0)
    }

    if (content) {
      tl.to(
        content,
        {
          opacity: 0,
          scale: 0.95,
          duration: 0.16,
          ease: 'power2.in',
          onComplete: () => {
            content.style.display = 'none'
          },
        },
        0
      )
    }

    tl.to(
      card,
      {
        width: collapsed.width,
        height: collapsed.height,
        borderRadius: collapsed.borderRadius,
        duration: 0.36,
        ease: 'power3.inOut',
        onComplete: () => {
          card.style.overflow = 'hidden'
        },
      },
      0.04
    )

    if (disc) {
      tl.to(
        disc,
        {
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.36,
          ease: 'power3.inOut',
        },
        0.04
      )
    }

    if (svgRing) {
      gsap.set(svgRing, { display: 'block' })
      tl.to(svgRing, { opacity: 1, duration: 0.2 }, 0.15)
    }
  }
}
