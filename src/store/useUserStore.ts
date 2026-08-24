import { create } from 'zustand'
import { User } from '~/types'
import { authLogin, me } from '~/utils/api'
import { changeToken } from '~/utils/request'
import { notify } from '~/utils/notify'
import { useI18n, translate } from '~/lang'

export interface LoginResult {
  success: boolean
  needOtp?: boolean
  message?: string
}

interface UserState {
  user: User | null
  token: string | null
  loading: boolean
  initialized: boolean
  guestDisabled: boolean
  login: (username: string, password: string, otp?: string) => Promise<LoginResult>
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  initialized: false,
  guestDisabled: false,

  login: async (username, password, otp) => {
    set({ loading: true })
    const locale = useI18n.getState().locale
    try {
      const resp = await authLogin(username, password, otp)
      if (resp.code === 200 && resp.data?.token) {
        changeToken(resp.data.token)
        set({ token: resp.data.token, loading: false })
        notify.success(translate(locale, 'login.success') || '登录成功')
        // fetch user details
        const meResp = await me()
        if (meResp.code === 200 && meResp.data) {
          set({ user: meResp.data, guestDisabled: false })
        }
        return { success: true }
      } else {
        const msg = (resp.message || '').toLowerCase()
        const isOtpRequired =
          msg.includes('otp') ||
          msg.includes('2fa') ||
          msg.includes('验证码') ||
          msg.includes('totp')

        if (isOtpRequired && !otp) {
          notify.info(resp.message || translate(locale, 'login.otp-tips') || '请输入 2FA / OTP 验证码')
          set({ loading: false })
          return { success: false, needOtp: true, message: resp.message }
        }

        notify.error(resp.message || translate(locale, 'login.failed') || '登录失败')
        set({ loading: false })
        return { success: false, message: resp.message }
      }
    } catch (err: any) {
      notify.error(err.message || '登录异常')
      set({ loading: false })
      return { success: false, message: err.message }
    }
  },

  logout: () => {
    const locale = useI18n.getState().locale
    changeToken(undefined)
    set({ user: null, token: null })
    notify.info(translate(locale, 'manage.logout_success') || '登出成功')
    get().fetchUser()
  },

  fetchUser: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      // Unauthenticated: test if backend enables guest access
      try {
        const resp = await me()
        if (resp.code === 200 && resp.data) {
          set({ user: resp.data, guestDisabled: false, initialized: true })
        } else {
          const msg = (resp.message || '').toLowerCase()
          const isGuestDisabled =
            resp.code === 401 ||
            msg.includes('guest') ||
            msg.includes('login') ||
            msg.includes('disable')
          set({ user: null, token: null, guestDisabled: isGuestDisabled, initialized: true })
        }
      } catch {
        set({ user: null, token: null, guestDisabled: true, initialized: true })
      }
      return
    }

    try {
      const resp = await me()
      if (resp.code === 200 && resp.data) {
        set({ user: resp.data, guestDisabled: false, initialized: true })
      } else {
        // Token invalid / expired, purge and re-check guest
        changeToken(undefined)
        const guestResp = await me()
        if (guestResp.code === 200 && guestResp.data) {
          set({ user: guestResp.data, token: null, guestDisabled: false, initialized: true })
        } else {
          set({ user: null, token: null, guestDisabled: true, initialized: true })
        }
      }
    } catch {
      changeToken(undefined)
      set({ user: null, token: null, guestDisabled: true, initialized: true })
    }
  },
}))
