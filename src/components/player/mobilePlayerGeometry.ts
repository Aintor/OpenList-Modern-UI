import { gsap } from 'gsap'

export type MobilePlayerMode = 'collapsed' | 'expanded' | 'queue'

export interface MobilePlayerElements {
  card: HTMLDivElement | null
  disc: HTMLDivElement | null
  controls: HTMLDivElement | null
  title: HTMLDivElement | null
  topTitle: HTMLDivElement | null
  timeSubtitle: HTMLParagraphElement | null
  header: HTMLDivElement | null
  scrubber: HTMLDivElement | null
  sideControls: HTMLDivElement | null
  backdrop: HTMLDivElement | null
  hairline: HTMLDivElement | null
  playlistView: HTMLDivElement | null
}

export const MOBILE_CONSTANTS = {
  card: {
    collapsedHeight: 56,
    expandedHeight: 440,
    borderRadius: 20,
  },
  disc: {
    expandedSize: 150,
    collapsedSize: 38,
    queueSize: 40,
    collapsedScale: 38 / 150, // 0.253333
    queueScale: 40 / 150,     // 0.266667
  },
  controls: {
    width: 200,
    height: 64,
    collapsedScale: 38 / 64,  // 0.59375
  },
  title: {
    expandedScale: 1.2,
  },
}

/**
 * Instantly applies pure percentage and responsive CSS positioning
 */
export function applyModeGeometryInstant(
  elements: MobilePlayerElements,
  mode: MobilePlayerMode
) {
  const { card: cC, disc: dC, controls: kC, title: tC } = MOBILE_CONSTANTS

  if (mode === 'collapsed') {
    if (elements.card) gsap.set(elements.card, { height: cC.collapsedHeight, borderRadius: cC.borderRadius })
    if (elements.disc) {
      gsap.set(elements.disc, {
        left: '10px',
        top: '9px',
        scale: dC.collapsedScale,
        transformOrigin: 'top left',
      })
    }
    if (elements.controls) {
      gsap.set(elements.controls, {
        right: '10px',
        top: '9px',
        scale: kC.collapsedScale,
        transformOrigin: 'top right',
      })
    }
    if (elements.title) {
      gsap.set(elements.title, {
        left: '54px',
        right: '128px',
        top: '10px',
        textAlign: 'center',
        scale: 1.0,
        opacity: 1,
      })
    }
    if (elements.topTitle) gsap.set(elements.topTitle, { y: 8, opacity: 0, display: 'none' })
    if (elements.timeSubtitle) gsap.set(elements.timeSubtitle, { opacity: 1 })
    if (elements.header) gsap.set(elements.header, { opacity: 0 })
    if (elements.scrubber) gsap.set(elements.scrubber, { opacity: 0 })
    if (elements.sideControls) gsap.set(elements.sideControls, { opacity: 0 })
    if (elements.backdrop) gsap.set(elements.backdrop, { opacity: 0, pointerEvents: 'none' })
    if (elements.hairline) gsap.set(elements.hairline, { opacity: 1 })
    if (elements.playlistView) gsap.set(elements.playlistView, { y: 14, opacity: 0, display: 'none', pointerEvents: 'none' })
    return
  }

  if (mode === 'expanded') {
    if (elements.card) gsap.set(elements.card, { height: cC.expandedHeight, borderRadius: cC.borderRadius })
    if (elements.disc) {
      // 100% Native CSS Centered: left: calc(50% - 75px)
      gsap.set(elements.disc, {
        left: 'calc(50% - 75px)',
        top: '51px',
        scale: 1.0,
        transformOrigin: 'top left',
      })
    }
    if (elements.controls) {
      // 100% Native CSS Centered: right: calc(50% - 100px)
      gsap.set(elements.controls, {
        right: 'calc(50% - 100px)',
        top: '360px',
        scale: 1.0,
        transformOrigin: 'top right',
      })
    }
    if (elements.title) {
      // 100% Native Full-Width Centered
      gsap.set(elements.title, {
        left: '0px',
        right: '0px',
        top: '220px',
        textAlign: 'center',
        scale: tC.expandedScale,
        opacity: 1,
      })
    }
    if (elements.topTitle) gsap.set(elements.topTitle, { y: 8, opacity: 0, display: 'none' })
    if (elements.timeSubtitle) gsap.set(elements.timeSubtitle, { opacity: 0 })
    if (elements.header) gsap.set(elements.header, { opacity: 1 })
    if (elements.scrubber) gsap.set(elements.scrubber, { opacity: 1 })
    if (elements.sideControls) gsap.set(elements.sideControls, { opacity: 1 })
    if (elements.backdrop) gsap.set(elements.backdrop, { opacity: 1, pointerEvents: 'auto' })
    if (elements.hairline) gsap.set(elements.hairline, { opacity: 0 })
    if (elements.playlistView) gsap.set(elements.playlistView, { y: 14, opacity: 0, display: 'none', pointerEvents: 'none' })
    return
  }

  // mode === 'queue'
  if (elements.card) gsap.set(elements.card, { height: cC.expandedHeight, borderRadius: cC.borderRadius })
  if (elements.disc) {
    gsap.set(elements.disc, {
      left: '14px',
      top: '20px',
      scale: dC.queueScale,
      transformOrigin: 'top left',
    })
  }
  if (elements.controls) {
    gsap.set(elements.controls, {
      right: 'calc(50% - 100px)',
      top: '360px',
      scale: 1.0,
      transformOrigin: 'top right',
    })
  }
  if (elements.title) {
    gsap.set(elements.title, {
      left: '0px',
      right: '0px',
      top: '190px',
      textAlign: 'center',
      scale: 1.0,
      opacity: 0,
    })
  }
  if (elements.topTitle) gsap.set(elements.topTitle, { y: 0, opacity: 1, display: 'flex' })
  if (elements.timeSubtitle) gsap.set(elements.timeSubtitle, { opacity: 0 })
  if (elements.header) gsap.set(elements.header, { opacity: 1 })
  if (elements.scrubber) gsap.set(elements.scrubber, { opacity: 1 })
  if (elements.sideControls) gsap.set(elements.sideControls, { opacity: 1 })
  if (elements.backdrop) gsap.set(elements.backdrop, { opacity: 1, pointerEvents: 'auto' })
  if (elements.hairline) gsap.set(elements.hairline, { opacity: 0 })
  if (elements.playlistView) gsap.set(elements.playlistView, { y: 0, opacity: 1, display: 'flex', pointerEvents: 'auto' })
}

