import { useMemo } from 'react';
import {
  TLDRBox,
  ExpertQuoteBox,
  KeyTakeawaysBox,
  YouTubeEmbed,
  PatentReferenceBox,
  FAQSection,
  CTABox,
} from './ContentBlocks';

export interface OptimizationResult {
  optimizedTitle: string;
  metaDescription: string;
  h1: string;
  h2s: string[];
  tldrSummary?: string[];
  expertQuote?: {
    quote: string;
    author: string;
    role: string;
    avatarUrl?: string | null;
  };
  youtubeEmbed?: {
    videoId?: string;
    searchQuery?: string;
    suggestedTitle?: string;
    context?: string;
  };
  patentReference?: {
    type: 'patent' | 'research' | 'study';
    identifier: string;
    title: string;
    summary: string;
    link?: string;
  };
  optimizedContent: string;
  faqs?: Array<{ question: string; answer: string }>;
  keyTakeaways?: string[];
  ctas?: Array<{ text: string; position: string; style: 'primary' | 'secondary' }>;
  tableOfContents?: string[];
  qualityScore?: number;
  seoScore?: number;
  readabilityScore?: number;
  engagementScore?: number;
}

interface OptimizedContentRendererProps {
  result: OptimizationResult;
  showRawHtml?: boolean;
  className?: string;
}

export function OptimizedContentRenderer({ 
  result, 
  showRawHtml = false,
  className 
}: OptimizedContentRendererProps) {
  // Find CTAs by position
  const ctaAfterIntro = result.ctas?.find(c => c.position === 'after-intro');
  const ctaMidContent = result.ctas?.find(c => c.position === 'mid-content');
  const ctaConclusion = result.ctas?.find(c => c.position === 'conclusion');

  // Split content into sections for CTA insertion
  const contentSections = useMemo(() => {
    if (!result.optimizedContent) return { intro: '', middle: '', conclusion: '' };
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.optimizedContent, 'text/html');
    const children = Array.from(doc.body.children);
    
    const totalElements = children.length;
    const introEnd = Math.floor(totalElements * 0.2);
    const middleEnd = Math.floor(totalElements * 0.6);
    
    return {
      intro: children.slice(0, introEnd).map(el => el.outerHTML).join(''),
      middle: children.slice(introEnd, middleEnd).map(el => el.outerHTML).join(''),
      conclusion: children.slice(middleEnd).map(el => el.outerHTML).join(''),
    };
  }, [result.optimizedContent]);

  if (showRawHtml) {
    return (
      <div 
        className={className}
        dangerouslySetInnerHTML={{ __html: result.optimizedContent }} 
      />
    );
  }

  return (
    <article className={className}>
      {/* TL;DR Summary - Always at top */}
      {result.tldrSummary && result.tldrSummary.length > 0 && (
        <TLDRBox points={result.tldrSummary} />
      )}

      {/* Table of Contents */}
      {result.tableOfContents && result.tableOfContents.length > 0 && (
        <nav className="my-6 p-4 bg-muted/30 rounded-xl border border-border/50">
          <h2 className="font-bold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
            Table of Contents
          </h2>
          <ul className="space-y-2">
            {result.tableOfContents.map((item, i) => (
              <li key={i}>
                <a 
                  href={`#section-${i}`} 
                  className="text-primary hover:underline text-sm"
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Intro Content */}
      <div 
        className="prose prose-lg dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: contentSections.intro }} 
      />

      {/* CTA after intro */}
      {ctaAfterIntro && (
        <CTABox text={ctaAfterIntro.text} style={ctaAfterIntro.style} />
      )}

      {/* Expert Quote - After intro */}
      {result.expertQuote && (
        <ExpertQuoteBox {...result.expertQuote} />
      )}

      {/* Middle Content */}
      <div 
        className="prose prose-lg dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: contentSections.middle }} 
      />

      {/* YouTube Embed - Mid content */}
      {result.youtubeEmbed && (
        <YouTubeEmbed {...result.youtubeEmbed} />
      )}

      {/* CTA mid content */}
      {ctaMidContent && (
        <CTABox text={ctaMidContent.text} style={ctaMidContent.style} />
      )}

      {/* Patent/Research Reference */}
      {result.patentReference && (
        <PatentReferenceBox {...result.patentReference} />
      )}

      {/* Conclusion Content */}
      <div 
        className="prose prose-lg dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: contentSections.conclusion }} 
      />

      {/* Key Takeaways - Before FAQ */}
      {result.keyTakeaways && result.keyTakeaways.length > 0 && (
        <KeyTakeawaysBox takeaways={result.keyTakeaways} />
      )}

      {/* FAQ Section */}
      {result.faqs && result.faqs.length > 0 && (
        <FAQSection faqs={result.faqs} />
      )}

      {/* CTA at conclusion */}
      {ctaConclusion && (
        <CTABox text={ctaConclusion.text} style={ctaConclusion.style} />
      )}

      {/* Quality Scores Footer */}
      {(result.qualityScore || result.seoScore) && (
        <div className="mt-8 p-4 bg-muted/20 rounded-xl border border-border/30">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            Content Quality Scores
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {result.qualityScore && (
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{result.qualityScore}</div>
                <div className="text-xs text-muted-foreground">Quality</div>
              </div>
            )}
            {result.seoScore && (
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-500">{result.seoScore}</div>
                <div className="text-xs text-muted-foreground">SEO</div>
              </div>
            )}
            {result.readabilityScore && (
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{result.readabilityScore}</div>
                <div className="text-xs text-muted-foreground">Readability</div>
              </div>
            )}
            {result.engagementScore && (
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-500">{result.engagementScore}</div>
                <div className="text-xs text-muted-foreground">Engagement</div>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

