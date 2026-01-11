// ============================================================================
// COMPLETE BLOG POST RENDERER - ENTERPRISE-GRADE WITH ALL STYLED COMPONENTS
// ============================================================================
import React from 'react';
import { Lightbulb, Quote, ArrowRight, Play, BookOpen, FileSearch, BarChart3, Table } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
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

// ============================================================================
// STYLED SECTION COMPONENTS - ENTERPRISE-GRADE
// ============================================================================

/**
 * TL;DR Box - Executive Summary Component
 */
function TLDRBox({ content }: { content: string }) {
  return (
    <div className="my-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 rounded-r-xl shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-blue-900 text-lg mb-2">TL;DR</h3>
          <p className="text-blue-800 leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Key Takeaways Box - Bulleted List Component
 */
function KeyTakeawaysBox({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  
  return (
    <div className="my-8 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl shadow-sm">
      <h3 className="font-bold text-emerald-900 text-lg mb-4 flex items-center gap-2">
        <span className="text-2xl">🎯</span> Key Takeaways
      </h3>
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {idx + 1}
            </span>
            <span className="text-emerald-800">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Quote Box - Expert Quote Component
 */
function QuoteBox({ text, author, source }: { text: string; author?: string; source?: string }) {
  return (
    <blockquote className="my-8 relative">
      <div className="absolute -left-4 -top-4 text-6xl text-purple-200 font-serif">"</div>
      <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 rounded-r-xl shadow-sm">
        <div className="flex items-start gap-3">
          <Quote className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <p className="text-lg text-purple-900 italic leading-relaxed mb-3">"{text}"</p>
            {(author || source) && (
              <footer className="text-sm text-purple-700">
                {author && <span className="font-semibold">— {author}</span>}
                {source && <span className="text-purple-600">, {source}</span>}
              </footer>
            )}
          </div>
        </div>
      </div>
    </blockquote>
  );
}

/**
 * CTA Box - Call to Action Component
 */
function CTABox({ title, description, buttonText, buttonLink }: { 
  title: string; 
  description: string; 
  buttonText: string; 
  buttonLink: string; 
}) {
  return (
    <div className="my-8 p-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg text-white">
      <h3 className="font-bold text-xl mb-2">{title}</h3>
      <p className="text-orange-100 mb-4">{description}</p>
      <a
        href={buttonLink}
        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
      >
        {buttonText}
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}

/**
 * Video Embed Box - YouTube Embed Component
 */
function VideoEmbedBox({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="my-8">
      <div className="flex items-center gap-2 mb-3">
        <Play className="w-5 h-5 text-red-600" />
        <span className="font-semibold text-gray-900">{title}</span>
      </div>
      <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
}

/**
 * Summary Box - Article Summary Component
 */
function SummaryBox({ content }: { content: string }) {
  return (
    <div className="my-8 p-6 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl shadow-sm">
      <div className="flex items-start gap-4">
        <BookOpen className="w-6 h-6 text-gray-600 flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-bold text-gray-900 text-lg mb-2">Summary</h3>
          <p className="text-gray-700 leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Patent Search Box - Patent Information Component
 */
function PatentSearchBox({ patents }: { patents: { title: string; number: string; date: string }[] }) {
  if (!patents || patents.length === 0) return null;
  
  return (
    <div className="my-8 p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <FileSearch className="w-6 h-6 text-amber-700" />
        <h3 className="font-bold text-amber-900 text-lg">Related Patents</h3>
      </div>
      <div className="space-y-3">
        {patents.map((patent, idx) => (
          <div key={idx} className="p-3 bg-white rounded-lg border border-amber-100">
            <p className="font-semibold text-amber-900">{patent.title}</p>
            <p className="text-sm text-amber-700">
              Patent #{patent.number} • Filed {patent.date}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Chart Box - Data Visualization Placeholder
 */
function ChartBox({ title, description }: { title: string; description: string }) {
  return (
    <div className="my-8 p-6 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl shadow-sm">
      <div className="flex items-start gap-4">
        <BarChart3 className="w-6 h-6 text-cyan-700 flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-bold text-cyan-900 text-lg mb-2">{title}</h3>
          <p className="text-cyan-700">{description}</p>
          <div className="mt-4 h-48 bg-cyan-100 rounded-lg flex items-center justify-center">
            <span className="text-cyan-600">Chart visualization area</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Table Box - Data Table Component
 */
function TableBox({ headers, rows, title }: { headers: string[]; rows: string[][]; title?: string }) {
  if (!headers || headers.length === 0 || !rows || rows.length === 0) return null;
  
  return (
    <div className="my-8">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <Table className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              {headers.map((header, idx) => (
                <th key={idx} className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-gray-200">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-4 py-3 text-gray-700 border-b border-gray-100">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN BLOG POST RENDERER
// ============================================================================
export function BlogPostRenderer({ post }: { post: BlogPostContent }) {
  // Defensive check
  if (!post) {
    console.error('[BlogPostRenderer] No post provided');
    return (
      <div className="p-8 text-center text-gray-500">
        No blog post data available.
      </div>
    );
  }

  console.log('[BlogPostRenderer] Rendering post:', post.title, 'with', post.sections?.length || 0, 'sections');

  const renderSection = (section: BlogSection, idx: number) => {
    if (!section || !section.type) {
      console.warn(`[BlogPostRenderer] Invalid section at index ${idx}`);
      return null;
    }

    try {
      switch (section.type) {
        case 'heading':
          return (
            <h2 key={idx} className="text-3xl font-bold text-gray-900 mt-8 mb-4">
              {section.content || 'Section'}
            </h2>
          );
        
        case 'paragraph':
          return (
            <p key={idx} className="text-gray-800 leading-relaxed mb-4">
              {section.content || ''}
            </p>
          );
        
        case 'tldr':
          return <TLDRBox key={idx} content={section.content || ''} />;
        
        case 'takeaways':
          const items = Array.isArray(section.data) ? section.data : [];
          return <KeyTakeawaysBox key={idx} items={items} />;
        
        case 'quote':
          const quoteData = section.data || {};
          return (
            <QuoteBox
              key={idx}
              text={quoteData.text || section.content || ''}
              author={quoteData.author}
              source={quoteData.source}
            />
          );
        
        case 'cta':
          const ctaData = section.data || {};
          return (
            <CTABox
              key={idx}
              title={ctaData.title || 'Take Action'}
              description={ctaData.description || ''}
              buttonText={ctaData.buttonText || 'Get Started'}
              buttonLink={ctaData.buttonLink || '#'}
            />
          );
        
        case 'video':
          const videoData = section.data || {};
          if (!videoData.videoId) {
            console.warn(`[BlogPostRenderer] Video section missing videoId at index ${idx}`);
            return null;
          }
          return (
            <VideoEmbedBox
              key={idx}
              videoId={videoData.videoId}
              title={videoData.title || 'Video'}
            />
          );
        
        case 'summary':
          return <SummaryBox key={idx} content={section.content || ''} />;
        
        case 'patent':
          const patents = Array.isArray(section.data) ? section.data : [];
          if (patents.length === 0) return null;
          return <PatentSearchBox key={idx} patents={patents} />;
        
        case 'chart':
          const chartData = section.data || {};
          return (
            <ChartBox
              key={idx}
              title={chartData.title || 'Chart'}
              description={chartData.description || ''}
            />
          );
        
        case 'table':
          const tableData = section.data || {};
          const headers = Array.isArray(tableData.headers) ? tableData.headers : [];
          const rows = Array.isArray(tableData.rows) ? tableData.rows : [];
          if (headers.length === 0 || rows.length === 0) return null;
          return (
            <TableBox
              key={idx}
              headers={headers}
              rows={rows}
              title={tableData.title}
            />
          );
        
        default:
          console.warn(`[BlogPostRenderer] Unknown section type: ${section.type}`);
          return section.content ? (
            <p key={idx} className="text-gray-800 leading-relaxed mb-4">
              {section.content}
            </p>
          ) : null;
      }
    } catch (err) {
      console.error(`[BlogPostRenderer] Error rendering section ${idx}:`, err);
      return (
        <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Error rendering section: {(err as Error).message}
        </div>
      );
    }
  };

  return (
    <article className="max-w-4xl mx-auto py-12 px-4">
      {/* Header */}
      <header className="mb-8 pb-8 border-b-2 border-gray-200">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {post.title || 'Untitled Post'}
        </h1>
        <div className="flex items-center justify-between text-gray-600">
          <div>
            <p className="font-semibold text-gray-900">{post.author || 'Content Expert'}</p>
            <p className="text-sm">
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Today'}
            </p>
          </div>
        </div>
        {post.excerpt && (
          <p className="mt-4 text-lg text-gray-700 italic">{post.excerpt}</p>
        )}
      </header>

      {/* Content Sections */}
      <main className="prose prose-lg max-w-none">
        {Array.isArray(post.sections) && post.sections.length > 0 ? (
          post.sections.map((section, idx) => renderSection(section, idx))
        ) : (
          <p className="text-gray-600">No content sections available.</p>
        )}
      </main>
    </article>
  );
}

export default BlogPostRenderer;