/**
 * Continuous 1:1 finger drag gesture interpolation (p in [0, 1])
 */
export function interpolateModeProgress(
  fromMode: 'expanded' | 'queue',
  progress: number,
  elements: MobilePlayerElements,
  cardWidth: number
) {
  const p = Math.min(1, Math.max(0, progress))
  const { card: cC, disc: dC, controls: kC } = MOBILE_CONSTANTS
  const safeW = Math.max(300, cardWidth || 360)

  if (elements.card) {
    const height = cC.expandedHeight - (cC.expandedHeight - cC.collapsedHeight) * p
    gsap.set(elements.card, { height, borderRadius: cC.borderRadius })
  }

  if (elements.disc) {
    if (fromMode === 'queue') {
      const left = 14 + (10 - 14) * p
      const top = 20 + (9 - 20) * p
      const scale = dC.queueScale + (dC.collapsedScale - dC.queueScale) * p
      gsap.set(elements.disc, { left: `${left}px`, top: `${top}px`, scale })
    } else {
      const discExpandedLeft = safeW / 2 - 75
      const discCollapsedLeft = 10
      const left = discExpandedLeft + (discCollapsedLeft - discExpandedLeft) * p
      const top = 51 + (9 - 51) * p
      const scale = 1.0 + (dC.collapsedScale - 1.0) * p
      gsap.set(elements.disc, { left: `${left}px`, top: `${top}px`, scale })
    }
  }

  if (elements.controls) {
    const ctrlExpandedRight = safeW / 2 - 100
    const ctrlCollapsedRight = 10
    const right = ctrlExpandedRight + (ctrlCollapsedRight - ctrlExpandedRight) * p
    const top = 360 + (9 - 360) * p
    const scale = 1.0 + (kC.collapsedScale - 1.0) * p
    gsap.set(elements.controls, { right: `${right}px`, top: `${top}px`, scale })
  }

  if (fromMode === 'queue') {
    if (elements.topTitle) {
      gsap.set(elements.topTitle, {
        opacity: Math.max(0, 1 - p * 2.5),
        y: -8 * p,
        display: p < 0.8 ? 'flex' : 'none',
      })
    }
    if (elements.title) {
      gsap.set(elements.title, {
        left: '54px',
        right: '128px',
        top: '10px',
        opacity: Math.min(1, Math.max(0, (p - 0.2) / 0.5)),
        scale: 1.0,
      })
    }
    if (elements.playlistView) {
      gsap.set(elements.playlistView, {
        opacity: Math.max(0, 1 - p * 3),
        display: p < 0.6 ? 'flex' : 'none',
      })
    }
  } else {
    if (elements.topTitle && p > 0.05) {
      gsap.set(elements.topTitle, { opacity: 0, display: 'none' })
    }
    if (elements.title) {
      const left = 0 + (54 - 0) * p
      const right = 0 + (128 - 0) * p
      const top = 220 + (10 - 220) * p
      const scale = 1.2 + (1.0 - 1.2) * p
      gsap.set(elements.title, {
        left: `${left}px`,
        right: `${right}px`,
        top: `${top}px`,
        scale,
        opacity: 1,
      })
    }
  }

  if (elements.timeSubtitle) gsap.set(elements.timeSubtitle, { opacity: Math.max(0, (p - 0.25) / 0.75) })
  if (elements.header) gsap.set(elements.header, { opacity: Math.max(0, 1 - p * 2.5) })
  if (elements.scrubber) gsap.set(elements.scrubber, { opacity: Math.max(0, 1 - p * 2.2) })
  if (elements.sideControls) gsap.set(elements.sideControls, { opacity: Math.max(0, 1 - p * 2.2) })
  if (elements.backdrop) gsap.set(elements.backdrop, { opacity: 1 - p, pointerEvents: p < 0.95 ? 'auto' : 'none' })
  if (elements.hairline) gsap.set(elements.hairline, { opacity: p > 0.7 ? (p - 0.7) / 0.3 : 0 })
}

