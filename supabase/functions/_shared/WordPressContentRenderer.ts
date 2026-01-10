// ============================================================================
// WORDPRESS CONTENT RENDERER v2.0 - ENTERPRISE GRADE
// ============================================================================
// Transforms JSON blog sections into beautifully styled HTML with inline CSS
// for maximum WordPress compatibility across all themes.
// ============================================================================

export interface BlogSection {
  type: 'tldr' | 'takeaways' | 'heading' | 'paragraph' | 'quote' | 'cta' | 'summary' | 'faq' | 'toc' | 'list' | 'image';
  content?: string;
  data?: any;
}

export interface BlogPost {
  title: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;
  metaDescription?: string;
  sections: BlogSection[];
  qualityScore?: number;
  wordCount?: number;
}

// ============================================================================
// STYLE CONSTANTS - Inline CSS for WordPress Compatibility
// ============================================================================
const COLORS = {
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  primaryLight: '#818cf8',
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  dark: '#1f2937',
  gray: '#6b7280',
  grayLight: '#f3f4f6',
  white: '#ffffff',
  border: '#e5e7eb',
};

const FONTS = {
  heading: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  body: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
};

// ============================================================================
// COMPONENT RENDERERS
// ============================================================================

function renderTLDR(content: string): string {
  return `
<div style="
  background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%);
  border-radius: 12px;
  padding: 24px 28px;
  margin: 32px 0;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.25);
">
  <div style="
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  ">
    <span style="
      background: rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 18px;
    ">⚡</span>
    <span style="
      color: ${COLORS.white};
      font-family: ${FONTS.heading};
      font-weight: 700;
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 1px;
    ">TL;DR</span>
  </div>
  <p style="
    color: ${COLORS.white};
    font-family: ${FONTS.body};
    font-size: 17px;
    line-height: 1.7;
    margin: 0;
    font-weight: 500;
  ">${escapeHtml(content)}</p>
</div>`;
}

function renderTakeaways(items: string[]): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  
  const takeawayItems = items.map((item, index) => `
    <li style="
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 0;
      border-bottom: ${index < items.length - 1 ? `1px solid ${COLORS.border}` : 'none'};
    ">
      <span style="
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, ${COLORS.success} 0%, #059669 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
      ">✓</span>
      <span style="
        color: ${COLORS.dark};
        font-family: ${FONTS.body};
        font-size: 16px;
        line-height: 1.6;
        flex: 1;
      ">${escapeHtml(item)}</span>
    </li>`).join('');

  return `
<div style="
  background: linear-gradient(to bottom, ${COLORS.successLight}, ${COLORS.white});
  border: 2px solid ${COLORS.success};
  border-radius: 16px;
  padding: 28px;
  margin: 32px 0;
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.15);
">
  <div style="
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 2px solid ${COLORS.success};
  ">
    <span style="font-size: 24px;">🎯</span>
    <h3 style="
      color: ${COLORS.dark};
      font-family: ${FONTS.heading};
      font-weight: 700;
      font-size: 20px;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    ">Key Takeaways</h3>
  </div>
  <ul style="
    list-style: none;
    margin: 0;
    padding: 0;
  ">${takeawayItems}
  </ul>
</div>`;
}

function renderHeading(content: string, level: number = 2): string {
  const sizes: Record<number, string> = {
    1: '36px',
    2: '28px',
    3: '22px',
    4: '18px',
  };
  const tag = `h${Math.min(Math.max(level, 1), 4)}`;
  
  return `
<${tag} style="
  color: ${COLORS.dark};
  font-family: ${FONTS.heading};
  font-weight: 700;
  font-size: ${sizes[level] || sizes[2]};
  line-height: 1.3;
  margin: 40px 0 20px 0;
  padding-bottom: 12px;
  border-bottom: 3px solid ${COLORS.primary};
">${escapeHtml(content)}</${tag}>`;
}

function renderParagraph(content: string): string {
  return `
<p style="
  color: ${COLORS.dark};
  font-family: ${FONTS.body};
  font-size: 17px;
  line-height: 1.8;
  margin: 0 0 20px 0;
">${escapeHtml(content)}</p>`;
}

