import { toast } from 'sonner'
import { firstUpperCase } from './str'

export const notify = {
  success: (message: string) => {
    toast.success(firstUpperCase(message))
  },
  error: (message: string) => {
    toast.error(firstUpperCase(message))
  },
  info: (message: string) => {
    toast.info(firstUpperCase(message))
  },
  warning: (message: string) => {
    toast.warning(firstUpperCase(message))
  },
  promise: <T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string | ((data: T) => string); error: string | ((err: any) => string) }
  ) => {
    return toast.promise(promise, msgs)
  }
}
