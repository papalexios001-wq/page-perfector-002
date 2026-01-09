export interface SEOMetrics {
  title: {
    length: number;
    optimal: boolean;
    score: number;
  };
  metaDescription: {
    length: number;
    optimal: boolean;
    score: number;
  };
  headings: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    optimal: boolean;
    score: number;
  };
  keywords: {
    primaryKeyword: string;
    frequency: number;
    placement: {
      inTitle: boolean;
      inH1: boolean;
      inFirstParagraph: boolean;
      inMeta: boolean;
    };
    score: number;
  };
  images: {
    count: number;
    withAlt: number;
    score: number;
  };
  links: {
    internalCount: number;
    externalCount: number;
    brokenCount: number;
    score: number;
  };
  readability: {
    fleschKincaidGrade: number;
    avgSentenceLength: number;
    avgWordLength: number;
    score: number;
  };
  performance: {
    wordCount: number;
    contentRatio: number;
    score: number;
  };
  overall: number;
}

export interface SEORecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  impact: string;
}

export class SEOAnalyzer {
  private metaDescriptionLengthMin = 120;
  private metaDescriptionLengthMax = 160;
  private titleLengthMin = 30;
  private titleLengthMax = 60;
  private optimalWordCount = { min: 800, max: 3000 };

  analyzeContent(
    content: string,
    metadata: {
      title?: string;
      description?: string;
      url?: string;
      keywords?: string[];
    }
  ): { metrics: SEOMetrics; recommendations: SEORecommendation[] } {
    const metrics = this.calculateMetrics(content, metadata);
    const recommendations = this.generateRecommendations(metrics, content);

    return { metrics, recommendations };
  }

  private calculateMetrics(
    content: string,
    metadata: any
  ): SEOMetrics {
    const title = metadata.title || '';
    const description = metadata.description || '';
    const keywords = metadata.keywords || [];
    const primaryKeyword = keywords[0] || '';

    // Title analysis
    const titleScore = this.scoreTitleSEO(title);

    // Meta description analysis
    const metaScore = this.scoreMetaDescription(description);

    // Heading analysis
    const headingMetrics = this.analyzeHeadings(content);

    // Keyword analysis
    const keywordMetrics = this.analyzeKeywords(content, primaryKeyword, metadata);

    // Image analysis
    const imageMetrics = this.analyzeImages(content);

    // Link analysis
    const linkMetrics = this.analyzeLinks(content);

    // Readability analysis
    const readabilityMetrics = this.analyzeReadability(content);

    // Performance metrics
    const performanceMetrics = this.analyzePerformance(content);

    // Calculate overall score
    const overall =
      (titleScore.score +
        metaScore.score +
        headingMetrics.score +
        keywordMetrics.score +
        imageMetrics.score +
        linkMetrics.score +
        readabilityMetrics.score +
        performanceMetrics.score) /
      8;

    return {
      title: titleScore,
      metaDescription: metaScore,
      headings: headingMetrics,
      keywords: keywordMetrics,
      images: imageMetrics,
      links: linkMetrics,
      readability: readabilityMetrics,
      performance: performanceMetrics,
      overall: Math.round(overall),
    };
  }

  private scoreTitleSEO(title: string): any {
    const length = title.length;
    const optimal = length >= this.titleLengthMin && length <= this.titleLengthMax;
    let score = optimal ? 100 : 70;

    if (length < 10) score = 20;
    if (length > 100) score = 50;

    return { length, optimal, score };
  }

  private scoreMetaDescription(description: string): any {
    const length = description.length;
    const optimal = length >= this.metaDescriptionLengthMin && length <= this.metaDescriptionLengthMax;
    let score = optimal ? 100 : 75;

    if (length === 0) score = 0;
    if (length < 50 || length > 200) score = 60;

    return { length, optimal, score };
  }

  private analyzeHeadings(content: string): any {
    const h1Regex = /<h1[^>]*>([^<]+)<\/h1>/gi;
    const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/gi;
    const h3Regex = /<h3[^>]*>([^<]+)<\/h3>/gi;

    const h1Count = (content.match(h1Regex) || []).length;
    const h2Count = (content.match(h2Regex) || []).length;
    const h3Count = (content.match(h3Regex) || []).length;

    // Optimal: 1 H1, 2-4 H2s, 3-6 H3s
    const optimal = h1Count === 1 && h2Count >= 2 && h2Count <= 4;
    const score =
      h1Count === 1
        ? 100
        : h1Count === 0
          ? 30
          : h1Count > 1
            ? 60
            : 75;

    return { h1Count, h2Count, h3Count, optimal, score };
  }

  private analyzeKeywords(
    content: string,
    keyword: string,
    metadata: any
  ): any {
    const lowerContent = content.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    const frequency = (lowerContent.match(new RegExp(lowerKeyword, 'g')) || []).length;
    const title = metadata.title?.toLowerCase() || '';
    const description = metadata.description?.toLowerCase() || '';

    const placement = {
      inTitle: title.includes(lowerKeyword),
      inH1: false,
      inFirstParagraph: lowerContent.substring(0, 500).includes(lowerKeyword),
      inMeta: description.includes(lowerKeyword),
    };

    let score = 0;
    if (frequency >= 3 && frequency <= 5) score += 40;
    if (frequency > 5) score += 60; // Possibly over-optimized
    if (placement.inTitle) score += 20;
    if (placement.inFirstParagraph) score += 20;
    if (placement.inMeta) score += 10;

    return { primaryKeyword: keyword, frequency, placement, score: Math.min(100, score) };
  }

