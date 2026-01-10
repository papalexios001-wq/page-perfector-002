'use client';

import React from 'react';
import { AlertCircle, CheckCircle, Quote, Target, Video, TrendingUp, BookOpen, FileText, Grid3x3 } from 'lucide-react';

/**
 * ENTERPRISE-GRADE Blog Post Component Library
 * Renders optimized blog posts with beautiful styled HTML boxes
 * SOTA Quality with perfect styling integration
 */

// ============================================================================
// TL;DR BOX - Quick Summary
// ============================================================================
export function TLDRBox({ content }: { content: string }) {
  return (
    <div className="my-6 p-5 bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-500 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-blue-900 mb-2">TL;DR - Quick Summary</h3>
          <p className="text-sm text-blue-800 leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KEY TAKEAWAYS BOX - Bullet Points
// ============================================================================
export function KeyTakeawaysBox({ items }: { items: string[] }) {
  return (
    <div className="my-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-green-900 mb-3">Key Takeaways</h3>
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-green-800">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-600 mt-1.5 flex-shrink-0"></span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// QUOTE BOX - Highlighted Testimonial
// ============================================================================
export function QuoteBox({ text, author, source }: { text: string; author?: string; source?: string }) {
  return (
    <div className="my-6 p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        <Quote className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <p className="text-lg italic font-medium text-purple-900 mb-3 leading-relaxed">\"<span>{text}</span>\"</p>
          {author && (
            <p className="text-sm text-purple-800 font-semibold">
              — {author}
              {source && <span className="text-purple-700 font-normal"> ({source})</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CTA BOX - Call-to-Action
// ============================================================================
export function CTABox({ title, description, buttonText, buttonLink }: { title: string; description: string; buttonText: string; buttonLink: string }) {
  return (
    <div className="my-6 p-6 bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        <Target className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-orange-900 mb-2">{title}</h3>
          <p className="text-sm text-orange-800 mb-4">{description}</p>
          <a
            href={buttonLink}
            className="inline-block px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            {buttonText}
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VIDEO EMBED BOX
// ============================================================================
export function VideoEmbedBox({ videoId, title }: { videoId: string; title?: string }) {
  return (
    <div className="my-6 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
      {title && <h3 className="px-6 pt-4 font-bold text-gray-900">{title}</h3>}
      <div className="relative pb-[56.25%] h-0 overflow-hidden bg-gray-900">
        <iframe
          className="absolute top-0 left-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title || 'Video'}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

// ============================================================================
// SUMMARY/CONCLUSION BOX
// ============================================================================
export function SummaryBox({ content }: { content: string }) {
  return (
    <div className="my-6 p-5 bg-gradient-to-r from-indigo-50 to-blue-50 border-l-4 border-indigo-500 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-3">
        <BookOpen className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-indigo-900 mb-2">Summary & Conclusion</h3>
          <p className="text-sm text-indigo-800 leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PATENT SEARCH BOX - Research Findings
// ============================================================================
export function PatentSearchBox({ patents }: { patents: Array<{ title: string; number: string; url?: string }> }) {
  return (
    <div className="my-6 p-5 bg-gradient-to-r from-cyan-50 to-blue-50 border-l-4 border-cyan-500 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-cyan-900 mb-3">Related Patents & Research</h3>
          <div className="space-y-2">
            {patents.map((patent, idx) => (
              <div key={idx} className="text-sm">
                {patent.url ? (
                  <a href={patent.url} target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-900 font-medium underline">
                    {patent.title} ({patent.number})
                  </a>
                ) : (
                  <p className="text-cyan-800">
                    {patent.title} <span className="text-cyan-600">({patent.number})</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CHART BOX - Data Visualization Placeholder
// ============================================================================
export function ChartBox({ title, description }: { title: string; description: string }) {
  return (
    <div className="my-6 p-6 bg-gradient-to-r from-teal-50 to-green-50 border-l-4 border-teal-500 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-teal-900 mb-2">{title}</h3>
          <div className="bg-white rounded p-8 text-center text-teal-700 font-medium">
            <p>{description}</p>
            <p className="text-xs text-teal-600 mt-2">[Chart visualization would render here]</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TABLE BOX - Structured Data
// ============================================================================
export function TableBox({ headers, rows, title }: { headers: string[]; rows: string[][]; title?: string }) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg shadow-md hover:shadow-lg transition-shadow">
      {title && <h3 className="px-6 pt-4 font-bold text-gray-900">{title}</h3>}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gradient-to-r from-slate-100 to-slate-200 border-b-2 border-slate-300">
            {headers.map((header, idx) => (
              <th key={idx} className="px-4 py-3 text-left font-bold text-slate-900 text-sm">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} >
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-3 text-sm text-gray-700 border-b border-slate-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// COMPLETE BLOG POST RENDERER
// ============================================================================
export interface BlogPostContent {
  title: string;
  author: string;
  publishedAt: string;
  excerpt?: string;
  sections: BlogSection[];
}

export interface BlogSection {
  type: 'heading' | 'paragraph' | 'tldr' | 'takeaways' | 'quote' | 'cta' | 'video' | 'summary' | 'patent' | 'chart' | 'table';
  content?: string;
  data?: any;
}

export function BlogPostRenderer({ post }: { post: BlogPostContent }) {
  return (
    <article className="max-w-4xl mx-auto py-12 px-4">
      {/* Header */}
      <header className="mb-8 pb-8 border-b-2 border-gray-200">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
        <div className="flex items-center justify-between text-gray-600">
          <div>
            <p className="font-semibold text-gray-900">{post.author}</p>
            <p className="text-sm">{new Date(post.publishedAt).toLocaleDateString()}</p>
          </div>
        </div>
        {post.excerpt && <p className="mt-4 text-lg text-gray-700 italic">{post.excerpt}</p>}
      </header>

      {/* Content Sections */}
      <main className="prose prose-lg max-w-none">
        {post.sections.map((section, idx) => {
          switch (section.type) {
            case 'heading':
              return <h2 key={idx} className="text-3xl font-bold text-gray-900 mt-8 mb-4">{section.content}</h2>;
            case 'paragraph':
              return <p key={idx} className="text-gray-800 leading-relaxed mb-4">{section.content}</p>;
            case 'tldr':
              return <TLDRBox key={idx} content={section.content || ''} />;
            case 'takeaways':
              return <KeyTakeawaysBox key={idx} items={section.data || []} />;
            case 'quote':
              return <QuoteBox key={idx} {...section.data} />;
            case 'cta':
              return <CTABox key={idx} {...section.data} />;
            case 'video':
              return <VideoEmbedBox key={idx} {...section.data} />;
            case 'summary':
              return <SummaryBox key={idx} content={section.content || ''} />;
            case 'patent':
              return <PatentSearchBox key={idx} patents={section.data || []} />;
            case 'chart':
              return <ChartBox key={idx} {...section.data} />;
            case 'table':
              return <TableBox key={idx} {...section.data} />;
            default:
              return null;
          }
        })}
      </main>
    </article>
  );
}

export default BlogPostRenderer;
