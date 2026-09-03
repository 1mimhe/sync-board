import React from 'react'

export interface MarkdownViewerProps {
  content: string
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  if (!content.trim()) {
    return (
      <div style={{ color: 'var(--muted)', fontStyle: 'italic', padding: 24 }}>
        Document is empty. Switch to Edit mode to write content.
      </div>
    )
  }

  // Parse lines into structured blocks
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  let inCodeBlock = false
  let codeBuffer: string[] = []
  let codeLang = ''

  lines.forEach((line, idx) => {
    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div
            key={`code-${idx}`}
            style={{
              position: 'relative',
              background: '#0d1117',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '12px 16px',
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: 13,
              overflowX: 'auto',
              margin: '12px 0',
            }}
          >
            {codeLang && (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 10,
                  fontSize: 10,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                }}
              >
                {codeLang}
              </div>
            )}
            <pre style={{ margin: 0, color: '#e6edf3', lineHeight: 1.5 }}>
              {codeBuffer.join('\n')}
            </pre>
          </div>,
        )
        codeBuffer = []
        inCodeBlock = false
        codeLang = ''
      } else {
        inCodeBlock = true
        codeLang = line.trim().replace(/^```/, '')
      }
      return
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      return
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${idx}`}
          style={{
            fontSize: 26,
            fontWeight: 900,
            margin: '20px 0 10px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: 8,
            color: 'var(--text)',
          }}
        >
          {formatInline(line.slice(2))}
        </h1>,
      )
      return
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${idx}`}
          style={{
            fontSize: 20,
            fontWeight: 800,
            margin: '18px 0 8px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            paddingBottom: 6,
            color: 'var(--text)',
          }}
        >
          {formatInline(line.slice(3))}
        </h2>,
      )
      return
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3
          key={`h3-${idx}`}
          style={{
            fontSize: 16,
            fontWeight: 700,
            margin: '14px 0 6px',
            color: 'var(--violet2)',
          }}
        >
          {formatInline(line.slice(4))}
        </h3>,
      )
      return
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(
        <hr
          key={`hr-${idx}`}
          style={{
            border: 'none',
            borderTop: '1px solid var(--border)',
            margin: '20px 0',
          }}
        />,
      )
      return
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`bq-${idx}`}
          style={{
            borderLeft: '4px solid var(--violet)',
            padding: '6px 14px',
            margin: '8px 0',
            background: 'rgba(124, 58, 237, 0.06)',
            borderRadius: '0 8px 8px 0',
            color: 'var(--muted)',
            fontStyle: 'italic',
          }}
        >
          {formatInline(line.slice(2))}
        </blockquote>,
      )
      return
    }

    // Task list / Checkbox
    if (line.startsWith('- [ ] ') || line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      const isChecked = line.startsWith('- [x] ') || line.startsWith('- [X] ')
      const taskText = line.slice(6)
      elements.push(
        <div
          key={`task-${idx}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '4px 0',
            fontSize: 14.5,
          }}
        >
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            style={{ accentColor: 'var(--violet)', width: 16, height: 16 }}
          />
          <span style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1 }}>
            {formatInline(taskText)}
          </span>
        </div>,
      )
      return
    }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div
          key={`li-${idx}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            margin: '3px 0 3px 12px',
            fontSize: 14.5,
          }}
        >
          <span style={{ color: 'var(--violet2)', fontWeight: 900 }}>•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>,
      )
      return
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={`sp-${idx}`} style={{ height: 10 }} />)
      return
    }

    // Normal paragraph
    elements.push(
      <p
        key={`p-${idx}`}
        style={{
          margin: '4px 0',
          lineHeight: 1.7,
          fontSize: 14.5,
          color: 'var(--text)',
        }}
      >
        {formatInline(line)}
      </p>,
    )
  })

  return (
    <div
      className="markdown-content"
      style={{
        padding: 24,
        fontSize: 15,
        lineHeight: 1.7,
        color: 'var(--text)',
        minHeight: 520,
      }}
    >
      {elements}
    </div>
  )
}

function formatInline(text: string): React.ReactNode {
  // Bold & Italic inline formatting
  const parts: React.ReactNode[] = []

  // Basic regex parser for bold (**text**), inline code (`code`), links ([text](url))
  const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g
  let match
  let lastIdx = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${match.index}`} style={{ fontWeight: 800, color: 'var(--text)' }}>
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c-${match.index}`}
          style={{
            background: 'rgba(255,255,255,0.08)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 13,
            fontFamily: 'Consolas, monospace',
            color: 'var(--cyan)',
          }}
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const linkText = token.substring(1, token.indexOf(']('))
      const url = token.substring(token.indexOf('](') + 2, token.length - 1)
      parts.push(
        <a
          key={`a-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--violet2)', textDecoration: 'underline' }}
        >
          {linkText}
        </a>,
      )
    }
    lastIdx = regex.lastIndex
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx))
  }

  return parts.length > 0 ? parts : text
}
