'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypePrism from 'rehype-prism-plus'
import { useState, useCallback, useMemo } from 'react'
import { Check, Copy } from 'lucide-react'
import 'prismjs/themes/prism-tomorrow.css'

function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface MarkdownContentProps {
  content: string
}

function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return extractTextFromChildren((children as React.ReactElement).props.children)
  }
  return ''
}

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const plainText = extractTextFromChildren(children).replace(/\n$/, '')

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(plainText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [plainText])

  const lines = plainText.split('\n')
  let filename = ''
  const fileMatch = lines[0]?.match(/^\/\/\s*file:\s*(.+)$/i)
  if (fileMatch) {
    filename = fileMatch[1].trim()
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-t-border bg-t-bg-secondary">
      {/* Header: 语言 + 文件名 + 复制按钮 */}
      <div className="flex items-center justify-between px-4 py-2 bg-t-bg-tertiary border-b border-t-border">
        <div className="flex items-center gap-2 text-xs text-t-text-muted">
          {filename ? (
            <span className="font-medium">{filename}</span>
          ) : language ? (
            <span>{language}</span>
          ) : (
            <span>code</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-t-text-muted rounded-md hover:text-t-text-primary hover:bg-t-hover transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-400" />
              <span className="text-green-400">已复制</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>复制</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="!m-0 !p-4 !bg-transparent !border-0 !rounded-none">
          <code className={className}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  )
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const headingCounter = useMemo(() => ({} as Record<string, number>), [content])

  const makeHeadingId = (text: string): string => {
    const base = generateHeadingId(text)
    if (headingCounter[base] === undefined) {
      headingCounter[base] = 0
      return base
    }
    headingCounter[base] += 1
    return `${base}-${headingCounter[base]}`
  }

  return (
    <div className="prose prose-invert prose-lg max-w-none
      prose-headings:text-t-text-primary prose-headings:font-semibold
      prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4
      prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3
      prose-h3:text-xl prose-h3:mt-5 prose-h3:mb-2
      prose-p:text-t-text-secondary prose-p:leading-relaxed
      prose-a:text-t-accent-blue prose-a:no-underline hover:prose-a:underline
      prose-strong:text-t-text-primary
      prose-code:text-t-accent-blue prose-code:bg-t-bg-tertiary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
      prose-pre:bg-transparent prose-pre:border-0 prose-pre:p-0 prose-pre:rounded-none
      prose-pre:code:bg-transparent prose-pre:code:px-0 prose-pre:code:py-0 prose-pre:code:text-sm
      prose-blockquote:border-l-2 prose-blockquote:border-t-accent-blue prose-blockquote:text-t-text-secondary prose-blockquote:italic
      prose-img:rounded-xl prose-img:border prose-img:border-t-border
      prose-hr:border-t-border
      prose-li:text-t-text-secondary
      prose-table:border-collapse
      prose-th:text-t-text-primary prose-th:border prose-th:border-t-border prose-th:bg-t-bg-tertiary prose-th:px-4 prose-th:py-2
      prose-td:border prose-td:border-t-border prose-td:px-4 prose-td:py-2
      prose-iframe:rounded-xl prose-iframe:border prose-iframe:border-t-border prose-iframe:w-full
      prose-video:rounded-xl prose-video:border prose-video:border-t-border prose-video:w-full
      prose-audio:w-full
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypePrism]}
        components={{
          h2({ children }) {
            const text = String(children).replace(/[*_`]/g, '').trim()
            const id = makeHeadingId(text)
            return <h2 id={id}>{children}</h2>
          },
          h3({ children }) {
            const text = String(children).replace(/[*_`]/g, '').trim()
            const id = makeHeadingId(text)
            return <h3 id={id}>{children}</h3>
          },
          pre({ children }) {
            if (
              children &&
              typeof children === 'object' &&
              'type' in children &&
              children.type === 'code' &&
              'props' in children
            ) {
              const { className, children: codeChildren } = children.props as {
                className?: string
                children?: React.ReactNode
              }
              return <CodeBlock className={className}>{codeChildren}</CodeBlock>
            }
            return <pre>{children}</pre>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
