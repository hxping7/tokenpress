'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import {
  Folder, FolderOpen, File as FileIcon, Upload, Trash2, ExternalLink, Copy, Plus,
  X, Eye, RefreshCw, ChevronRight, ChevronDown, Pencil, Check,
} from 'lucide-react'

interface FileNode {
  type: 'file'
  name: string
  relPath: string
  url: string
  size: number
  ext: string
  mtime: string
}
interface DirNode {
  type: 'folder'
  name: string
  relPath: string
  children: TreeNode[]
}
type TreeNode = FileNode | DirNode

const TEXT_EXTS = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'json', 'svg', 'txt', 'md',
  'markdown', 'map', 'xml', 'webmanifest',
])

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function StaticHtmlPage() {
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const { backendLocale } = useLocaleStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [newFolderPath, setNewFolderPath] = useState('')
  const [pendingFolder, setPendingFolder] = useState<string>('')
  const [toast, setToast] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ type: 'folder' | 'file'; relPath: string; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['statichtml-tree'],
    queryFn: () => api.get('/statichtml/tree'),
  })

  const tree: TreeNode[] = data?.data?.tree || []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['statichtml-tree'] })
    queryClient.invalidateQueries({ queryKey: ['statichtml-list'] })
  }

  const createFolderMutation = useMutation({
    mutationFn: (path: string) => api.post('/statichtml/folder', { path }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => { invalidate(); setNewFolderPath('') },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (path: string) => api.delete('/statichtml/folder', { data: { path }, headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => invalidate(),
  })

  const deleteFileMutation = useMutation({
    mutationFn: (relPath: string) => api.delete('/statichtml/file', { data: { relPath }, headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => invalidate(),
  })

  const uploadMutation = useMutation({
    mutationFn: async (payload: { folder: string; filename: string; content?: string; file?: string; mimeType: string }) =>
      api.post('/statichtml/file', payload, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => invalidate(),
  })

  const renameFolderMutation = useMutation({
    mutationFn: (p: { path: string; newName: string }) => api.patch('/statichtml/folder', p, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => { invalidate(); cancelRename() },
  })

  const renameFileMutation = useMutation({
    mutationFn: (p: { relPath: string; newName: string }) => api.patch('/statichtml/file', p, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => { invalidate(); cancelRename() },
  })

  const startRename = (type: 'folder' | 'file', relPath: string, name: string) => {
    setRenaming({ type, relPath, name })
    setRenameValue(name)
  }
  const cancelRename = () => {
    setRenaming(null)
    setRenameValue('')
  }
  const submitRename = () => {
    if (!renaming || !renameValue.trim()) return
    if (renaming.type === 'folder') {
      renameFolderMutation.mutate({ path: renaming.relPath, newName: renameValue.trim() })
    } else {
      renameFileMutation.mutate({ relPath: renaming.relPath, newName: renameValue.trim() })
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const readFile = (file: File): Promise<{ filename: string; content?: string; file?: string; mimeType: string }> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      if (TEXT_EXTS.has(ext)) {
        reader.onload = () => resolve({ filename: file.name, content: reader.result as string, mimeType: file.type || 'text/plain' })
        reader.onerror = reject
        reader.readAsText(file)
      } else {
        reader.onload = () => resolve({ filename: file.name, file: (reader.result as string).split(',')[1], mimeType: file.type || 'application/octet-stream' })
        reader.onerror = reject
        reader.readAsDataURL(file)
      }
    })
  }

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const folder = pendingFolder
    for (const file of Array.from(files)) {
      try {
        const body = await readFile(file)
        await uploadMutation.mutateAsync({ folder, ...body })
      } catch (err) {
        console.error('upload error', err)
        showToast(t('admin.staticHtmlPage.typeNotAllowed', backendLocale))
      }
    }
    setPendingFolder('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [pendingFolder, uploadMutation, backendLocale])

  const handleUploadClick = (folder: string) => {
    setPendingFolder(folder)
    fileInputRef.current?.click()
  }

  const copyUrl = (url: string) => {
    navigator.clipboard?.writeText(url).then(
      () => showToast(t('admin.staticHtmlPage.urlCopied', backendLocale)),
      () => showToast(url),
    )
  }

  const toggleExpand = (relPath: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(relPath) ? next.delete(relPath) : next.add(relPath)
      return next
    })
  }

  const renderNode = (node: TreeNode, depth: number) => {
    const pad = { paddingLeft: `${depth * 16 + 12}px` }
    if (node.type === 'folder') {
      const isOpen = expanded.has(node.relPath)
      return (
        <div key={node.relPath}>
          <div className="group flex items-center gap-2 py-2 pr-3 hover:bg-t-hover rounded-lg" style={pad}>
            <button onClick={() => toggleExpand(node.relPath)} className="text-t-text-secondary hover:text-t-text-primary">
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {isOpen ? <FolderOpen size={18} className="text-t-accent-blue" /> : <Folder size={18} className="text-t-accent-blue" />}
            {renaming?.type === 'folder' && renaming.relPath === node.relPath ? (
              <>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitRename()
                    if (e.key === 'Escape') cancelRename()
                  }}
                  className="flex-1 min-w-0 px-2 py-1 text-sm bg-t-bg-primary border border-t-accent-blue rounded focus:outline-none"
                />
                <button onClick={submitRename} className="p-1.5 text-t-accent-blue hover:bg-t-accent-blue/10 rounded" title={t('admin.staticHtmlPage.renameConfirm', backendLocale)}>
                  <Check size={15} />
                </button>
                <button onClick={cancelRename} className="p-1.5 text-t-text-secondary hover:text-t-text-primary rounded" title={t('common.cancel', backendLocale)}>
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 truncate text-sm font-medium">{node.name}</span>
                <button onClick={() => handleUploadClick(node.relPath)} className="p-1.5 opacity-0 group-hover:opacity-100 text-t-text-secondary hover:text-t-accent-blue rounded" title={t('admin.staticHtmlPage.upload', backendLocale)}>
                  <Upload size={15} />
                </button>
                <button onClick={() => startRename('folder', node.relPath, node.name)} className="p-1.5 opacity-0 group-hover:opacity-100 text-t-text-secondary hover:text-t-accent-blue rounded" title={t('admin.staticHtmlPage.rename', backendLocale)}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => { if (confirm(t('admin.staticHtmlPage.confirmDeleteFolder', backendLocale))) deleteFolderMutation.mutate(node.relPath) }} className="p-1.5 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10 rounded" title={t('admin.staticHtmlPage.delete', backendLocale)}>
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
          {isOpen && node.children.map(child => renderNode(child, depth + 1))}
        </div>
      )
    }
    const renamingThisFile = renaming?.type === 'file' && renaming.relPath === node.relPath
    return (
      <div key={node.relPath} className="group flex items-center gap-2 py-2 pr-3 hover:bg-t-hover rounded-lg" style={pad}>
        <span className="w-4" />
        <FileIcon size={18} className="text-t-text-secondary" />
        {renamingThisFile ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitRename()
              if (e.key === 'Escape') cancelRename()
            }}
            className="flex-1 min-w-0 px-2 py-1 text-sm bg-t-bg-primary border border-t-accent-blue rounded focus:outline-none"
          />
        ) : (
          <span className="flex-1 truncate text-sm">{node.name}</span>
        )}
        <span className="text-xs text-t-text-secondary hidden sm:inline">{formatSize(node.size)}</span>
        {renamingThisFile ? (
          <>
            <button onClick={submitRename} className="p-1.5 text-t-accent-blue hover:bg-t-accent-blue/10 rounded" title={t('admin.staticHtmlPage.renameConfirm', backendLocale)}>
              <Check size={15} />
            </button>
            <button onClick={cancelRename} className="p-1.5 text-t-text-secondary hover:text-t-text-primary rounded" title={t('common.cancel', backendLocale)}>
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setPreviewUrl(node.url)} className="p-1.5 opacity-0 group-hover:opacity-100 text-t-text-secondary hover:text-t-accent-blue rounded" title={t('admin.staticHtmlPage.preview', backendLocale)}>
              <Eye size={15} />
            </button>
            <a href={node.url} target="_blank" rel="noopener noreferrer" className="p-1.5 opacity-0 group-hover:opacity-100 text-t-text-secondary hover:text-t-accent-blue rounded" title={t('admin.staticHtmlPage.open', backendLocale)}>
              <ExternalLink size={15} />
            </a>
            <button onClick={() => copyUrl(node.url)} className="p-1.5 opacity-0 group-hover:opacity-100 text-t-text-secondary hover:text-t-accent-blue rounded" title={t('admin.staticHtmlPage.copyUrl', backendLocale)}>
              <Copy size={15} />
            </button>
            <button onClick={() => startRename('file', node.relPath, node.name)} className="p-1.5 opacity-0 group-hover:opacity-100 text-t-text-secondary hover:text-t-accent-blue rounded" title={t('admin.staticHtmlPage.rename', backendLocale)}>
              <Pencil size={15} />
            </button>
            <button onClick={() => { if (confirm(t('admin.staticHtmlPage.confirmDeleteFile', backendLocale))) deleteFileMutation.mutate(node.relPath) }} className="p-1.5 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10 rounded" title={t('admin.staticHtmlPage.delete', backendLocale)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.staticHtmlPage.title', backendLocale)}</h1>
          <p className="text-t-text-secondary mt-1">{t('admin.staticHtmlPage.desc', backendLocale)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['statichtml-tree'] })} className="p-2 text-t-text-secondary hover:text-t-accent-blue rounded-lg" title={t('common.refresh', backendLocale)}>
            <RefreshCw size={18} />
          </button>
          <button onClick={() => handleUploadClick('')} className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-white rounded-lg hover:opacity-90">
            <Upload size={18} />
            {t('admin.staticHtmlPage.upload', backendLocale)}
          </button>
        </div>
      </div>

      {/* New folder */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Folder size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-t-text-secondary" />
          <input
            type="text"
            value={newFolderPath}
            onChange={e => setNewFolderPath(e.target.value)}
            placeholder={t('admin.staticHtmlPage.folderNamePlaceholder', backendLocale)}
            className="w-full pl-10 pr-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary placeholder-t-text-secondary focus:outline-none focus:border-t-accent-blue"
          />
        </div>
        <button
          onClick={() => { if (newFolderPath.trim()) createFolderMutation.mutate(newFolderPath.trim()) }}
          disabled={!newFolderPath.trim() || createFolderMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary hover:border-t-accent-blue disabled:opacity-50"
        >
          <Plus size={18} />
          {t('admin.staticHtmlPage.newFolder', backendLocale)}
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDrop={e => { e.preventDefault(); handleUploadClick(''); handleFiles(e.dataTransfer.files) }}
        onDragOver={e => e.preventDefault()}
        onClick={() => handleUploadClick('')}
        className="border-2 border-dashed border-t-border rounded-lg p-6 text-center hover:border-t-accent-blue/50 transition-colors cursor-pointer"
      >
        <Upload className="mx-auto mb-2 text-t-text-secondary" size={28} />
        <p className="text-t-text-secondary">{t('admin.staticHtmlPage.dragOrClick', backendLocale)}</p>
        <p className="text-xs text-t-text-secondary mt-1">{t('admin.staticHtmlPage.supportedFormats', backendLocale)}</p>
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />

      {/* Tree */}
      <div className="bg-t-bg-primary border border-t-border rounded-xl p-2">
        {isLoading ? (
          <p className="text-center py-10 text-t-text-secondary">{t('common.loading', backendLocale)}</p>
        ) : tree.length === 0 ? (
          <p className="text-center py-10 text-t-text-secondary">{t('admin.staticHtmlPage.noFiles', backendLocale)}</p>
        ) : (
          tree.map(node => renderNode(node, 0))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-t-bg-primary border border-t-border rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPreviewUrl(null)} />
          <div className="relative z-10 w-full max-w-5xl h-[85vh] bg-t-bg-primary rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-t-border">
              <span className="text-sm truncate">{previewUrl}</span>
              <div className="flex items-center gap-2">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-t-text-secondary hover:text-t-accent-blue rounded" title={t('admin.staticHtmlPage.open', backendLocale)}>
                  <ExternalLink size={18} />
                </a>
                <button onClick={() => setPreviewUrl(null)} className="p-1.5 text-t-text-secondary hover:text-t-text-primary rounded">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe src={previewUrl} className="flex-1 w-full border-0" title="preview" />
          </div>
        </div>
      )}
    </div>
  )
}
