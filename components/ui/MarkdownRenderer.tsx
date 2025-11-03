'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { visit } from 'unist-util-visit';
import Image from 'next/image';
import { BlogVideoPlayer } from './BlogVideoPlayer';
import { VideoEmbed } from './VideoEmbed';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Helper function to detect video files
const isVideoFile = (src: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
  const url = src.toLowerCase();
  return videoExtensions.some(ext => url.includes(ext));
};

// Helper function to detect video platform URLs
const isVideoEmbed = (src: string): boolean => {
  const platforms = ['youtube.com', 'youtu.be', 'bilibili.com', 'vimeo.com'];
  return platforms.some(platform => src.includes(platform));
};

// Rehype plugin to unwrap video images from paragraphs
function rehypeUnwrapVideos() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree, 'element', (node: any, index: number | undefined, parent: any) => {
      if (index !== undefined && node.tagName === 'p' && node.children && node.children.length === 1) {
        const child = node.children[0];
        if (child.tagName === 'img') {
          const src = child.properties?.src;
          if (src && (isVideoFile(src) || isVideoEmbed(src))) {
            // Replace paragraph with the image directly
            parent.children[index] = child;
          }
        }
      }
    });
  };
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-rendered prose prose-gray max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeHighlight,
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap', properties: { className: ['heading-link'] } }],
          rehypeUnwrapVideos
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
          p: ({ children }) => {
            // Convert children to array for analysis
            const childrenArray = React.Children.toArray(children);
            
            // Check if this paragraph contains only one child that will render as a block element
            if (childrenArray.length === 1) {
              const child = childrenArray[0];
              if (React.isValidElement(child)) {
                // Check if it's an image that our img component will transform to video
                if (child.type === 'img' && (child.props as { src?: string }).src) {
                  const src = (child.props as { src: string }).src;
                  if (isVideoFile(src) || isVideoEmbed(src)) {
                    // Render the img component directly without paragraph wrapper
                    return child;
                  }
                }
                // Check if it's already a video component
                if (child.type === BlogVideoPlayer || child.type === VideoEmbed) {
                  return child;
                }
              }
            }

            // Normal paragraph for all other cases
            return (
              <p className="text-gray-700 leading-relaxed mb-4">
                {children}
              </p>
            );
          },
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-6 space-y-3 mb-6 text-gray-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-6 space-y-3 mb-6 text-gray-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-2">
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
          a: ({ children, href, className }) => {
            const cls = typeof className === 'string' ? className : '';
            const isHeadingLink = cls.includes('heading-link');
            const base = 'text-gray-900 hover:text-gray-700 transition-colors';
            const tail = isHeadingLink ? 'no-underline hover:no-underline' : 'underline';
            const linkClass = `${cls ? cls + ' ' : ''}${base} ${tail}`;
            return (
              <a
                href={href}
                className={linkClass}
                target={href?.startsWith('http') ? '_blank' : '_self'}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {children}
              </a>
            );
          },
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
          img: ({ src, alt }) => {
            if (!src || typeof src !== 'string') return null;
            
            // Check if it's a video file
            if (isVideoFile(src)) {
              return (
                <BlogVideoPlayer
                  src={src}
                  alt={alt}
                  className="my-4"
                />
              );
            }
            
            // Check if it's a video platform URL
            if (isVideoEmbed(src)) {
              return (
                <VideoEmbed
                  url={src}
                  className="my-4"
                />
              );
            }
            
            // Regular image
            return (
              <Image
                src={src}
                alt={alt || 'Image'}
                width={800}
                height={600}
                className="rounded-lg my-4 max-w-full h-auto"
                style={{ width: 'auto', height: 'auto' }}
              />
            );
          },
          // Handle HTML video tags directly
          video: ({ src, controls, autoPlay, loop, muted, poster }) => {
            const videoSrc = typeof src === 'string' ? src : '';
            const videoPoster = typeof poster === 'string' ? poster : undefined;
            
            return (
              <BlogVideoPlayer
                src={videoSrc}
                controls={controls !== false}
                autoplay={autoPlay === true}
                loop={loop === true}
                muted={muted === true}
                poster={videoPoster}
                className="my-4"
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
