'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-rendered prose prose-gray max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeHighlight,
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap' }]
        ]}
        components={{
          // Custom components for Notion-style rendering
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-semibold text-gray-900 mt-6 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-medium text-gray-900 mt-5 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-gray-700 leading-relaxed mb-4">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4 bg-gray-50 py-2">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isInlineCode = !className?.includes('language-');
            return isInlineCode ? (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            ) : (
              <code className={`${className} block bg-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto`}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-gray-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 px-4 py-2 bg-gray-50 font-medium text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-4 py-2">
              {children}
            </td>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-gray-900 underline hover:text-gray-700 transition-colors"
              target={href?.startsWith('http') ? '_blank' : '_self'}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}