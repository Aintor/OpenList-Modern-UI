import React, { useEffect, useRef } from 'react'
import { useAudioPlayerStore } from '~/store/useAudioPlayerStore'
import { useSettingsStore } from '~/store/useSettingsStore'
import { useAudioMetadata } from '~/utils/audioMeta'
import { globalAudioEngine } from '~/utils/audio'
import { DesktopAudioPlayer } from '~/components/player/DesktopAudioPlayer'
import { MobileAudioPlayer } from '~/components/player/MobileAudioPlayer'

export const GlobalAudioPlayer: React.FC = () => {
  const getSetting = useSettingsStore((state) => state.getSetting)
  const siteTitle = getSetting('site_title') || 'OpenList'

  const {
    activeTrack,
    isPlaying,
    volume,
    isMuted,
    resume,
    pause,
    nextTrack,
    prevTrack,
    seekTo,
    updateTime,
  } = useAudioPlayerStore()

  const metadata = useAudioMetadata(activeTrack?.obj || null, activeTrack?.path || '/')
  const lastRawUrlRef = useRef<string | null>(null)

  // 1. Synchronize globalAudioEngine with active track changes (with HMR anti-loop guard)
  useEffect(() => {
    if (!activeTrack?.rawUrl) {
      lastRawUrlRef.current = null
      globalAudioEngine.stop()
      return
    }

    if (lastRawUrlRef.current !== activeTrack.rawUrl) {
      lastRawUrlRef.current = activeTrack.rawUrl
      globalAudioEngine.play(
        {
          rawUrl: activeTrack.rawUrl,
          name: activeTrack.obj.name,
          size: activeTrack.obj.size,
        },
        0
      )
    }
  }, [activeTrack?.rawUrl])

  // 2. Play / Pause synchronization
  useEffect(() => {
    if (isPlaying) {
      globalAudioEngine.resume()
    } else {
      globalAudioEngine.pause()
    }
  }, [isPlaying])

  // 3. Volume and Mute synchronization
  useEffect(() => {
    globalAudioEngine.setVolume(volume)
    globalAudioEngine.setMuted(isMuted)
  }, [volume, isMuted])

  // 4. Audio Engine events routing
  useEffect(() => {
    const unsubTime = globalAudioEngine.on('timeupdate', ({ currentTime: ct, duration: dur }) => {
      updateTime(ct, dur)
    })

    const unsubEnded = globalAudioEngine.on('ended', () => {
      nextTrack()
    })

    return () => {
      unsubTime()
      unsubEnded()
    }
  }, [nextTrack, updateTime])

  // 5. System MediaSession API integration
  useEffect(() => {
    if (!activeTrack || !('mediaSession' in navigator)) return

    const displayTitle = metadata.title || activeTrack.obj.name
    const displayArtist = metadata.artist || siteTitle
    const displayAlbum = metadata.album || activeTrack.path
    const artwork = metadata.coverUrl ? [{ src: metadata.coverUrl }] : []

    navigator.mediaSession.metadata = new MediaMetadata({
      title: displayTitle,
      artist: displayArtist,
      album: displayAlbum,
      artwork,
    })

    navigator.mediaSession.setActionHandler('play', () => resume())
    navigator.mediaSession.setActionHandler('pause', () => pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack())
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack())
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        globalAudioEngine.seek(details.seekTime)
        seekTo(details.seekTime)
      }
    })

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('previoustrack', null)
        navigator.mediaSession.setActionHandler('nexttrack', null)
        navigator.mediaSession.setActionHandler('seekto', null)
      } catch {}
    }
  }, [
    activeTrack,
    siteTitle,
    metadata.title,
    metadata.artist,
    metadata.album,
    metadata.coverUrl,
    resume,
    pause,
    nextTrack,
    prevTrack,
    seekTo,
  ])

  if (!activeTrack) return null

  const handleSeek = (time: number) => {
    globalAudioEngine.seek(time)
    seekTo(time)
  }

  return (
    <>
      <DesktopAudioPlayer metadata={metadata} onSeek={handleSeek} />
      <MobileAudioPlayer metadata={metadata} onSeek={handleSeek} />
    </>
  )
}
