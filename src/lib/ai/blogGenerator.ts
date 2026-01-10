/**
 * SOTA AI BLOG POST GENERATOR
 * Generates enterprise-grade blog posts with styled components using Google Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BlogPostContent, BlogSection } from '@/components/blog/BlogPostComponents';

// Initialize Gemini AI
// Gemini AI will be initialized with API key passed from the API routeexport interface BlogGenerationRequest {
  url: string;
  apiKey: string;
  title: string;
  keywords?: string[];
  targetLength?: number;
}

/**
 * CRITICAL: This prompt instructs AI to generate JSON with component types
 * that match our React components (TLDRBox, KeyTakeawaysBox, etc.)
 */
const BLOG_GENERATION_PROMPT = `
You are an EXPERT SEO blog writer. Generate a comprehensive, engaging blog post in JSON format.

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, just pure JSON.

The blog post must include these SPECIFIC component types:

1. "tldr" - Quick summary (2-3 sentences)
2. "takeaways" - Key bullet points (4-6 items)
3. "intro" - Opening paragraph
4. "content" - Main body content (multiple paragraphs with H2/H3 headers)
5. "quote" - Testimonial or expert quote
6. "cta" - Call-to-action
7. "video" - YouTube video embed (if relevant)
8. "summary" - Conclusion section
9. "table" - Comparison or data table (if relevant)

JSON Structure:
{
  "title": "Blog Post Title",
  "excerpt": "Brief description (1-2 sentences)",
  "readTime": "8 min",
  "sections": [
    {"type": "tldr", "content": "Quick summary text"},
    {"type": "takeaways", "items": ["Point 1", "Point 2", "Point 3"]},
    {"type": "intro", "content": "<p>Introduction paragraph with <strong>emphasis</strong></p>"},
    {"type": "content", "content": "<h2>Section Title</h2><p>Paragraph text...</p>"},
    {"type": "quote", "text": "Quote text", "author": "Author Name"},
    {"type": "cta", "title": "Take Action", "description": "CTA text", "buttonText": "Get Started", "buttonUrl": "#"},
    {"type": "video", "url": "https://youtube.com/watch?v=VIDEO_ID", "title": "Video Title"},
    {"type": "summary", "content": "<p>Conclusion text</p>"},
    {"type": "table", "headers": ["Column 1", "Column 2"], "rows": [["Data 1", "Data 2"]]}
  ]
}

Content Requirements:
- Write 1500-2000 words
- Use short paragraphs (2-3 sentences)
- Include relevant H2/H3 headers
- Add <strong>, <em>, <ul>, <ol>, <li> HTML tags
- Make it SEO-optimized and engaging
- Include statistics and examples
- Write in a professional but conversational tone

Return ONLY the JSON object. No additional text.
`;

/**
 * Generate blog post using Google Gemini AI
 */
export async function generateBlogPost(request: BlogGenerationRequest): Promise<BlogPostContent> {
  try {
        // Initialize Gemini AI with API key from request
        const genAI = new GoogleGenerativeAI(request.apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `${BLOG_GENERATION_PROMPT}\n\nTopic: ${request.title}\nURL: ${request.url}\nKeywords: ${request.keywords?.join(', ') || 'N/A'}\n\nGenerate the blog post JSON now:`;

    console.log('[AI] Generating blog post with Gemini...');
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    console.log('[AI] Raw response:', text.substring(0, 500));

    // Clean up response (remove markdown code blocks if present)
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON response
    const blogData = JSON.parse(text);

    // Transform to BlogPostContent format
    const blogPost: BlogPostContent = {
      id: `ai-${Date.now()}`,
      title: blogData.title || request.title,
      excerpt: blogData.excerpt || '',
      readTime: blogData.readTime || '8 min',
      author: 'AI Content Generator',
      publishedAt: new Date(),
      category: 'AI-Generated',
      tags: request.keywords || [],
      sections: blogData.sections || [],
    };

    console.log(`[AI] ✅ Generated blog post with ${blogPost.sections.length} sections`);
    return blogPost;

  } catch (error) {
    console.error('[AI] Error generating blog post:', error);
    
    // Return fallback blog post
    return createFallbackBlogPost(request);
  }
}

/**
 * Fallback blog post if AI generation fails
 */
function createFallbackBlogPost(request: BlogGenerationRequest): BlogPostContent {
  return {
    id: `fallback-${Date.now()}`,
    title: request.title,
    excerpt: `Comprehensive guide about ${request.title}`,
    readTime: '8 min',
    author: 'Page Perfector',
    publishedAt: new Date(),
    category: 'Guide',
    tags: request.keywords || [],
    sections: [
      {
        type: 'tldr',
        content: `This guide covers everything you need to know about ${request.title}, including key insights, practical tips, and actionable strategies.`,
      },
      {
        type: 'takeaways',
        items: [
          'Understand the fundamentals and core concepts',
          'Learn best practices and proven strategies',
          'Discover actionable tips you can implement today',
          'Avoid common mistakes and pitfalls',
          'Get expert insights and recommendations',
        ],
      },
      {
        type: 'intro',
        content: `<p>Welcome to our comprehensive guide on <strong>${request.title}</strong>. In this article, we'll explore everything you need to know to master this topic.</p>`,
      },
      {
        type: 'content',
        content: `<h2>Understanding the Basics</h2><p>To get started with ${request.title}, it's essential to understand the fundamental concepts. This forms the foundation for everything else we'll discuss.</p><h2>Key Strategies</h2><p>Now that we've covered the basics, let's dive into the strategies that actually work. These have been proven effective across multiple use cases.</p><h2>Implementation Guide</h2><p>Here's how to put these strategies into practice. Follow these steps for the best results.</p>`,
      },
      {
        type: 'quote',
        text: `Success in ${request.title} comes from consistent application of proven principles and continuous learning.`,
        author: 'Industry Expert',
      },
      {
        type: 'cta',
        title: 'Ready to Get Started?',
        description: `Take your understanding of ${request.title} to the next level with our comprehensive resources.`,
        buttonText: 'Learn More',
        buttonUrl: '#',
      },
      {
        type: 'summary',
        content: `<p>In this guide, we've covered the essential aspects of ${request.title}. Remember to apply these insights consistently for the best results.</p>`,
      },
    ],
  };
}

export default generateBlogPost;
