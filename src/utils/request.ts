import axios, { AxiosRequestConfig } from 'axios'
import { Resp } from '~/types'

const instance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json;charset=utf-8',
  },
  withCredentials: false,
})

instance.interceptors.request.use(
  (config) => {
    const isSharePage =
      typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/@s') || window.location.pathname.startsWith('/@share'))

    // On public share pages, do not attach user authorization token to fs requests so backend treats it as pure public share
    const isFsOperation = config.url?.startsWith('/fs/')
    const token = localStorage.getItem('token')
    if (token && !(isSharePage && isFsOperation)) {
      config.headers['Authorization'] = token
    }
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

instance.interceptors.response.use(
  (response) => {
    const resp = response.data
    return resp
  },
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }
    console.error('Network/Response Error:', error)
    const message = error.response?.data?.message || error.message || 'Network error'
    return {
      code: error.response?.status || 500,
      message,
    }
  }
)

export const changeToken = (token?: string) => {
  if (token) {
    instance.defaults.headers.common['Authorization'] = token
    localStorage.setItem('token', token)
  } else {
    delete instance.defaults.headers.common['Authorization']
    localStorage.removeItem('token')
  }
}

export interface RequestClient {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<Resp<T>>
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Resp<T>>
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<Resp<T>>
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<Resp<T>>
}

export const r = instance as unknown as RequestClient
