import { Toaster, toast } from 'sonner'

export { Toaster, toast }

// 预定义的 Toast 样式
export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
  })
}

export const showError = (message: string) => {
  toast.error(message, {
    duration: 5000,
  })
}

export const showInfo = (message: string) => {
  toast.info(message, {
    duration: 3000,
  })
}

export const showLoading = (message: string, promise: Promise<any>) => {
  return toast.promise(promise, {
    loading: message,
    success: '操作成功',
    error: '操作失败',
  })
}
