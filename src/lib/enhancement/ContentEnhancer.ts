import { ContentScorer } from '../quality/ContentScorer';
import { OptimizeRequest, OptimizeResponse, EnhancementSuggestion } from '../pipeline/types';

export interface EnhancementPrompt {
  id: string;
  category: 'structure' | 'engagement' | 'seo' | 'clarity' | 'authority';
  template: string;
  priority: 'high' | 'medium' | 'low';
}

export interface EnhancedContent {
  original: string;
  enhanced: string;
  suggestions: EnhancementSuggestion[];
  improvements: {
    readability: number;
    seoScore: number;
    engagement: number;
    clarity: number;
  };
}

export class ContentEnhancer {
  private scorer: ContentScorer;
  private enhancementPrompts: Map<string, EnhancementPrompt>;

  constructor() {
    this.scorer = new ContentScorer();
    this.enhancementPrompts = this.initializePrompts();
  }

  private initializePrompts(): Map<string, EnhancementPrompt> {
    return new Map([
      ['structure-improve', {
        id: 'structure-improve',
        category: 'structure',
        template: 'Restructure the content with clear H2 headers, short paragraphs (2-3 sentences), and numbered lists for better scannability.',
        priority: 'high',
      }],
      ['engagement-hooks', {
        id: 'engagement-hooks',
        category: 'engagement',
        template: 'Add compelling opening sentences, rhetorical questions, and surprising statistics to boost engagement and time-on-page.',
        priority: 'high',
      }],
      ['seo-keywords', {
        id: 'seo-keywords',
        category: 'seo',
        template: 'Naturally integrate target keywords in H1, H2, first 100 words, and throughout the content while maintaining readability.',
        priority: 'high',
      }],
      ['clarity-simplify', {
        id: 'clarity-simplify',
        category: 'clarity',
        template: 'Simplify complex sentences, replace jargon with accessible language, and use active voice consistently.',
        priority: 'medium',
      }],
      ['authority-evidence', {
        id: 'authority-evidence',
        category: 'authority',
        template: 'Add expert citations, research references, case studies, and real-world examples to establish authority.',
        priority: 'medium',
      }],
      ['cta-optimization', {
        id: 'cta-optimization',
        category: 'engagement',
        template: 'Include strategic, action-oriented CTAs that align with user intent and drive conversions.',
        priority: 'high',
      }],
    ]);
  }

  async enhance(content: string, keywords?: string[]): Promise<EnhancedContent> {
    const originalScore = this.scorer.scoreContent(content, keywords);
    const suggestions = this.generateSuggestions(content, originalScore);

    const enhancedContent = this.applyEnhancements(content, suggestions);
    const enhancedScore = this.scorer.scoreContent(enhancedContent, keywords);

    return {
      original: content,
      enhanced: enhancedContent,
      suggestions,
      improvements: {
        readability: enhancedScore.readability - originalScore.readability,
        seoScore: enhancedScore.seoScore - originalScore.seoScore,
        engagement: enhancedScore.engagement - originalScore.engagement,
        clarity: enhancedScore.clarity - originalScore.clarity,
      },
    };
  }

  private generateSuggestions(
    content: string,
    score: ReturnType<typeof this.scorer.scoreContent>
  ): EnhancementSuggestion[] {
    const suggestions: EnhancementSuggestion[] = [];

    // Readability improvements
    if (score.readability < 70) {
      suggestions.push({
        category: 'readability',
        suggestion: 'Break content into shorter paragraphs and use more subheadings for better readability.',
        impact: 'medium',
        implementation: 'Add H2 and H3 headers every 150-200 words.',
      });
    }

    // SEO improvements
    if (score.seoScore < 75) {
      suggestions.push({
        category: 'seo',
        suggestion: 'Optimize keyword placement and frequency to improve SEO visibility.',
        impact: 'high',
        implementation: 'Place primary keyword in first 100 words, subheadings, and conclusion.',
      });
    }

    // Engagement improvements
    if (score.engagement < 70) {
      suggestions.push({
        category: 'engagement',
        suggestion: 'Add more interactive elements and compelling hooks to boost engagement.',
        impact: 'high',
        implementation: 'Include statistics, questions, and real-world examples throughout.',
      });
    }

    // Clarity improvements
    if (score.clarity < 75) {
      suggestions.push({
        category: 'clarity',
        suggestion: 'Simplify language and improve sentence structure for better clarity.',
        impact: 'medium',
        implementation: 'Use shorter sentences (15-20 words), active voice, and defined terms.',
      });
    }

    // Content length
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 1000) {
      suggestions.push({
        category: 'content',
        suggestion: 'Expand content depth to target longer articles (1500-2500 words) for better SERP ranking.',
        impact: 'high',
        implementation: 'Add detailed sections, examples, and supporting evidence.',
      });
    }

