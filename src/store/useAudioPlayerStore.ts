import { create } from 'zustand'
import { Obj, ObjType } from '~/types'
import { fsGet, fsList } from '~/utils/api'
import { useObjStore } from '~/store/useObjStore'

export interface AudioTrack {
  obj: Obj
  path: string
  rawUrl?: string
}

export type RepeatMode = 'list' | 'one' | 'off' | 'shuffle'

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
  playTracks: (tracks: { obj: Obj; path: string }[]) => Promise<void>
  insertNext: (tracks: { obj: Obj; path: string }[]) => void
  addToPlaylist: (tracks: { obj: Obj; path: string }[]) => void
  removeTrack: (index: number) => void
  moveTrack: (fromIndex: number, toIndex: number) => void
  moveTrackUp: (index: number) => void
  moveTrackDown: (index: number) => void
  clearPlaylist: () => void
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
  return ['list', 'one', 'off', 'shuffle'].includes(r) ? r : 'list'
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
    // 1. Build initial playlist immediately from available folder files (0ms delay)
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

    const password = useObjStore.getState().password
    const objStoreState = useObjStore.getState()
    const isPaginated = objStoreState.total > (folderObjs?.length || 0) && objStoreState.currentPath === path

    // 2. If folder has unrendered/paginated items, asynchronously fetch full directory metadata in background
    if (isPaginated) {
      fsList(path, password, 1, 0)
        .then((resp) => {
          if (resp.code === 200 && resp.data?.content) {
            const allAudios: AudioTrack[] = resp.data.content.filter(isAudioFile).map((o) => ({
              obj: o,
              path,
            }))
            if (allAudios.length > 0) {
              const currentActive = get().activeTrack
              const newIndex = allAudios.findIndex(
                (item) => item.obj.name === (currentActive?.obj?.name || obj.name)
              )
              if (newIndex !== -1) {
                if (currentActive?.rawUrl) {
                  allAudios[newIndex].rawUrl = currentActive.rawUrl
                }
                set({
                  playlist: allAudios,
                  currentIndex: newIndex,
                  activeTrack: allAudios[newIndex],
                })
              }
            }
          }
        })
        .catch(() => {
          // Gracefully keep initial playlist on failure
        })
    }

    // 3. Fetch streaming raw_url for current audio file
    try {
      const fullPath = (path.endsWith('/') ? path : path + '/') + obj.name
      const resp = await fsGet(fullPath, password)

      if (resp.code === 200 && resp.data) {
        const rawUrl = resp.data.raw_url
        const currentActive = get().activeTrack
        if (currentActive && currentActive.obj.name === obj.name) {
          const updatedTrack = {
            ...currentActive,
            rawUrl,
          }

          const updatedPlaylist = [...get().playlist]
          const currentIdx = get().currentIndex
          if (currentIdx >= 0 && currentIdx < updatedPlaylist.length) {
            updatedPlaylist[currentIdx] = updatedTrack
          }

          set({
            activeTrack: updatedTrack,
            playlist: updatedPlaylist,
            loading: false,
          })
        }
      } else {
        set({ loading: false })
      }
    } catch (e) {
      set({ loading: false })
    }
  },

  playTracks: async (tracks: { obj: Obj; path: string }[]) => {
    if (tracks.length === 0) return
    const first = tracks[0]
    set({
      playlist: tracks,
      currentIndex: 0,
      activeTrack: first,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
      loading: true,
    })

    try {
      const password = useObjStore.getState().password
      const fullPath = (first.path.endsWith('/') ? first.path : first.path + '/') + first.obj.name
      const resp = await fsGet(fullPath, password)

      if (resp.code === 200 && resp.data) {
        const updatedFirst = {
          ...first,
          rawUrl: resp.data.raw_url,
        }
        const updatedPlaylist = [...get().playlist]
        updatedPlaylist[0] = updatedFirst

        set({
          activeTrack: updatedFirst,
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

  insertNext: (tracks: { obj: Obj; path: string }[]) => {
    const { playlist, currentIndex, activeTrack } = get()
    if (!activeTrack || playlist.length === 0) {
      get().playTracks(tracks)
      return
    }

    const newItems: AudioTrack[] = tracks.map((t) => ({ obj: t.obj, path: t.path }))
    const updated = [...playlist]
    const insertPos = currentIndex + 1
    updated.splice(insertPos, 0, ...newItems)

    set({ playlist: updated })
  },

  addToPlaylist: (tracks: { obj: Obj; path: string }[]) => {
    const { playlist, activeTrack } = get()
    if (!activeTrack || playlist.length === 0) {
      get().playTracks(tracks)
      return
    }

    const newItems: AudioTrack[] = tracks.map((t) => ({ obj: t.obj, path: t.path }))
    set({ playlist: [...playlist, ...newItems] })
  },

  removeTrack: (index: number) => {
    const { playlist, currentIndex, isPlaying } = get()
    if (index < 0 || index >= playlist.length) return

    const newPlaylist = playlist.filter((_, i) => i !== index)

    if (newPlaylist.length === 0) {
      get().closePlayer()
      return
    }

    if (index === currentIndex) {
      // Removing the currently playing song
      const nextIndex = index >= newPlaylist.length ? 0 : index
      const nextTrackObj = newPlaylist[nextIndex]
      set({
        playlist: newPlaylist,
        currentIndex: nextIndex,
        activeTrack: nextTrackObj,
      })
      if (isPlaying) {
        get().playTrack(nextTrackObj.obj, nextTrackObj.path, newPlaylist.map((p) => p.obj))
      }
    } else if (index < currentIndex) {
      set({
        playlist: newPlaylist,
        currentIndex: currentIndex - 1,
      })
    } else {
      set({ playlist: newPlaylist })
    }
  },

  moveTrack: (fromIndex: number, toIndex: number) => {
    const { playlist, currentIndex } = get()
    if (
      fromIndex < 0 ||
      fromIndex >= playlist.length ||
      toIndex < 0 ||
      toIndex >= playlist.length ||
      fromIndex === toIndex
    ) {
      return
    }

    const updated = [...playlist]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)

    let newCurrentIndex = currentIndex
    if (fromIndex === currentIndex) {
      newCurrentIndex = toIndex
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
      newCurrentIndex = currentIndex - 1
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
      newCurrentIndex = currentIndex + 1
    }

    set({
      playlist: updated,
      currentIndex: newCurrentIndex,
      activeTrack: updated[newCurrentIndex] || null,
    })
  },

  moveTrackUp: (index: number) => {
    if (index > 0) {
      get().moveTrack(index, index - 1)
    }
  },

  moveTrackDown: (index: number) => {
    const { playlist } = get()
    if (index < playlist.length - 1) {
      get().moveTrack(index, index + 1)
    }
  },

  clearPlaylist: () => {
    get().closePlayer()
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
