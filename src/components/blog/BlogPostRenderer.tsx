import React from 'react';
import {
  TLDRBox,
  KeyTakeawaysBox,
  QuoteBox,
  CTABox,
  VideoEmbedBox,
  SummaryBox,
  PatentSearchBox,
  ChartBox,
  TableBox,
} from './BlogPostComponents';
import { BlogSection } from '@/lib/ai/blogGenerator';

interface BlogPostRendererProps {
  sections: BlogSection[];
  title: string;
}

export function BlogPostRenderer({ sections, title }: BlogPostRendererProps) {
  const renderSection = (section: BlogSection, index: number) => {
    switch (section.type) {
      case 'tldr':
        return <TLDRBox key={index} content={section.content} />;
      
      case 'takeaways':
        return <KeyTakeawaysBox key={index} items={section.items || []} />;
      
      case 'intro':
        return (
          <div key={index} className="prose max-w-none">
            <p>{section.content}</p>
          </div>
        );
      
      case 'content':
        return (
          <div key={index} className="prose max-w-none">
            <h2>{section.content}</h2>
            {section.subsections?.map((sub, subIndex) => (
              <div key={subIndex}>
                <p>{sub}</p>
              </div>
            ))}
          </div>
        );
      
      case 'quote':
        return (
          <QuoteBox
            key={index}
            text={section.text || ''}
            author={section.author || ''}
          />
        );
      
      case 'cta':
        return (
          <CTABox
            key={index}
            title={section.title || 'Take Action'}
            description={section.description || ''}
            buttonText={section.buttonText || 'Get Started'}
          />
        );
      
      case 'video':
        return (
          <VideoEmbedBox
            key={index}
            url={section.url || ''}
            title={section.title || 'Video'}
          />
        );
      
      case 'summary':
        return <SummaryBox key={index} content={section.content} />;
      
      case 'table':
        return (
          <TableBox
            key={index}
            headers={section.headers || []}
            rows={section.rows || []}
          />
        );
      
      default:
        return (
          <div key={index} className="prose max-w-none">
            <p>{section.content}</p>
          </div>
        );
    }
  };

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">{title}</h1>
      <div className="space-y-6">
        {sections.map((section, index) => renderSection(section, index))}
      </div>
    </article>
  );
}
