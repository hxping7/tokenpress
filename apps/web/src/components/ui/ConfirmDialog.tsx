'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { Modal } from './Modal'

interface Props {
  open: boolean
  title: string
  /** 警告/说明正文，支持 JSX（如高亮强调句） */
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  /** 危险操作：确认按钮用红色 */
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onCancel} title={title}>
      <div className="flex gap-3">
        <div
          className={`shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${
            danger ? 'bg-red-500/10 text-red-500' : 'bg-t-accent-blue/10 text-t-accent-blue'
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 text-sm leading-relaxed text-t-text-secondary">{message}</div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg border border-t-border text-t-text-primary hover:bg-t-hover transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-60 ${
            danger
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-t-accent-blue text-black hover:opacity-90'
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" /> 处理中...
            </span>
          ) : (
            confirmText
          )}
        </button>
      </div>
    </Modal>
  )
}
