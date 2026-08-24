import { create } from 'zustand'
import { StoreObj, Obj } from '~/types'
import { fsList } from '~/utils/api'
import { notify } from '~/utils/notify'
import { useSettingsStore } from './useSettingsStore'

export type OrderBy = 'name' | 'size' | 'modified'

export const sortObjs = <T extends Obj>(rawContent: T[], orderBy: OrderBy, currentReverse: boolean): T[] => {
  return [...rawContent].sort((a, b) => {
    if (a.is_dir !== b.is_dir) {
      return a.is_dir ? -1 : 1
    }
    let comparison = 0
    if (orderBy === 'name') {
      comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    } else if (orderBy === 'size') {
      comparison = (a.size || 0) - (b.size || 0)
    } else if (orderBy === 'modified') {
      comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime()
    }
    return currentReverse ? -comparison : comparison
  })
}

interface ObjState {
  currentPath: string
  objs: StoreObj[]
  total: number
  page: number
  pageSize: number
  loadingMore: boolean
  readme: string
  header: string
  write: boolean
  provider: string
  direct_upload_tools: string[]
  loading: boolean
  needPassword: boolean
  password: string
  orderBy: OrderBy
  orderReverse: boolean
  lastCheckedIndex: number
  notFound: boolean
  errorMsg: string | null

  // Actions
  fetchPath: (
    path?: string,
    password?: string,
    refresh?: boolean,
    isRetry?: boolean,
    targetPage?: number,
    silent?: boolean
  ) => Promise<void>
  clearNotFound: () => void
  loadMore: () => Promise<void>
  goToPage: (targetPage: number) => Promise<void>
  setPassword: (password: string) => void
  setOrderBy: (orderBy: OrderBy, reverse?: boolean) => void
  selectIndex: (index: number, selected: boolean, singleSelect?: boolean) => void
  selectRange: (startIndex: number, endIndex: number) => void
  setSelectedIndices: (indices: Set<number>) => void
  selectAll: (selected: boolean) => void
  clearSelection: () => void
  getSelectedObjs: () => StoreObj[]
}