  private analyzeImages(content: string): any {
    const imgRegex = /<img[^>]*>/gi;
    const altRegex = /alt="[^"]*"/i;

    const images = content.match(imgRegex) || [];
    const count = images.length;
    const withAlt = images.filter((img) => altRegex.test(img)).length;

    const score = count > 0 ? (withAlt / count) * 100 : 50;

    return { count, withAlt, score: Math.round(score) };
  }

  private analyzeLinks(content: string): any {
    const internalRegex = /href="\/[^"]*"/gi;
    const externalRegex = /href="https?:\/\/[^"]*"/gi;
    const brokenRegex = /href="#"/gi;

    const internalCount = (content.match(internalRegex) || []).length;
    const externalCount = (content.match(externalRegex) || []).length;
    const brokenCount = (content.match(brokenRegex) || []).length;

    let score = 50;
    if (internalCount >= 3 && internalCount <= 10) score = 100;
    if (externalCount >= 1) score += 20;
    if (brokenCount > 0) score -= brokenCount * 10;

    return {
      internalCount,
      externalCount,
      brokenCount,
      score: Math.max(0, Math.min(100, score)),
    };
  }

  private analyzeReadability(content: string): any {
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).length;
    const syllables = this.countSyllables(content);

    const avgSentenceLength = words / Math.max(sentences, 1);
    const avgWordLength = content.length / Math.max(words, 1);

    // Flesch Kincaid Grade
    const fleschKincaidGrade =
      0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;

    let score = 75;
    if (fleschKincaidGrade <= 8) score = 100; // Good readability
    if (fleschKincaidGrade > 14) score = 60; // Too complex

    return {
      fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      avgWordLength: Math.round(avgWordLength * 10) / 10,
      score,
    };
  }

  private analyzePerformance(content: string): any {
    const wordCount = content.split(/\s+/).length;
    const htmlLength = content.length;
    const textLength = content.replace(/<[^>]*>/g, '').length;
    const contentRatio = (textLength / htmlLength) * 100;

    let score = 50;
    if (wordCount >= 800 && wordCount <= 3000) score = 100;
    if (contentRatio >= 25 && contentRatio <= 30) score = Math.min(score + 30, 100);

    return { wordCount, contentRatio: Math.round(contentRatio), score };
  }

  private countSyllables(text: string): number {
    const vowels = 'aeiouy';
    let syllableCount = 0;
    let previousWasVowel = false;

    text.toLowerCase().split('').forEach((char) => {
      const isVowel = vowels.includes(char);
      if (isVowel && !previousWasVowel) {
        syllableCount++;
      }
      previousWasVowel = isVowel;
    });

    return Math.max(1, syllableCount);
  }

  private generateRecommendations(
    metrics: SEOMetrics,
    content: string
  ): SEORecommendation[] {
    const recommendations: SEORecommendation[] = [];

    if (metrics.title.score < 80) {
      recommendations.push({
        priority: 'high',
        category: 'Title Tag',
        issue: `Title length is ${metrics.title.length} characters`,
        recommendation: `Keep title between 30-60 characters`,
        impact: 'Titles are crucial for SERP CTR and ranking',
      });
    }

    if (metrics.metaDescription.score < 80) {
      recommendations.push({
        priority: 'high',
        category: 'Meta Description',
        issue: `Description length is ${metrics.metaDescription.length} characters`,
        recommendation: `Keep description between 120-160 characters`,
        impact: 'Meta descriptions directly impact CTR from search results',
      });
    }

    if (metrics.headings.h1Count === 0) {
      recommendations.push({
        priority: 'critical',
        category: 'Heading Structure',
        issue: 'No H1 tag found',
        recommendation: 'Add exactly one H1 tag that includes your primary keyword',
        impact: 'H1 tags are essential for on-page SEO',
      });
    }

    if (metrics.keywords.score < 70) {
      recommendations.push({
        priority: 'high',
        category: 'Keyword Optimization',
        issue: `Keyword appears ${metrics.keywords.frequency} times`,
        recommendation: 'Include primary keyword in title, H1, first paragraph, and naturally throughout',
        impact: 'Keyword optimization improves relevance and ranking potential',
      });
    }

    if (metrics.performance.wordCount < 800) {
      recommendations.push({
        priority: 'high',
        category: 'Content Length',
        issue: `Content is ${metrics.performance.wordCount} words (below optimal)`,
        recommendation: `Expand to 800-3000 words with comprehensive information`,
        impact: 'Longer content tends to rank better and provides more value',
      });
    }

    if (metrics.readability.score < 75) {
      recommendations.push({
        priority: 'medium',
        category: 'Readability',
        issue: `Flesch-Kincaid grade of ${metrics.readability.fleschKincaidGrade}`,
        recommendation: 'Simplify language, use shorter sentences, and break up paragraphs',
        impact: 'Improved readability increases engagement and time on page',
      });
    }

    return recommendations;
  }
}

export default SEOAnalyzer;