function renderQuote(data: { text: string; author?: string; source?: string }): string {
  if (!data || !data.text) return '';
  
  return `
<blockquote style="
  background: linear-gradient(135deg, ${COLORS.grayLight} 0%, ${COLORS.white} 100%);
  border-left: 5px solid ${COLORS.primary};
  border-radius: 0 16px 16px 0;
  padding: 28px 32px;
  margin: 32px 0;
  position: relative;
  box-shadow: 0 4px 15px rgba(0,0,0,0.08);
">
  <span style="
    position: absolute;
    top: -10px;
    left: 20px;
    font-size: 60px;
    color: ${COLORS.primary};
    opacity: 0.3;
    font-family: Georgia, serif;
    line-height: 1;
  ">"</span>
  <p style="
    color: ${COLORS.dark};
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 20px;
    font-style: italic;
    line-height: 1.7;
    margin: 0 0 16px 0;
    position: relative;
    z-index: 1;
  ">${escapeHtml(data.text)}</p>
  ${data.author ? `
  <footer style="
    display: flex;
    align-items: center;
    gap: 12px;
  ">
    <div style="
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 16px;
    ">${data.author.charAt(0).toUpperCase()}</div>
    <div>
      <cite style="
        color: ${COLORS.dark};
        font-family: ${FONTS.body};
        font-weight: 600;
        font-style: normal;
        font-size: 15px;
        display: block;
      ">${escapeHtml(data.author)}</cite>
      ${data.source ? `<span style="
        color: ${COLORS.gray};
        font-size: 13px;
      ">${escapeHtml(data.source)}</span>` : ''}
    </div>
  </footer>` : ''}
</blockquote>`;
}

function renderCTA(data: { title?: string; description?: string; buttonText?: string; buttonLink?: string }): string {
  if (!data) return '';
  
  return `
<div style="
  background: linear-gradient(135deg, ${COLORS.dark} 0%, #374151 100%);
  border-radius: 16px;
  padding: 36px 40px;
  margin: 40px 0;
  text-align: center;
  box-shadow: 0 8px 30px rgba(0,0,0,0.2);
">
  ${data.title ? `
  <h3 style="
    color: ${COLORS.white};
    font-family: ${FONTS.heading};
    font-weight: 700;
    font-size: 26px;
    margin: 0 0 12px 0;
  ">${escapeHtml(data.title)}</h3>` : ''}
  ${data.description ? `
  <p style="
    color: rgba(255,255,255,0.85);
    font-family: ${FONTS.body};
    font-size: 17px;
    line-height: 1.6;
    margin: 0 0 24px 0;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  ">${escapeHtml(data.description)}</p>` : ''}
  ${data.buttonText ? `
  <a href="${escapeHtml(data.buttonLink || '#')}" style="
    display: inline-block;
    background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%);
    color: ${COLORS.white};
    font-family: ${FONTS.body};
    font-weight: 600;
    font-size: 16px;
    padding: 14px 36px;
    border-radius: 50px;
    text-decoration: none;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    transition: transform 0.2s, box-shadow 0.2s;
  ">${escapeHtml(data.buttonText)} →</a>` : ''}
</div>`;
}

function renderSummary(content: string): string {
  return `
<div style="
  background: linear-gradient(135deg, ${COLORS.infoLight} 0%, ${COLORS.white} 100%);
  border: 2px solid ${COLORS.info};
  border-radius: 16px;
  padding: 28px 32px;
  margin: 40px 0;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
">
  <div style="
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 2px solid ${COLORS.info};
  ">
    <span style="font-size: 24px;">📝</span>
    <h3 style="
      color: ${COLORS.dark};
      font-family: ${FONTS.heading};
      font-weight: 700;
      font-size: 20px;
      margin: 0;
    ">Summary</h3>
  </div>
  <p style="
    color: ${COLORS.dark};
    font-family: ${FONTS.body};
    font-size: 17px;
    line-height: 1.8;
    margin: 0;
  ">${escapeHtml(content)}</p>
</div>`;
}

function renderFAQ(items: Array<{ question: string; answer: string }>): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  
  const faqItems = items.map((item, index) => `
    <div style="
      border: 1px solid ${COLORS.border};
      border-radius: 12px;
      margin-bottom: 12px;
      overflow: hidden;
      background: ${COLORS.white};
    ">
      <details style="margin: 0;">
        <summary style="
          padding: 18px 24px;
          cursor: pointer;
          font-family: ${FONTS.heading};
          font-weight: 600;
          font-size: 17px;
          color: ${COLORS.dark};
          background: ${COLORS.grayLight};
          list-style: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span>${escapeHtml(item.question)}</span>
          <span style="color: ${COLORS.primary}; font-size: 20px;">+</span>
        </summary>
        <div style="
          padding: 20px 24px;
          color: ${COLORS.gray};
          font-family: ${FONTS.body};
          font-size: 16px;
          line-height: 1.7;
          border-top: 1px solid ${COLORS.border};
        ">${escapeHtml(item.answer)}</div>
      </details>
    </div>`).join('');

  return `
<div style="
  margin: 40px 0;
">
  <div style="
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  ">
    <span style="font-size: 28px;">❓</span>
    <h2 style="
      color: ${COLORS.dark};
      font-family: ${FONTS.heading};
      font-weight: 700;
      font-size: 26px;
      margin: 0;
    ">Frequently Asked Questions</h2>
  </div>
  ${faqItems}
</div>`;
}

function renderList(items: string[], ordered: boolean = false): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  
  const tag = ordered ? 'ol' : 'ul';
  const listItems = items.map(item => `
    <li style="
      padding: 8px 0;
      color: ${COLORS.dark};
      font-family: ${FONTS.body};
      font-size: 16px;
      line-height: 1.6;
    ">${escapeHtml(item)}</li>`).join('');

  return `
<${tag} style="
  margin: 20px 0;
  padding-left: 24px;
">${listItems}
</${tag}>`;
}