export const useObjStore = create<ObjState>((set, get) => ({
  currentPath: '/',
  objs: [],
  total: 0,
  page: 1,
  pageSize: 30,
  loadingMore: false,
  readme: '',
  header: '',
  write: false,
  provider: '',
  direct_upload_tools: [],
  loading: false,
  needPassword: false,
  password: '',
  orderBy: 'name',
  orderReverse: false,
  lastCheckedIndex: -1,
  notFound: false,
  errorMsg: null,

  setPassword: (password: string) => set({ password }),
  clearNotFound: () => set({ notFound: false, errorMsg: null }),

  fetchPath: async (
    path?: string,
    pwd?: string,
    refresh = false,
    isRetry = false,
    targetPage = 1,
    silent = false
  ) => {
    const activePath = path !== undefined ? path : get().currentPath
    let cleanPath = '/'
    try {
      cleanPath = decodeURIComponent(activePath || '/')
    } catch (e) {
      cleanPath = activePath || '/'
    }
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath
    }

    const urlPwd = new URLSearchParams(window.location.search).get('pwd') || ''
    const currentStoredPwd = get().password
    const finalPassword = pwd !== undefined ? pwd : (urlPwd || currentStoredPwd || '')

    const pagination = useSettingsStore.getState().getPagination()
    const perPage = pagination.type === 'all' ? 0 : pagination.size
    const isIncremental = (pagination.type === 'load_more' || pagination.type === 'auto_load_more') && targetPage > 1

    if (isIncremental) {
      set({ loadingMore: true })
    } else {
      set({
        loading: !silent,
        currentPath: cleanPath,
        password: finalPassword,
        page: targetPage,
        pageSize: pagination.size,
        notFound: false,
        errorMsg: null,
      })
    }

    try {
      const resp = await fsList(cleanPath, finalPassword, targetPage, perPage, refresh)
      if (resp.code === 200 && resp.data) {
        const rawContent = resp.data.content || []
        const currentOrderBy = get().orderBy
        const currentReverse = get().orderReverse

        const sorted = sortObjs(rawContent, currentOrderBy, currentReverse)
        const mapped: StoreObj[] = sorted.map((item) => ({
          ...item,
          selected: false,
        }))

        let nextObjs: StoreObj[] = []
        if (isIncremental) {
          const existingNames = new Set(get().objs.map((o) => o.name))
          const newItems = mapped.filter((o) => !existingNames.has(o.name))
          nextObjs = [...get().objs, ...newItems]
        } else {
          nextObjs = mapped
        }

        set({
          objs: nextObjs,
          total: resp.data.total !== undefined ? resp.data.total : nextObjs.length,
          page: targetPage,
          readme: resp.data.readme || (isIncremental ? get().readme : ''),
          header: resp.data.header || (isIncremental ? get().header : ''),
          write: !!resp.data.write,
          provider: resp.data.provider || '',
          direct_upload_tools: resp.data.direct_upload_tools || [],
          loading: false,
          loadingMore: false,
          needPassword: false,
          notFound: false,
          errorMsg: null,
          lastCheckedIndex: -1,
        })
      } else if (resp.code === 403) {
        set({ loading: false, loadingMore: false, needPassword: true, notFound: false, errorMsg: null, objs: [] })
        if (isRetry) {
          notify.error(resp.message || 'Wrong password or share code')
        }
      } else {
        const msg = (resp.message || '').toLowerCase()
        const isNotFound =
          resp.code === 404 ||
          msg.includes('not found') ||
          msg.includes('no such file') ||
          msg.includes('failed get storage') ||
          msg.includes('record not found') ||
          (cleanPath !== '/' && resp.code !== 401)

        if (!isNotFound && resp.code !== 401) {
          notify.error(resp.message || 'Failed to list directory')
        }
        set({
          loading: false,
          loadingMore: false,
          needPassword: false,
          notFound: isNotFound,
          errorMsg: resp.message || 'Path not found',
          objs: isIncremental ? get().objs : []
        })
      }
    } catch (err: any) {
      console.error('Fetch path error:', err)
      const isNotFound = cleanPath !== '/'
      set({
        loading: false,
        loadingMore: false,
        notFound: isNotFound,
        errorMsg: err?.message || 'Network error or path not found'
      })
    }
  },

  loadMore: async () => {
    const { page, total, loading, loadingMore, currentPath, password, objs } = get()
    const pagination = useSettingsStore.getState().getPagination()
    if (loading || loadingMore) return
    if (pagination.type === 'all' || pagination.type === 'pagination') return
    if (objs.length >= total && total > 0) return

    await get().fetchPath(currentPath, password, false, false, page + 1)
  },

  goToPage: async (targetPage: number) => {
    const { currentPath, password, loading } = get()
    if (loading) return
    await get().fetchPath(currentPath, password, false, false, targetPage)
  },

  setOrderBy: (orderBy: OrderBy, reverse?: boolean) => {
    const currentReverse = reverse !== undefined ? reverse : get().orderBy === orderBy ? !get().orderReverse : false
    const sorted = sortObjs(get().objs, orderBy, currentReverse)

    set({
      objs: sorted,
      orderBy,
      orderReverse: currentReverse,
    })
  },

  selectIndex: (index: number, selected: boolean, singleSelect = false) => {
    set((state) => {
      const next = state.objs.map((obj, i) => {
        if (singleSelect) {
          return { ...obj, selected: i === index ? selected : false }
        }
        if (i === index) {
          return { ...obj, selected }
        }
        return obj
      })
      return { objs: next, lastCheckedIndex: index }
    })
  },

  selectRange: (startIndex: number, endIndex: number) => {
    const min = Math.min(startIndex, endIndex)
    const max = Math.max(startIndex, endIndex)
    set((state) => ({
      objs: state.objs.map((obj, i) => ({
        ...obj,
        selected: i >= min && i <= max,
      })),
    }))
  },

  setSelectedIndices: (indices: Set<number>) => {
    set((state) => ({
      objs: state.objs.map((obj, i) => ({
        ...obj,
        selected: indices.has(i),
      })),
    }))
  },

  selectAll: (selected: boolean) => {
    set((state) => ({
      objs: state.objs.map((obj) => ({
        ...obj,
        selected,
      })),
    }))
  },

  clearSelection: () => {
    set((state) => ({
      objs: state.objs.map((obj) => ({
        ...obj,
        selected: false,
      })),
    }))
  },

  getSelectedObjs: () => {
    return get().objs.filter((obj) => obj.selected)
  },
}))
