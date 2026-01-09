import { ArticleComponent } from '@/lib/pipeline/types';

/**
 * ENTERPRISE-GRADE CONTENT QUALITY SCORER
 * Validates readability, completeness, SEO, uniqueness, and engagement
 */

export interface ContentScore {
  readability: number; // 0-100 (Flesch-Kincaid)
  completeness: number; // 0-100 (PAA coverage %)
  entityCoverage: number; // 0-100 (target entity coverage %)
  uniqueness: number; // 0-100 (plagiarism check %)
  engagement: number; // 0-100 (visual blocks & examples)
  overall: number; // 0-100 (weighted average)
  failingAspects: string[];
  recommendations: string[];
}

export async function scoreContent(
  components: ArticleComponent[],
  paaQuestions: string[] = [],
  targetEntities: string[] = []
): Promise<ContentScore> {
  const text = extractText(components);
  const wordCount = text.split(/\s+/).length;

  // Score readability (Flesch-Kincaid Grade Level)
  const readability = calculateReadability(text);

  // Score completeness (PAA questions answered)
  const completeness = paaQuestions.length > 0
    ? checkPaaQuestions(text, paaQuestions)
    : 85;

  // Score entity coverage
  const entityCoverage = targetEntities.length > 0
    ? checkEntityCoverage(text, targetEntities)
    : 80;

  // Score uniqueness (mock plagiarism check)
  const uniqueness = calculateUniqueness(text, wordCount);

  // Score engagement (visual blocks & examples)
  const engagement = calculateEngagement(components, text);

  // Calculate weighted overall score
  const overall = Math.round(
    readability * 0.25 +
    completeness * 0.3 +
    entityCoverage * 0.2 +
    uniqueness * 0.15 +
    engagement * 0.1
  );

  // Generate recommendations
  const recommendations: string[] = [];
  const failingAspects: string[] = [];

  if (readability < 70) {
    failingAspects.push('Readability');
    recommendations.push('Use shorter sentences and paragraphs for better readability.');
  }
  if (completeness < 75) {
    failingAspects.push('Completeness');
    recommendations.push('Answer more People Also Ask questions for better coverage.');
  }
  if (entityCoverage < 80) {
    failingAspects.push('Entity Coverage');
    recommendations.push('Include more target keywords and related entities.');
  }
  if (engagement < 75) {
    failingAspects.push('Engagement');
    recommendations.push('Add more visual blocks: TL;DR, checklists, callouts, examples.');
  }
  if (wordCount < 2000) {
    recommendations.push(`Expand content to 3000+ words (currently ${wordCount} words).`);
  }

  return {
    readability,
    completeness,
    entityCoverage,
    uniqueness,
    engagement,
    overall,
    failingAspects,
    recommendations,
  };
}

function extractText(components: ArticleComponent[]): string {
  return components
    .map((c: any) => {
      if (c.type === 'paragraph') return c.content || '';
      if (c.type === 'heading') return c.text || '';
      if (c.type === 'tldr') return c.bullets.join(' ') || '';
      if (c.type === 'key_takeaways') return c.items.map((i: any) => i.title + ' ' + i.description).join(' ') || '';
      if (c.type === 'checklist') return c.items.map((i: any) => i.text).join(' ') || '';
      if (c.type === 'callout') return c.content || '';
      if (c.type === 'faq') return c.items.map((i: any) => i.question + ' ' + i.answer).join(' ') || '';
      return '';
    })
    .join(' ');
}

function calculateReadability(text: string): number {
  const sentences = text.split(/[.!?]+/).length;
  const words = text.split(/\s+/).length;
  const syllables = countSyllables(text);

  // Flesch-Kincaid Grade Level
  const gradeLevel = (0.39 * (words / sentences)) + (11.8 * (syllables / words)) - 15.59;
  
  // Convert grade level to 0-100 score (lower grade = higher score)
  const score = Math.max(0, Math.min(100, 100 - gradeLevel * 5));
  return Math.round(score);
}

function countSyllables(text: string): number {
  const words = text.match(/\b\w+\b/g) || [];
  let total = 0;
  words.forEach((word) => {
    total += (word.match(/[aeiouy]/gi) || []).length;
  });
  return total;
}

function checkPaaQuestions(text: string, questions: string[]): number {
  if (questions.length === 0) return 100;
  const answered = questions.filter((q) => {
    const keywords = q.split(/\s+/).slice(0, 3);
    return keywords.some((k) => text.toLowerCase().includes(k.toLowerCase()));
  }).length;
  return Math.round((answered / questions.length) * 100);
}

function checkEntityCoverage(text: string, entities: string[]): number {
  if (entities.length === 0) return 100;
  const covered = entities.filter((e) =>
    text.toLowerCase().includes(e.toLowerCase())
  ).length;
  return Math.round((covered / entities.length) * 100);
}

function calculateUniqueness(text: string, wordCount: number): number {
  // Mock uniqueness based on text length and diversity
  const uniqueWords = new Set(text.toLowerCase().split(/\s+/)).size;
  const diversity = (uniqueWords / wordCount) * 100;
  return Math.min(100, Math.round(diversity * 1.5));
}

function calculateEngagement(components: ArticleComponent[], text: string): number {
  let score = 50;

  // Count visual blocks
  const blockCount = components.filter(
    (c: any) => ['tldr', 'key_takeaways', 'callout', 'checklist', 'faq', 'video', 'quote'].includes(c.type)
  ).length;
  score += blockCount * 5;

  // Count examples and case studies
  const exampleKeywords = ['example', 'case study', 'real-world', 'scenario', 'instance'];
  const hasExamples = exampleKeywords.some((k) => text.toLowerCase().includes(k));
  if (hasExamples) score += 15;

  // Count storytelling elements
  const storyKeywords = ['story', 'journey', 'experienced', 'discovered', 'realized', 'learned'];
  const hasStory = storyKeywords.filter((k) => text.toLowerCase().includes(k)).length >= 2;
  if (hasStory) score += 10;

  // Count actionable language
  const actionKeywords = ['step', 'action', 'implement', 'apply', 'execute', 'do this'];
  const actionCount = actionKeywords.filter((k) => text.toLowerCase().includes(k)).length;
  score += Math.min(15, actionCount * 3);

  return Math.min(100, score);
}
