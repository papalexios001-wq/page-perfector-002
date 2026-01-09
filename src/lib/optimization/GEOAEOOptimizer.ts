export interface GEOTarget {
  country?: string;
  state?: string;
  city?: string;
  radius?: number; // kilometers
  language?: string;
}

export interface AEOOptimization {
  answerFormat: 'paragraph' | 'list' | 'table' | 'featured-snippet';
  keyQuestions: string[];
  answerLength: 'short' | 'medium' | 'long';
  structuredData: boolean;
}

export interface GEOAEOResult {
  optimizedContent: string;
  metaTags: {
    [key: string]: string;
  };
  structuredData: any;
  localKeywords: string[];
  recommendations: string[];
}

export class GEOAEOOptimizer {
  optimizeForGEO(
    content: string,
    target: GEOTarget,
    metadata: any
  ): GEOAEOResult {
    const optimizedContent = this.injectGEOKeywords(content, target);
    const metaTags = this.generateGEOMeta(target, metadata);
    const structuredData = this.generateGEOStructuredData(target);
    const localKeywords = this.extractLocalKeywords(content, target);
    const recommendations = this.generateGEORecommendations(target);

    return {
      optimizedContent,
      metaTags,
      structuredData,
      localKeywords,
      recommendations,
    };
  }

  optimizeForAEO(
    content: string,
    optimization: AEOOptimization,
    topic: string
  ): GEOAEOResult {
    const optimizedContent = this.restructureForAEO(content, optimization);
    const metaTags = this.generateAEOMeta(topic, optimization);
    const structuredData = this.generateFAQStructuredData(optimization.keyQuestions);
    const localKeywords = [];
    const recommendations = this.generateAEORecommendations(optimization);

    return {
      optimizedContent,
      metaTags,
      structuredData,
      localKeywords,
      recommendations,
    };
  }

  private injectGEOKeywords(content: string, target: GEOTarget): string {
    let optimized = content;

    // Add location to first paragraph
    const locationPhrase = this.buildLocationPhrase(target);
    const firstParagraphMatch = content.match(/^[^.!?]*[.!?]/m);
    if (firstParagraphMatch && !content.substring(0, 500).includes(target.city || '')) {
      optimized = content.replace(
        firstParagraphMatch[0],
        `${firstParagraphMatch[0].slice(0, -1)} in ${locationPhrase}. ${firstParagraphMatch[0].slice(-1)}`
      );
    }

    // Add location to headings
    if (target.city) {
      optimized = optimized.replace(
        /<h([1-3])[^>]*>([^<]+)<\/h[1-3]>/g,
        (match, level, text) => {
          if (!text.includes(target.city!)) {
            return `<h${level}>${text} - ${target.city}</h${level}>`;
          }
          return match;
        }
      );
    }

    return optimized;
  }

  private buildLocationPhrase(target: GEOTarget): string {
    const parts = [];
    if (target.city) parts.push(target.city);
    if (target.state) parts.push(target.state);
    if (target.country) parts.push(target.country);
    return parts.join(', ');
  }

  private generateGEOMeta(
    target: GEOTarget,
    metadata: any
  ): { [key: string]: string } {
    const locationPhrase = this.buildLocationPhrase(target);
    return {
      'geo.position': target.city ? `${target.city}; ${target.country}` : '',
      'ICBM': '', // Would need coordinates
      'geo.placename': target.city || '',
      'geo.region': target.state ? `${target.country}-${target.state}` : target.country || '',
      'og:locale': target.language === 'es' ? 'es_ES' : 'en_US',
      'og:type': 'website',
      'description': `${metadata.description || ''} serving ${locationPhrase}`,
    };
  }

