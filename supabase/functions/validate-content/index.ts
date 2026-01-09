// supabase/functions/validate-content/index.ts
// Enterprise Content Validation Engine

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationCheck {
  name: string;
  passed: boolean;
  actual: string | number;
  expected: string;
  severity: 'error' | 'warning' | 'info';
  recommendation?: string;
}

interface ValidationRequest {
  optimization: {
    optimizedTitle?: string;
    metaDescription?: string;
    optimizedContent?: string;
    h2s?: string[];
    faqs?: Array<{ question: string; answer: string }>;
    keyTakeaways?: string[];
    tldrSummary?: string[];
    internalLinks?: Array<{ anchor: string; target: string }>;
    schema?: Record<string, unknown>;
    contentStrategy?: {
      wordCount?: number;
      readabilityScore?: number;
    };
    qualityScore?: number;
  };
  minQualityScore?: number;
  minWordCount?: number;
  targetKeyword?: string;
}

interface ValidationResult {
  success: boolean;
  canPublish: boolean;
  overallScore: number;
  checks: ValidationCheck[];
  summary: {
    errors: number;
    warnings: number;
    passed: number;
    total: number;
  };
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { optimization, minQualityScore = 75, minWordCount = 1500, targetKeyword }: ValidationRequest = await req.json();

    const checks: ValidationCheck[] = [];
    const recommendations: string[] = [];

    // ============================================================
    // TITLE VALIDATION
    // ============================================================
    const title = optimization.optimizedTitle || '';
    const titleLength = title.length;
    
    checks.push({
      name: 'Title Length',
      passed: titleLength >= 30 && titleLength <= 60,
      actual: titleLength,
      expected: '30-60 characters',
      severity: titleLength < 20 || titleLength > 70 ? 'error' : 'warning',
      recommendation: titleLength < 30 ? 'Add more descriptive words to title' : 
                     titleLength > 60 ? 'Shorten title to prevent truncation in SERPs' : undefined,
    });

    if (targetKeyword) {
      const hasKeywordInTitle = title.toLowerCase().includes(targetKeyword.toLowerCase());
      checks.push({
        name: 'Keyword in Title',
        passed: hasKeywordInTitle,
        actual: hasKeywordInTitle ? 'Present' : 'Missing',
        expected: 'Keyword should appear in title',
        severity: 'warning',
        recommendation: !hasKeywordInTitle ? `Add "${targetKeyword}" to the title` : undefined,
      });
    }

    // ============================================================
    // META DESCRIPTION VALIDATION
    // ============================================================
    const metaDesc = optimization.metaDescription || '';
    const metaLength = metaDesc.length;
    
    checks.push({
      name: 'Meta Description Length',
      passed: metaLength >= 120 && metaLength <= 160,
      actual: metaLength,
      expected: '120-160 characters',
      severity: metaLength < 100 || metaLength > 170 ? 'error' : 'warning',
    });

    const hasCTA = /\b(learn|discover|find out|get|start|try|see|read)\b/i.test(metaDesc);
    checks.push({
      name: 'Meta Description CTA',
      passed: hasCTA,
      actual: hasCTA ? 'Has CTA' : 'No CTA',
      expected: 'Should include call-to-action',
      severity: 'info',
    });

    // ============================================================
    // CONTENT VALIDATION
    // ============================================================
    const content = optimization.optimizedContent || '';
    const wordCount = optimization.contentStrategy?.wordCount || 
                     content.split(/\s+/).filter(Boolean).length;
    
    checks.push({
      name: 'Word Count',
      passed: wordCount >= minWordCount,
      actual: wordCount,
      expected: `${minWordCount}+ words`,
      severity: wordCount < minWordCount * 0.8 ? 'error' : 'warning',
      recommendation: wordCount < minWordCount ? 
        `Add ${minWordCount - wordCount} more words with valuable content` : undefined,
    });

    // H2 Count
    const h2Count = (content.match(/<h2/gi) || []).length + (optimization.h2s?.length || 0);
    checks.push({
      name: 'H2 Headers',
      passed: h2Count >= 5,
      actual: h2Count,
      expected: '5+ H2 headers',
      severity: h2Count < 3 ? 'error' : 'warning',
      recommendation: h2Count < 5 ? 'Add more H2 sections to improve structure' : undefined,
    });

    // ============================================================
    // CONTENT BLOCKS VALIDATION
    // ============================================================
    const hasTLDR = content.includes('wp-opt-tldr') || (optimization.tldrSummary?.length || 0) > 0;
    checks.push({
      name: 'TL;DR Summary',
      passed: hasTLDR,
      actual: hasTLDR ? 'Present' : 'Missing',
      expected: 'TL;DR summary box',
      severity: 'warning',
    });