/**
 * Unified GSAP mode transition engine
 */
export function runModeTransition(
  fromMode: MobilePlayerMode,
  toMode: MobilePlayerMode,
  elements: MobilePlayerElements,
  onComplete?: () => void
): gsap.core.Timeline {
  const { card: cC, disc: dC, controls: kC } = MOBILE_CONSTANTS

  const allTargets = [
    elements.card,
    elements.disc,
    elements.controls,
    elements.title,
    elements.topTitle,
    elements.timeSubtitle,
    elements.header,
    elements.scrubber,
    elements.sideControls,
    elements.backdrop,
    elements.hairline,
    elements.playlistView,
  ].filter(Boolean)

  gsap.killTweensOf(allTargets)

  const tl = gsap.timeline({
    onComplete: () => {
      applyModeGeometryInstant(elements, toMode)
      onComplete?.()
    },
  })

  // -------------------------------------------------------------
  // Scenario 1: Expanded <-> Queue
  // -------------------------------------------------------------
  if (fromMode === 'expanded' && toMode === 'queue') {
    if (elements.title) {
      tl.to(elements.title, { top: '190px', opacity: 0, duration: 0.14, ease: 'power2.in' }, 0)
    }
    if (elements.disc) {
      tl.to(
        elements.disc,
        {
          left: '14px',
          top: '20px',
          scale: dC.queueScale,
          duration: 0.38,
          ease: 'power3.out',
        },
        0
      )
    }
    if (elements.playlistView) {
      gsap.set(elements.playlistView, { display: 'flex', pointerEvents: 'auto' })
      tl.fromTo(
        elements.playlistView,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out' },
        0.1
      )
    }
    if (elements.topTitle) {
      gsap.set(elements.topTitle, { display: 'flex', opacity: 0, y: 8 })
      tl.to(elements.topTitle, { y: 0, opacity: 1, duration: 0.24, ease: 'power2.out' }, 0.22)
    }
    return tl
  }

  if (fromMode === 'queue' && toMode === 'expanded') {
    if (elements.topTitle) {
      tl.to(elements.topTitle, { y: -6, opacity: 0, duration: 0.12, ease: 'power2.in' }, 0)
    }
    if (elements.playlistView) {
      tl.to(elements.playlistView, { opacity: 0, duration: 0.15, ease: 'power2.in' }, 0)
    }
    if (elements.disc) {
      tl.to(
        elements.disc,
        {
          left: 'calc(50% - 75px)',
          top: '51px',
          scale: 1.0,
          duration: 0.38,
          ease: 'power3.out',
        },
        0
      )
    }
    if (elements.title) {
      tl.to(elements.title, { top: '220px', opacity: 1, scale: 1.2, duration: 0.25, ease: 'power2.out' }, 0.18)
    }
    return tl
  }

  // -------------------------------------------------------------
  // Scenario 2: Direct Collapse from Queue to Collapsed
  // -------------------------------------------------------------
  if (fromMode === 'queue' && toMode === 'collapsed') {
    if (elements.card) {
      tl.to(elements.card, { height: cC.collapsedHeight, duration: 0.38, ease: 'power3.inOut' }, 0)
    }
    if (elements.disc) {
      tl.to(
        elements.disc,
        {
          left: '10px',
          top: '9px',
          scale: dC.collapsedScale,
          duration: 0.38,
          ease: 'power3.inOut',
        },
        0
      )
    }
    if (elements.controls) {
      tl.to(
        elements.controls,
        {
          right: '10px',
          top: '9px',
          scale: kC.collapsedScale,
          duration: 0.38,
          ease: 'power3.inOut',
        },
        0
      )
    }
    if (elements.topTitle) {
      tl.to(elements.topTitle, { opacity: 0, y: -8, duration: 0.18, ease: 'power2.in' }, 0)
    }
    if (elements.playlistView) {
      tl.to(elements.playlistView, { opacity: 0, duration: 0.15, ease: 'power2.in' }, 0)
    }
    if (elements.title) {
      gsap.set(elements.title, { left: '54px', right: '128px', top: '10px', scale: 1.0 })
      tl.to(elements.title, { opacity: 1, duration: 0.22, ease: 'power2.out' }, 0.16)
    }
    if (elements.timeSubtitle) tl.to(elements.timeSubtitle, { opacity: 1, duration: 0.2 }, 0.18)
    if (elements.header) tl.to(elements.header, { opacity: 0, duration: 0.2 }, 0)
    if (elements.scrubber) tl.to(elements.scrubber, { opacity: 0, duration: 0.2 }, 0)
    if (elements.sideControls) tl.to(elements.sideControls, { opacity: 0, duration: 0.2 }, 0)
    if (elements.backdrop) tl.to(elements.backdrop, { opacity: 0, duration: 0.38 }, 0)
    if (elements.hairline) tl.to(elements.hairline, { opacity: 1, duration: 0.2 }, 0.18)
    return tl
  }

  // -------------------------------------------------------------
  // Scenario 3: Standard Collapsed <-> Expanded Transitions
  // -------------------------------------------------------------
  const isExpanding = toMode === 'expanded'
  const duration = 0.38
  const ease = isExpanding ? 'power3.out' : 'power3.inOut'

  if (elements.card) {
    tl.to(elements.card, { height: isExpanding ? cC.expandedHeight : cC.collapsedHeight, duration, ease }, 0)
  }

  if (elements.disc) {
    tl.to(
      elements.disc,
      {
        left: isExpanding ? 'calc(50% - 75px)' : '10px',
        top: isExpanding ? '51px' : '9px',
        scale: isExpanding ? 1.0 : dC.collapsedScale,
        duration,
        ease,
      },
      0
    )
  }

  if (elements.controls) {
    tl.to(
      elements.controls,
      {
        right: isExpanding ? 'calc(50% - 100px)' : '10px',
        top: isExpanding ? '360px' : '9px',
        scale: isExpanding ? 1.0 : kC.collapsedScale,
        duration,
        ease,
      },
      0
    )
  }

  if (elements.title) {
    tl.to(
      elements.title,
      {
        left: isExpanding ? '0px' : '54px',
        right: isExpanding ? '0px' : '128px',
        top: isExpanding ? '220px' : '10px',
        scale: isExpanding ? 1.2 : 1.0,
        opacity: 1,
        duration,
        ease,
      },
      0
    )
  }

  if (elements.timeSubtitle) {
    tl.to(elements.timeSubtitle, { opacity: isExpanding ? 0 : 1, duration: 0.2 }, isExpanding ? 0 : 0.18)
  }
  if (elements.header) {
    tl.to(elements.header, { opacity: isExpanding ? 1 : 0, duration: 0.25 }, isExpanding ? 0.12 : 0)
  }
  if (elements.scrubber) {
    tl.to(elements.scrubber, { opacity: isExpanding ? 1 : 0, duration: 0.25 }, isExpanding ? 0.12 : 0)
  }
  if (elements.sideControls) {
    tl.to(elements.sideControls, { opacity: isExpanding ? 1 : 0, duration: 0.25 }, isExpanding ? 0.12 : 0)
  }
  if (elements.backdrop) {
    tl.to(elements.backdrop, { opacity: isExpanding ? 1 : 0, duration }, 0)
  }
  if (elements.hairline) {
    tl.to(elements.hairline, { opacity: isExpanding ? 0 : 1, duration: 0.2 }, isExpanding ? 0 : 0.18)
  }

  return tl
}