  private generateGEOStructuredData(target: GEOTarget): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      'name': target.city ? `Services in ${target.city}` : 'Local Services',
      'areaServed': {
        '@type': 'City',
        'name': target.city || '',
      },
      'serviceArea': {
        '@type': 'City',
        'name': target.city || '',
        'geo': {
          '@type': 'GeoShape',
          'circle': target.radius ? `${target.city} ${target.radius}km` : '',
        },
      },
    };
  }

  private restructureForAEO(
    content: string,
    optimization: AEOOptimization
  ): string {
    let optimized = content;

    // Add FAQ section if questions provided
    if (optimization.keyQuestions.length > 0) {
      const faqHtml = this.buildFAQSection(optimization.keyQuestions);
      optimized += '\n\n' + faqHtml;
    }

    // Restructure for featured snippet format
    if (optimization.answerFormat === 'featured-snippet') {
      optimized = this.optimizeForFeaturedSnippet(optimized, optimization.answerLength);
    }

    // Add table of contents if long-form
    if (optimization.answerLength === 'long' && !optimized.includes('Table of Contents')) {
      const toc = this.generateTableOfContents(optimized);
      optimized = toc + '\n\n' + optimized;
    }

    return optimized;
  }

  private buildFAQSection(questions: string[]): string {
    let faqHtml = '<section class="faq" vocab="https://schema.org/" typeof="FAQPage">\n';
    faqHtml += '<h2>Frequently Asked Questions</h2>\n';

    questions.forEach((question) => {
      faqHtml += `
  <div typeof="Question" property="mainEntity">
    <h3 property="name">${question}</h3>
    <div typeof="Answer" property="acceptedAnswer">
      <p property="text">Provide a comprehensive answer to this question...</p>
    </div>
  </div>
`;
    });

    faqHtml += '</section>';
    return faqHtml;
  }

  private optimizeForFeaturedSnippet(content: string, answerLength: string): string {
    // Extract and enhance the first comprehensive answer
    const sentences = content.split(/(?<=[.!?])\s+/);
    let summary = '';

    if (answerLength === 'short') {
      summary = sentences.slice(0, 2).join(' ');
    } else if (answerLength === 'medium') {
      summary = sentences.slice(0, 4).join(' ');
    } else {
      summary = sentences.slice(0, 6).join(' ');
    }

    // Wrap in featured snippet format
    return `<div class="featured-snippet">\n<p>${summary}</p>\n</div>\n\n${content}`;
  }

  private generateTableOfContents(content: string): string {
    const headings = content.match(/<h[2-3][^>]*>([^<]+)<\/h[2-3]>/g) || [];
    let toc = '<nav class="toc">\n<h2>Table of Contents</h2>\n<ul>\n';

    headings.forEach((heading, index) => {
      const text = heading.replace(/<[^>]*>/g, '');
      const level = heading.includes('<h3') ? 'sub' : 'main';
      toc += `<li><a href="#section-${index}">${text}</a></li>\n`;
    });

    toc += '</ul>\n</nav>';
    return toc;
  }

  private generateFAQStructuredData(questions: string[]): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': questions.map((question) => ({
        '@type': 'Question',
        'name': question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Comprehensive answer will be populated with AI',
        },
      })),
    };
  }

  private extractLocalKeywords(content: string, target: GEOTarget): string[] {
    const keywords: string[] = [];
    const locationPhrase = this.buildLocationPhrase(target);

    // Common local keywords
    if (target.city) {
      keywords.push(`${target.city} services`);
      keywords.push(`near me ${target.city}`);
      keywords.push(`local ${target.city}`);
    }

    if (target.state) {
      keywords.push(`${target.state} services`);
    }

    keywords.push(locationPhrase);

    return keywords;
  }

  private generateGEORecommendations(target: GEOTarget): string[] {
    const recommendations: string[] = [];

    if (!target.city) {
      recommendations.push('Add specific city name to target local search');
    }
    if (!target.state) {
      recommendations.push('Include state/province for regional relevance');
    }
    if (!target.radius) {
      recommendations.push('Define service radius for local schema markup');
    }

    recommendations.push('Add Google My Business NAP (Name, Address, Phone) information');
    recommendations.push('Include local reviews and testimonials');
    recommendations.push('Add local structured data (LocalBusiness schema)');

    return recommendations;
  }

  private generateAEOMeta(
    topic: string,
    optimization: AEOOptimization
  ): { [key: string]: string } {
    return {
      'description': `Complete guide to ${topic}. Answers to common questions about ${topic}.`,
      'og:type': 'article',
      'article:tag': optimization.keyQuestions.slice(0, 5).join(','),
    };
  }

  private generateTableOfContents(content: string): string {
    // Already defined above
    return '';
  }

  private generateAEORecommendations(optimization: AEOOptimization): string[] {
    const recommendations: string[] = [];

    if (optimization.keyQuestions.length < 5) {
      recommendations.push('Add at least 5 commonly asked questions for better AEO coverage');
    }

    if (!optimization.structuredData) {
      recommendations.push('Add FAQ structured data for voice search optimization');
    }

    recommendations.push('Optimize for question-based queries using natural language');
    recommendations.push('Include direct, concise answers to common questions');
    recommendations.push('Use conversational keywords and long-tail variations');

    return recommendations;
  }
}

export default GEOAEOOptimizer;
