import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownProseProps {
  children: string
}

/**
 * The markdown pipeline is the heaviest dependency in the app and is only
 * needed once prose renders, so it lives in its own chunk. `MdxBody` pulls it
 * in on first use.
 */
export default function MarkdownProse({ children }: MarkdownProseProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
