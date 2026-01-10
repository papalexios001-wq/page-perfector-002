// ============================================================================
// COMPLETE BLOG POST RENDERER - WITH DEFENSIVE RENDERING
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
              text={quoteData.text || ''}
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
      return null;
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
            <p className="font-semibold text-gray-900">{post.author || 'Author'}</p>
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
