import React, { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface MarqueeTextProps {
  text: string
  className?: string
  containerClassName?: string
  speed?: number // px per second, default 24
  delay?: number // pause at start and end in seconds, default 1.8
  align?: 'left' | 'center'
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  className = '',
  containerClassName = '',
  speed = 24,
  delay = 1.8,
  align = 'center',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const textEl = textRef.current
    if (!container || !textEl) return

    let tween: gsap.core.Timeline | null = null

    const checkAndAnimate = () => {
      if (tween) {
        tween.kill()
        tween = null
      }
      gsap.killTweensOf(textEl)
      gsap.set(textEl, { x: 0 })

      const containerWidth = container.clientWidth
      const textWidth = textEl.scrollWidth
      const overflow = textWidth - containerWidth

      if (overflow > 2) {
        const overflowDistance = overflow + 6
        const duration = Math.max(1.2, overflowDistance / speed)

        if (align === 'center') {
          const startX = overflow / 2
          const endX = -overflow / 2 - 6
          gsap.set(textEl, { x: startX })

          tween = gsap.timeline({ repeat: -1, repeatDelay: delay })
          tween
            .to(textEl, {
              x: endX,
              duration,
              ease: 'power1.inOut',
              delay,
            })
            .to(textEl, {
              x: startX,
              duration,
              ease: 'power1.inOut',
              delay,
            })
        } else {
          gsap.set(textEl, { x: 0 })

          tween = gsap.timeline({ repeat: -1, repeatDelay: delay })
          tween
            .to(textEl, {
              x: -overflowDistance,
              duration,
              ease: 'power1.inOut',
              delay,
            })
            .to(textEl, {
              x: 0,
              duration,
              ease: 'power1.inOut',
              delay,
            })
        }
      } else {
        gsap.set(textEl, { x: 0 })
      }
    }

    checkAndAnimate()

    const ro = new ResizeObserver(() => {
      checkAndAnimate()
    })
    ro.observe(container)

    return () => {
      if (tween) tween.kill()
      gsap.killTweensOf(textEl)
      ro.disconnect()
    }
  }, [text, speed, delay, align])

  if (!text) return null

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden w-full relative leading-none ${
        align === 'center' ? 'text-center' : 'text-left'
      } ${containerClassName}`}
      title={text}
    >
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap will-change-transform ${className}`}
      >
        {text}
      </span>
    </div>
  )
}