function renderTableOfContents(sections: BlogSection[]): string {
  const headings = sections.filter(s => s.type === 'heading' && s.content);
  if (headings.length === 0) return '';
  
  const tocItems = headings.map((h, i) => {
    const id = `section-${i + 1}`;
    return `
    <li style="
      padding: 10px 0;
      border-bottom: 1px solid ${COLORS.border};
    ">
      <a href="#${id}" style="
        color: ${COLORS.primary};
        font-family: ${FONTS.body};
        font-size: 15px;
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 10px;
      ">
        <span style="
          width: 24px;
          height: 24px;
          background: ${COLORS.grayLight};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: ${COLORS.gray};
        ">${i + 1}</span>
        ${escapeHtml(h.content || '')}
      </a>
    </li>`;
  }).join('');

  return `
<nav style="
  background: ${COLORS.grayLight};
  border-radius: 16px;
  padding: 24px 28px;
  margin: 32px 0;
  border: 1px solid ${COLORS.border};
">
  <div style="
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 2px solid ${COLORS.border};
  ">
    <span style="font-size: 20px;">📑</span>
    <h4 style="
      color: ${COLORS.dark};
      font-family: ${FONTS.heading};
      font-weight: 700;
      font-size: 16px;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    ">Table of Contents</h4>
  </div>
  <ol style="
    list-style: none;
    margin: 0;
    padding: 0;
  ">${tocItems}
  </ol>
</nav>`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

export function renderBlogPostToHTML(blogPost: BlogPost): string {
  if (!blogPost || !blogPost.sections || !Array.isArray(blogPost.sections)) {
    console.error('[WordPressRenderer] Invalid blog post structure');
    return '<p>Content could not be rendered.</p>';
  }

  let html = '';
  let headingIndex = 0;
  let hasToc = false;

  // Check if we should add TOC (more than 3 headings)
  const headingCount = blogPost.sections.filter(s => s.type === 'heading').length;
  const shouldAddToc = headingCount >= 3;

  for (const section of blogPost.sections) {
    try {
      switch (section.type) {
        case 'tldr':
          html += renderTLDR(section.content || '');
          // Add TOC after TL;DR if applicable
          if (shouldAddToc && !hasToc) {
            html += renderTableOfContents(blogPost.sections);
            hasToc = true;
          }
          break;

        case 'takeaways':
          html += renderTakeaways(section.data || []);
          break;

        case 'heading':
          headingIndex++;
          const headingHtml = renderHeading(section.content || '', 2);
          // Add ID for TOC linking
          html += headingHtml.replace(/<h2/, `<h2 id="section-${headingIndex}"`);
          break;

        case 'paragraph':
          html += renderParagraph(section.content || '');
          break;

        case 'quote':
          html += renderQuote(section.data || { text: section.content || '' });
          break;

        case 'cta':
          html += renderCTA(section.data || {});
          break;

        case 'summary':
          html += renderSummary(section.content || '');
          break;

        case 'faq':
          html += renderFAQ(section.data || []);
          break;

        case 'list':
          html += renderList(section.data || [], false);
          break;

        case 'toc':
          if (!hasToc) {
            html += renderTableOfContents(blogPost.sections);
            hasToc = true;
          }
          break;

        default:
          // Fallback: render as paragraph
          if (section.content) {
            html += renderParagraph(section.content);
          }
      }
    } catch (error) {
      console.error(`[WordPressRenderer] Error rendering section type "${section.type}":`, error);
    }
  }

  // Wrap in article container
  return `
<article style="
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: ${FONTS.body};
  color: ${COLORS.dark};
  line-height: 1.6;
">
${html}
</article>`;
}

// ============================================================================
// LEGACY SUPPORT - Convert old format to new
// ============================================================================

export function convertLegacyOptimization(optimization: any): BlogPost | null {
  if (!optimization) return null;

  // If already in BlogPost format
  if (optimization.sections && Array.isArray(optimization.sections)) {
    return optimization as BlogPost;
  }

  // Convert legacy format (from PageQueue.tsx OptimizationResult)
  const sections: BlogSection[] = [];

  // Add TL;DR if available
  if (optimization.tldrSummary && Array.isArray(optimization.tldrSummary)) {
    sections.push({
      type: 'tldr',
      content: optimization.tldrSummary.join(' ')
    });
  }

  // Add Key Takeaways
  if (optimization.keyTakeaways && Array.isArray(optimization.keyTakeaways)) {
    sections.push({
      type: 'takeaways',
      data: optimization.keyTakeaways
    });
  }

  // Add Expert Quote
  if (optimization.expertQuote) {
    sections.push({
      type: 'quote',
      data: {
        text: optimization.expertQuote.quote,
        author: optimization.expertQuote.author,
        source: optimization.expertQuote.role
      }
    });
  }

  // Add main content (H1, H2s, and content)
  if (optimization.h1) {
    sections.push({ type: 'heading', content: optimization.h1 });
  }

  if (optimization.optimizedContent) {
    sections.push({ type: 'paragraph', content: optimization.optimizedContent });
  }

  if (optimization.h2s && Array.isArray(optimization.h2s)) {
    optimization.h2s.forEach((h2: string) => {
      sections.push({ type: 'heading', content: h2 });
    });
  }

  // Add FAQs
  if (optimization.faqs && Array.isArray(optimization.faqs)) {
    sections.push({
      type: 'faq',
      data: optimization.faqs
    });
  }

  // Add CTA
  sections.push({
    type: 'cta',
    data: {
      title: 'Take the Next Step',
      description: 'Ready to implement these insights?',
      buttonText: 'Get Started',
      buttonLink: '#'
    }
  });

  return {
    title: optimization.optimizedTitle || 'Optimized Content',
    metaDescription: optimization.metaDescription,
    qualityScore: optimization.qualityScore,
    wordCount: optimization.contentStrategy?.wordCount,
    sections
  };
}

export default {
  renderBlogPostToHTML,
  convertLegacyOptimization
};
