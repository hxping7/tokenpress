'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import {
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Quote, Code, Link2, Image as ImageIcon, Table, Minus,
  Eye, Edit3, Columns, Upload, X, Check, Loader2, Video, Music, FileText, File, Globe
} from 'lucide-react'
import { api } from '@/lib/api'

type ViewMode = 'edit' | 'preview' | 'split'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onImageUpload?: (url: string) => void
}

interface MediaItem {
  id: number
  filename: string
  originalName: string
  mimeType: string
  url: string
  thumbnailUrl: string | null
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '使用 Markdown 编写内容...',
  onImageUpload,
}: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [showVideoEmbed, setShowVideoEmbed] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load media items
  const loadMedia = useCallback(async () => {
    setLoadingMedia(true)
    try {
      const res = await api.getMedia({ limit: 50 })
      setMediaItems(res.data || [])
    } catch (err) {
      console.error('Failed to load media:', err)
    } finally {
      setLoadingMedia(false)
    }
  }, [])

  useEffect(() => {
    if (showMediaPicker) {
      loadMedia()
    }
  }, [showMediaPicker, loadMedia])

  // Insert text at cursor position
  const insertText = useCallback((before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end)

    onChange(newText)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      const newPos = start + before.length + selectedText.length
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }, [value, onChange])

  // Toolbar actions
  const toolbarActions: Array<{ icon?: typeof Bold; label?: string; action?: () => void; divider?: boolean }> = [
    { icon: Bold, label: '粗体', action: () => insertText('**', '**') },
    { icon: Italic, label: '斜体', action: () => insertText('*', '*') },
    { divider: true },
    { icon: Heading1, label: '标题1', action: () => insertText('\n# ', '\n') },
    { icon: Heading2, label: '标题2', action: () => insertText('\n## ', '\n') },
    { icon: Heading3, label: '标题3', action: () => insertText('\n### ', '\n') },
    { divider: true },
    { icon: List, label: '无序列表', action: () => insertText('\n- ', '\n') },
    { icon: ListOrdered, label: '有序列表', action: () => insertText('\n1. ', '\n') },
    { icon: Quote, label: '引用', action: () => insertText('\n> ', '\n') },
    { divider: true },
    { icon: Code, label: '代码块', action: () => insertText('\n```\n', '\n```\n') },
    { icon: Link2, label: '链接', action: () => insertText('[', '](url)') },
    { icon: ImageIcon, label: '图片', action: () => setShowMediaPicker(true) },
    { divider: true },
    { icon: Video, label: '视频', action: () => insertText('\n<video src="视频URL" controls></video>\n', '') },
    { icon: Music, label: '音频', action: () => insertText('\n<audio src="音频URL" controls></audio>\n', '') },
    { icon: Globe, label: '视频外链', action: () => setShowVideoEmbed(true) },
    { divider: true },
    { icon: Table, label: '表格', action: () => insertText('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| ', ' |\n') },
    { icon: Minus, label: '分隔线', action: () => insertText('\n---\n', '') },
  ]

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    const isAudio = file.type.startsWith('audio/')
    const isDocument = !isImage && !isVideo && !isAudio

    if (!isImage && !isVideo && !isAudio && !isDocument) {
      alert('不支持的文件类型')
      return
    }

    setUploading(true)
    try {
      const res = await api.uploadMedia(file)
      const url = res.data.url
      let markdown = ''

      if (isImage) {
        markdown = `![${file.name}](${url})`
      } else if (isVideo) {
        markdown = `<video src="${url}" controls></video>`
      } else if (isAudio) {
        markdown = `<audio src="${url}" controls></audio>`
      } else if (isDocument) {
        // 文档直接插入下载链接
        markdown = `[${file.name}](${url})`
      }

      insertText(markdown)
      onImageUpload?.(url)
    } catch (err) {
      console.error('Upload failed:', err)
      alert('上传失败')
    } finally {
      setUploading(false)
    }
  }, [insertText, onImageUpload])

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => handleFileUpload(file))
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  // 处理视频外链嵌入
  const handleVideoEmbed = useCallback(() => {
    if (!videoUrl.trim()) return

    let embedCode = ''

    // Bilibili
    if (videoUrl.includes('bilibili.com/video/')) {
      const bvidMatch = videoUrl.match(/BV[\w]+/)
      if (bvidMatch) {
        embedCode = `<iframe src="//player.bilibili.com/player.html?bvid=${bvidMatch[0]}&page=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" style="width:100%;height:500px;"></iframe>`
      }
    }
    // YouTube
    else if (videoUrl.includes('youtube.com/watch') || videoUrl.includes('youtu.be/')) {
      const ytMatch = videoUrl.match(/(?:v=|youtu\.be\/)([\w-]+)/)
      if (ytMatch) {
        embedCode = `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
      }
    }
    // Vimeo
    else if (videoUrl.includes('vimeo.com/')) {
      const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/)
      if (vimeoMatch) {
        embedCode = `<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" width="100%" height="400" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
      }
    }
    // 直接MP4等视频链接
    else if (videoUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      embedCode = `<video src="${videoUrl}" controls style="width:100%;max-height:500px;"></video>`
    }
    else {
      embedCode = `<video src="${videoUrl}" controls style="width:100%;max-height:500px;"></video>`
    }

    insertText(`\n${embedCode}\n`)
    setVideoUrl('')
    setShowVideoEmbed(false)
  }, [videoUrl, insertText])

  // Handle paste
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const handlePaste = async (e: ClipboardEvent) => {
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        e.preventDefault()
        for (const file of Array.from(files)) {
          await handleFileUpload(file)
        }
      }
    }

    textarea.addEventListener('paste', handlePaste)
    return () => textarea.removeEventListener('paste', handlePaste)
  }, [handleFileUpload])

  // Select media from library
  const selectMedia = (media: MediaItem) => {
    const isImage = media.mimeType?.startsWith('image/')
    const isVideo = media.mimeType?.startsWith('video/')
    const isAudio = media.mimeType?.startsWith('audio/')
    const isDocument = !isImage && !isVideo && !isAudio
    let markdown = ''

    if (isImage) {
      markdown = `![${media.originalName}](${media.url})`
    } else if (isVideo) {
      markdown = `<video src="${media.url}" controls></video>`
    } else if (isAudio) {
      markdown = `<audio src="${media.url}" controls></audio>`
    } else if (isDocument) {
      markdown = `[${media.originalName}](${media.url})`
    }

    insertText(markdown)
    setShowMediaPicker(false)
  }

  return (
    <div className="h-full flex flex-col border border-t-border rounded-xl overflow-hidden bg-t-bg-secondary">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-t-border bg-t-bg-tertiary">
        <div className="flex items-center gap-1 flex-wrap">
          {toolbarActions.map((item, idx) =>
            item.divider ? (
              <div key={idx} className="w-px h-5 bg-t-border mx-1" />
            ) : item.icon ? (
              <button
                key={idx}
                onClick={item.action}
                title={item.label}
                className="p-1.5 text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover rounded transition-colors"
              >
                <item.icon size={16} />
              </button>
            ) : null
          )}
          <div className="w-px h-5 bg-t-border mx-1" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="上传文件"
            className="p-1.5 text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover rounded transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.log"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
              e.target.value = ''
            }}
          />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-t-bg-primary rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('edit')}
            title="编辑"
            className={`p-1.5 rounded transition-colors ${viewMode === 'edit' ? 'bg-t-accent-blue/20 text-t-accent-blue' : 'text-t-text-secondary hover:text-t-text-primary'}`}
          >
            <Edit3 size={16} />
          </button>
          <button
            onClick={() => setViewMode('split')}
            title="分屏"
            className={`p-1.5 rounded transition-colors ${viewMode === 'split' ? 'bg-t-accent-blue/20 text-t-accent-blue' : 'text-t-text-secondary hover:text-t-text-primary'}`}
          >
            <Columns size={16} />
          </button>
          <button
            onClick={() => setViewMode('preview')}
            title="预览"
            className={`p-1.5 rounded transition-colors ${viewMode === 'preview' ? 'bg-t-accent-blue/20 text-t-accent-blue' : 'text-t-text-secondary hover:text-t-text-primary'}`}
          >
            <Eye size={16} />
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex min-h-0">
        {/* Textarea */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div
            className={`relative ${viewMode === 'split' ? 'w-1/2 border-r border-t-border' : 'w-full'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full h-full p-4 bg-transparent text-t-text-primary font-mono text-sm leading-relaxed resize-none focus:outline-none placeholder-t-text-muted"
              spellCheck={false}
            />
            {dragOver && (
              <div className="absolute inset-0 bg-t-accent-blue/10 border-2 border-dashed border-t-accent-blue rounded-lg flex items-center justify-center">
                <p className="text-t-accent-blue font-medium">拖放图片或视频到这里</p>
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            ref={previewRef}
            className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-y-auto p-4`}
          >
            {value ? (
              <div className="prose prose-invert prose-lg max-w-none
                prose-headings:text-t-text-primary prose-headings:font-semibold
                prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4
                prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3
                prose-h3:text-xl prose-h3:mt-5 prose-h3:mb-2
                prose-p:text-t-text-secondary prose-p:leading-relaxed
                prose-a:text-t-accent-blue prose-a:no-underline hover:prose-a:underline
                prose-strong:text-t-text-primary
                prose-code:text-t-accent-blue prose-code:bg-t-bg-tertiary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                prose-pre:bg-t-bg-primary prose-pre:border prose-pre:border-t-border prose-pre:rounded-xl prose-pre:p-5
                prose-pre:code:bg-transparent prose-pre:code:px-0 prose-pre:code:py-0 prose-pre:code:text-sm
                prose-blockquote:border-l-2 prose-blockquote:border-t-accent-blue prose-blockquote:text-t-text-secondary prose-blockquote:italic
                prose-img:rounded-xl prose-img:border prose-img:border-t-border
                prose-hr:border-t-border
                prose-li:text-t-text-secondary
                prose-table:border-collapse
                prose-th:text-t-text-primary prose-th:border prose-th:border-t-border prose-th:bg-t-bg-tertiary prose-th:px-4 prose-th:py-2
                prose-td:border prose-td:border-t-border prose-td:px-4 prose-td:py-2
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {value}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-t-text-muted">
                预览区域
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMediaPicker(false)} />
          <div className="relative w-full max-w-4xl max-h-[80vh] bg-t-bg-primary border border-t-border rounded-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">选择媒体</h2>
              <button onClick={() => setShowMediaPicker(false)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Media Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingMedia ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-t-accent-blue" />
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="text-center py-12 text-t-text-secondary">
                  <ImageIcon size={48} className="mx-auto mb-3 opacity-30" />
                  <p>媒体库为空</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 px-4 py-2 bg-t-accent-blue text-black rounded-lg font-medium hover:bg-t-accent-blue/90"
                  >
                    上传图片
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                  {mediaItems.map((media) => {
                    const isImage = media.mimeType?.startsWith('image/')
                    const isVideo = media.mimeType?.startsWith('video/')
                    const isAudio = media.mimeType?.startsWith('audio/')
                    const isDocument = !isImage && !isVideo && !isAudio
                    return (
                      <button
                        key={media.id}
                        onClick={() => selectMedia(media)}
                        className="aspect-square bg-t-bg-secondary rounded-lg overflow-hidden hover:ring-2 hover:ring-t-accent-blue transition-all group relative"
                      >
                        {isImage ? (
                          <Image
                            src={media.thumbnailUrl || media.url}
                            alt={media.originalName}
                            fill
                            className="object-cover"
                            unoptimized
                            sizes="(max-width: 768px) 50vw, 200px"
                          />
                        ) : isVideo ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video size={24} className="text-t-text-secondary" />
                          </div>
                        ) : isAudio ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music size={24} className="text-t-text-secondary" />
                          </div>
                        ) : isDocument ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText size={24} className="text-t-text-secondary" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <File size={24} className="text-t-text-secondary" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Check size={20} className="text-t-accent-blue" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Embed Modal */}
      {showVideoEmbed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowVideoEmbed(false)} />
          <div className="relative w-full max-w-lg bg-t-bg-primary border border-t-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">插入视频外链</h2>
              <button onClick={() => setShowVideoEmbed(false)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">视频链接</label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="支持 B站、YouTube、Vimeo 或直接视频URL"
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                  onKeyDown={(e) => e.key === 'Enter' && handleVideoEmbed()}
                />
              </div>
              <div className="text-sm text-t-text-secondary">
                <p>支持的平台：</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>B站: https://www.bilibili.com/video/BVxxx</li>
                  <li>YouTube: https://youtube.com/watch?v=xxx 或 youtu.be/xxx</li>
                  <li>Vimeo: https://vimeo.com/xxx</li>
                  <li>直接视频链接: .mp4, .webm, .ogg</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-t-border">
              <button
                onClick={() => setShowVideoEmbed(false)}
                className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary"
              >
                取消
              </button>
              <button
                onClick={handleVideoEmbed}
                className="px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90"
              >
                插入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