    const hasTakeaways = content.includes('wp-opt-takeaways') || (optimization.keyTakeaways?.length || 0) >= 3;
    checks.push({
      name: 'Key Takeaways',
      passed: hasTakeaways,
      actual: hasTakeaways ? 'Present' : 'Missing',
      expected: 'Key takeaways section',
      severity: 'warning',
    });

    const hasTips = content.includes('wp-opt-tip') || content.includes('Pro Tip');
    checks.push({
      name: 'Pro Tips',
      passed: hasTips,
      actual: hasTips ? 'Present' : 'Missing',
      expected: 'At least 1 pro tip box',
      severity: 'info',
    });

    const hasComparison = content.includes('wp-opt-comparison') || content.includes('<table');
    checks.push({
      name: 'Comparison Table',
      passed: hasComparison,
      actual: hasComparison ? 'Present' : 'Missing',
      expected: 'Comparison or data table',
      severity: 'info',
    });

    // ============================================================
    // FAQ VALIDATION
    // ============================================================
    const faqCount = optimization.faqs?.length || 0;
    checks.push({
      name: 'FAQ Section',
      passed: faqCount >= 5,
      actual: faqCount,
      expected: '5-7 FAQs',
      severity: faqCount === 0 ? 'error' : faqCount < 5 ? 'warning' : 'info',
      recommendation: faqCount < 5 ? 'Add more FAQs for better PAA coverage' : undefined,
    });

    // ============================================================
    // INTERNAL LINKS VALIDATION
    // ============================================================
    const linkCount = optimization.internalLinks?.length || 
                     (content.match(/href=["'][^"']*["']/gi) || []).length;
    checks.push({
      name: 'Internal Links',
      passed: linkCount >= 10,
      actual: linkCount,
      expected: '10+ internal links',
      severity: linkCount < 5 ? 'error' : linkCount < 10 ? 'warning' : 'info',
      recommendation: linkCount < 10 ? 'Add more contextual internal links' : undefined,
    });

    // ============================================================
    // SCHEMA VALIDATION
    // ============================================================
    const hasSchema = optimization.schema && Object.keys(optimization.schema).length > 0;
    checks.push({
      name: 'Schema Markup',
      passed: hasSchema,
      actual: hasSchema ? 'Present' : 'Missing',
      expected: 'Article + FAQ Schema',
      severity: 'warning',
    });

    // ============================================================
    // QUALITY SCORE VALIDATION
    // ============================================================
    const qualityScore = optimization.qualityScore || 0;
    checks.push({
      name: 'Quality Score',
      passed: qualityScore >= minQualityScore,
      actual: qualityScore,
      expected: `${minQualityScore}+`,
      severity: qualityScore < minQualityScore - 20 ? 'error' : 
               qualityScore < minQualityScore ? 'warning' : 'info',
    });

    // ============================================================
    // HORMOZI STYLE VALIDATION
    // ============================================================
    const hormoziPatterns = [
      /here['']s the (truth|thing|reality)/i,
      /most people (think|believe|assume)/i,
      /let me (break|explain|show)/i,
      /the (math|numbers|data) (is|are|shows)/i,
      /stop doing .+ start doing/i,
      /\d+x (faster|better|more)/i,
      /\$[\d,]+/i,
      /\d+%/i,
    ];
    
    const hormoziMatches = hormoziPatterns.filter(p => p.test(content)).length;
    checks.push({
      name: 'Hormozi Style',
      passed: hormoziMatches >= 4,
      actual: `${hormoziMatches}/8 patterns`,
      expected: '4+ Hormozi patterns',
      severity: 'info',
      recommendation: hormoziMatches < 4 ? 
        'Add more Hormozi-style elements: specific numbers, bold claims, contrarian takes' : undefined,
    });

    // ============================================================
    // CALCULATE SUMMARY
    // ============================================================
    const errors = checks.filter(c => !c.passed && c.severity === 'error').length;
    const warnings = checks.filter(c => !c.passed && c.severity === 'warning').length;
    const passed = checks.filter(c => c.passed).length;

    // Calculate overall score
    const baseScore = (passed / checks.length) * 100;
    const errorPenalty = errors * 10;
    const warningPenalty = warnings * 3;
    const overallScore = Math.max(0, Math.min(100, Math.round(baseScore - errorPenalty - warningPenalty)));

    // Determine if can publish
    const canPublish = errors === 0 && overallScore >= 60;

    // Gather recommendations
    checks.forEach(check => {
      if (!check.passed && check.recommendation) {
        recommendations.push(check.recommendation);
      }
    });

    const result: ValidationResult = {
      success: true,
      canPublish,
      overallScore,
      checks,
      summary: {
        errors,
        warnings,
        passed,
        total: checks.length,
      },
      recommendations: recommendations.slice(0, 10),
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validate-content] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        canPublish: false,
        overallScore: 0,
        checks: [],
        summary: { errors: 1, warnings: 0, passed: 0, total: 0 },
        recommendations: ['Validation failed - please try again'],
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
