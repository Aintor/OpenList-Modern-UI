import { create } from 'zustand'
import { Obj, ObjType } from '~/types'
import { fsGet } from '~/utils/api'
import { useObjStore } from '~/store/useObjStore'

export interface AudioTrack {
  obj: Obj
  path: string
  rawUrl?: string
}

export type RepeatMode = 'list' | 'one' | 'shuffle'

const AUDIO_EXTS = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'opus', 'ape', 'wma', 'alac']

export const isAudioFile = (obj: Obj): boolean => {
  if (obj.is_dir) return false
  if (obj.type === ObjType.AUDIO) return true
  const ext = obj.name.toLowerCase().split('.').pop() || ''
  return AUDIO_EXTS.includes(ext)
}

interface AudioPlayerState {
  activeTrack: AudioTrack | null
  playlist: AudioTrack[]
  currentIndex: number
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  repeatMode: RepeatMode
  isExpanded: boolean
  isPlaylistOpen: boolean
  loading: boolean

  // Actions
  playTrack: (obj: Obj, path: string, folderObjs?: Obj[]) => Promise<void>
  togglePlay: () => void
  pause: () => void
  resume: () => void
  seekTo: (time: number) => void
  nextTrack: () => void
  prevTrack: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setRepeatMode: (mode: RepeatMode) => void
  togglePlaylist: (open?: boolean) => void
  setExpanded: (expanded: boolean) => void
  closePlayer: () => void
  updateTime: (currentTime: number, duration: number) => void
}

const savedVolume = (() => {
  const v = localStorage.getItem('openlist_audio_volume')
  return v !== null ? Math.max(0, Math.min(1, parseFloat(v))) : 0.8
})()

const savedRepeat = (() => {
  const r = localStorage.getItem('openlist_audio_repeat') as RepeatMode
  return ['list', 'one', 'shuffle'].includes(r) ? r : 'list'
})()

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => ({
  activeTrack: null,
  playlist: [],
  currentIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: savedVolume,
  isMuted: false,
  repeatMode: savedRepeat,
  isExpanded: false,
  isPlaylistOpen: false,
  loading: false,

  playTrack: async (obj: Obj, path: string, folderObjs?: Obj[]) => {
    // 1. Build playlist from folder files if available
    let playlist: AudioTrack[] = []
    if (folderObjs && folderObjs.length > 0) {
      playlist = folderObjs.filter(isAudioFile).map((o) => ({
        obj: o,
        path,
      }))
    }

    if (playlist.length === 0) {
      playlist = [{ obj, path }]
    }

    let targetIndex = playlist.findIndex((item) => item.obj.name === obj.name)
    if (targetIndex === -1) {
      playlist.unshift({ obj, path })
      targetIndex = 0
    }

    const currentTrack = playlist[targetIndex]

    set({
      playlist,
      currentIndex: targetIndex,
      activeTrack: currentTrack,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
      loading: true,
    })

    // Fetch streaming raw_url if needed
    try {
      const password = useObjStore.getState().password
      const fullPath = (path.endsWith('/') ? path : path + '/') + obj.name
      const resp = await fsGet(fullPath, password)

      if (resp.code === 200 && resp.data) {
        const rawUrl = resp.data.raw_url
        const updatedTrack = {
          ...currentTrack,
          rawUrl,
        }

        const updatedPlaylist = [...get().playlist]
        updatedPlaylist[targetIndex] = updatedTrack

        set({
          activeTrack: updatedTrack,
          playlist: updatedPlaylist,
          loading: false,
        })
      } else {
        set({ loading: false })
      }
    } catch (e) {
      set({ loading: false })
    }
  },

  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }))
  },

  pause: () => {
    set({ isPlaying: false })
  },

  resume: () => {
    set({ isPlaying: true })
  },

  seekTo: (time: number) => {
    set({ currentTime: time })
  },

  nextTrack: async () => {
    const { playlist, currentIndex, repeatMode } = get()
    if (playlist.length === 0) return

    let nextIndex = currentIndex
    if (repeatMode === 'shuffle') {
      if (playlist.length === 1) {
        nextIndex = 0
      } else {
        do {
          nextIndex = Math.floor(Math.random() * playlist.length)
        } while (nextIndex === currentIndex && playlist.length > 1)
      }
    } else {
      nextIndex = (currentIndex + 1) % playlist.length
    }

    const nextObj = playlist[nextIndex]
    if (nextObj) {
      await get().playTrack(nextObj.obj, nextObj.path, playlist.map((p) => p.obj))
    }
  },

  prevTrack: async () => {
    const { playlist, currentIndex, repeatMode } = get()
    if (playlist.length === 0) return

    let prevIndex = currentIndex
    if (repeatMode === 'shuffle') {
      prevIndex = Math.floor(Math.random() * playlist.length)
    } else {
      prevIndex = (currentIndex - 1 + playlist.length) % playlist.length
    }

    const prevObj = playlist[prevIndex]
    if (prevObj) {
      await get().playTrack(prevObj.obj, prevObj.path, playlist.map((p) => p.obj))
    }
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    localStorage.setItem('openlist_audio_volume', clamped.toString())
    set({ volume: clamped, isMuted: clamped === 0 })
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }))
  },

  setRepeatMode: (mode: RepeatMode) => {
    localStorage.setItem('openlist_audio_repeat', mode)
    set({ repeatMode: mode })
  },

  togglePlaylist: (open?: boolean) => {
    set((state) => ({ isPlaylistOpen: open !== undefined ? open : !state.isPlaylistOpen }))
  },

  setExpanded: (expanded: boolean) => {
    set({ isExpanded: expanded })
  },

  closePlayer: () => {
    set({
      activeTrack: null,
      playlist: [],
      currentIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isExpanded: false,
      isPlaylistOpen: false,
    })
  },

  updateTime: (currentTime: number, duration: number) => {
    set({ currentTime, duration: duration || 0 })
  },
}))