    return suggestions;
  }

  private applyEnhancements(
    content: string,
    suggestions: EnhancementSuggestion[]
  ): string {
    let enhanced = content;

    // Apply structural improvements
    if (suggestions.some((s) => s.category === 'readability')) {
      enhanced = this.improveStructure(enhanced);
    }

    // Apply engagement improvements
    if (suggestions.some((s) => s.category === 'engagement')) {
      enhanced = this.improveEngagement(enhanced);
    }

    // Apply clarity improvements
    if (suggestions.some((s) => s.category === 'clarity')) {
      enhanced = this.improveClarity(enhanced);
    }

    return enhanced;
  }

  private improveStructure(content: string): string {
    // Split into paragraphs
    const paragraphs = content.split(/\n\n+/);
    const improved: string[] = [];

    paragraphs.forEach((para, index) => {
      if (para.length > 300) {
        // Break long paragraphs into shorter ones
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        let currentPara = '';

        sentences.forEach((sentence) => {
          if ((currentPara + sentence).length > 150) {
            if (currentPara) improved.push(currentPara.trim());
            currentPara = sentence;
          } else {
            currentPara += sentence;
          }
        });

        if (currentPara) improved.push(currentPara.trim());
      } else {
        improved.push(para);
      }
    });

    return improved.join('\n\n');
  }

  private improveEngagement(content: string): string {
    // Add hooks if missing
    if (!content.includes('?') && !content.includes('!')) {
      const firstParagion = content.split(/\n\n/)[0];
      return content.replace(
        firstParagion,
        `${firstParagion}\n\nDid you know that this could transform your results? Let's explore how...`
      );
    }

    return content;
  }

  private improveClarity(content: string): string {
    // Replace complex phrases with simpler alternatives
    const complexMap: Record<string, string> = {
      'utilize': 'use',
      'implement': 'use',
      'furthermore': 'also',
      'moreover': 'additionally',
      'subsequently': 'next',
      'consequently': 'as a result',
      'in order to': 'to',
      'due to the fact that': 'because',
    };

    let improved = content;
    Object.entries(complexMap).forEach(([complex, simple]) => {
      improved = improved.replace(new RegExp(`\\b${complex}\\b`, 'gi'), simple);
    });

    return improved;
  }

  getEnhancementPrompt(promptId: string): EnhancementPrompt | undefined {
    return this.enhancementPrompts.get(promptId);
  }

  getAllPrompts(): EnhancementPrompt[] {
    return Array.from(this.enhancementPrompts.values());
  }

  getPromptsByCategory(category: string): EnhancementPrompt[] {
    return Array.from(this.enhancementPrompts.values()).filter((p) => p.category === category);
  }

  getHighPriorityPrompts(): EnhancementPrompt[] {
    return Array.from(this.enhancementPrompts.values()).filter((p) => p.priority === 'high');
  }

  async generateEnhancementPlan(
    content: string,
    targetScore: number = 85
  ): Promise<{ prompts: EnhancementPrompt[]; estimatedTime: number }> {
    const currentScore = this.scorer.scoreContent(content);
    const overallScore = (currentScore.readability + currentScore.seoScore + currentScore.engagement + currentScore.clarity) / 4;

    const prompts = overallScore < targetScore ? this.getHighPriorityPrompts() : [];
    const estimatedTime = prompts.length * 2; // 2 minutes per high-priority enhancement

    return { prompts, estimatedTime };
  }
}

export default ContentEnhancer;
