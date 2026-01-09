import { motion } from 'framer-motion';
import { 
  Lightbulb, 
  Quote, 
  Youtube, 
  BookOpen, 
  Sparkles, 
  CheckCircle2,
  ExternalLink,
  Play,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// ============================================================
// TYPE DEFINITIONS
// ============================================================
export interface TLDRSummaryData {
  points: string[];
}

export interface ExpertQuoteData {
  quote: string;
  author: string;
  role: string;
  avatarUrl?: string | null;
}

export interface YouTubeEmbedData {
  videoId?: string;
  searchQuery?: string;
  suggestedTitle?: string;
  context?: string;
}

export interface PatentReferenceData {
  type: 'patent' | 'research' | 'study';
  identifier: string;
  title: string;
  summary: string;
  link?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface CTAData {
  text: string;
  position: 'after-intro' | 'mid-content' | 'conclusion';
  style: 'primary' | 'secondary';
}

export interface KeyTakeawaysData {
  takeaways: string[];
}

// ============================================================
// TL;DR SUMMARY BOX
// ============================================================
interface TLDRBoxProps {
  points: string[];
  className?: string;
}

export function TLDRBox({ points, className }: TLDRBoxProps) {
  if (!points?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative my-8 p-6 rounded-2xl",
        "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
        "border-2 border-primary/20 overflow-hidden",
        "shadow-lg shadow-primary/5",
        className
      )}
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-primary/20 ring-2 ring-primary/30">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-primary">TL;DR — The Bottom Line</h3>
            <p className="text-xs text-muted-foreground">What you need to know in 30 seconds</p>
          </div>
        </div>
        
        <ul className="space-y-3">
          {points.map((point, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3"
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center mt-0.5 ring-1 ring-primary/30">
                {i + 1}
              </span>
              <span className="text-foreground/90 leading-relaxed">{point}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

// ============================================================
// EXPERT QUOTE BOX
// ============================================================
interface ExpertQuoteBoxProps extends ExpertQuoteData {
  className?: string;
}

export function ExpertQuoteBox({ quote, author, role, avatarUrl, className }: ExpertQuoteBoxProps) {
  if (!quote) return null;

  return (
    <motion.blockquote
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative my-8 p-6 rounded-2xl",
        "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent",
        "border border-amber-500/20",
        "shadow-lg shadow-amber-500/5",
        className
      )}
    >
      <Quote className="absolute top-4 left-4 w-10 h-10 text-amber-500/20" />
      
      <div className="pl-10 pt-2">
        <p className="text-lg italic text-foreground/90 leading-relaxed mb-5">
          "{quote}"
        </p>
        
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={author} 
              className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-500/30" 
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center ring-2 ring-amber-500/30">
              <span className="text-amber-600 dark:text-amber-400 font-bold text-lg">
                {author?.charAt(0)?.toUpperCase() || 'E'}
              </span>
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground">{author}</p>
            <p className="text-sm text-muted-foreground">{role}</p>
          </div>
        </div>
      </div>
    </motion.blockquote>
  );
}

// ============================================================
// KEY TAKEAWAYS BOX
// ============================================================
interface KeyTakeawaysBoxProps {
  takeaways: string[];
  className?: string;
}

export function KeyTakeawaysBox({ takeaways, className }: KeyTakeawaysBoxProps) {
  if (!takeaways?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "my-8 p-6 rounded-2xl",
        "bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent",
        "border border-emerald-500/20",
        "shadow-lg shadow-emerald-500/5",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 rounded-xl bg-emerald-500/20 ring-2 ring-emerald-500/30">
          <Lightbulb className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Key Takeaways</h3>
          <p className="text-xs text-muted-foreground">Action items you can implement today</p>
        </div>
      </div>
      
      <div className="grid gap-3">
        {takeaways.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <span className="text-foreground/90 leading-relaxed">{item}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// YOUTUBE EMBED BOX
// ============================================================
interface YouTubeEmbedProps extends YouTubeEmbedData {
  className?: string;
}

export function YouTubeEmbed({ videoId, searchQuery, suggestedTitle, context, className }: YouTubeEmbedProps) {
  if (videoId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "my-8 rounded-2xl overflow-hidden",
          "border border-border/50",
          "shadow-xl shadow-black/10",
          className
        )}
      >
        <div className="bg-gradient-to-r from-red-500/10 to-red-600/5 p-4 flex items-center gap-3 border-b border-border/50">
          <div className="p-2 rounded-lg bg-red-500/20">
            <Youtube className="w-5 h-5 text-red-500" />
          </div>
          <span className="font-semibold">{suggestedTitle || 'Related Video'}</span>
        </div>
        <div className="aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={suggestedTitle || 'YouTube video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </motion.div>
    );
  }

  if (searchQuery) {
    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "my-8 p-6 rounded-2xl",
          "bg-gradient-to-br from-red-500/10 via-red-600/5 to-transparent",
          "border border-red-500/20",
          "shadow-lg shadow-red-500/5",
          className
        )}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-red-500/20 ring-2 ring-red-500/30">
            <Play className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1">
              Recommended Video
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {context || 'Watch a related video for more insights'}
            </p>
            <p className="text-sm text-foreground/80 mb-4">
              <strong>Suggested search:</strong> "{searchQuery}"
            </p>
            <a
              href={youtubeSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
            >
              <Youtube className="w-4 h-4" />
              Find on YouTube
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}

// ============================================================
// PATENT/RESEARCH REFERENCE BOX
// ============================================================
interface PatentReferenceBoxProps extends PatentReferenceData {
  className?: string;
}

export function PatentReferenceBox({ type, identifier, title, summary, link, className }: PatentReferenceBoxProps) {
  if (!title) return null;

  const typeConfig = {
    patent: {
      label: 'Patent Reference',
      bgClass: 'from-blue-500/10 via-indigo-500/5',
      borderClass: 'border-blue-500/20',
      textClass: 'text-blue-600 dark:text-blue-400',
      iconBgClass: 'bg-blue-500/20 ring-blue-500/30',
      iconClass: 'text-blue-500',
    },
    research: {
      label: 'Research Paper',
      bgClass: 'from-purple-500/10 via-violet-500/5',
      borderClass: 'border-purple-500/20',
      textClass: 'text-purple-600 dark:text-purple-400',
      iconBgClass: 'bg-purple-500/20 ring-purple-500/30',
      iconClass: 'text-purple-500',
    },
    study: {
      label: 'Academic Study',
      bgClass: 'from-cyan-500/10 via-teal-500/5',
      borderClass: 'border-cyan-500/20',
      textClass: 'text-cyan-600 dark:text-cyan-400',
      iconBgClass: 'bg-cyan-500/20 ring-cyan-500/30',
      iconClass: 'text-cyan-500',
    },
  };

  const config = typeConfig[type] || typeConfig.research;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "my-8 p-6 rounded-2xl",
        `bg-gradient-to-br ${config.bgClass} to-transparent`,
        config.borderClass,
        "border shadow-lg",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("p-3 rounded-xl ring-2", config.iconBgClass)}>
          <BookOpen className={cn("w-6 h-6", config.iconClass)} />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={cn("text-lg font-bold", config.textClass)}>
              {config.label}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground font-mono mb-2">{identifier}</p>
          <h4 className="font-semibold text-foreground mb-2">{title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{summary}</p>
          
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-2 text-sm font-medium hover:underline",
                config.textClass
              )}
            >
              View Full {type === 'patent' ? 'Patent' : 'Paper'}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// FAQ SECTION
// ============================================================
interface FAQSectionProps {
  faqs: FAQItem[];
  className?: string;
}

export function FAQSection({ faqs, className }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!faqs?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("my-8", className)}
    >
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <span className="p-2 rounded-lg bg-primary/10 text-xl">❓</span>
        Frequently Asked Questions
      </h2>
      
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
            >
              <span className="font-semibold pr-4">{faq.question}</span>
              <ChevronDown 
                className={cn(
                  "w-5 h-5 text-primary shrink-0 transition-transform duration-200",
                  openIndex === i && "rotate-180"
                )} 
              />
            </button>
            {openIndex === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-4 pb-4"
              >
                <p className="text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
                  {faq.answer}
                </p>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// CTA BOX
// ============================================================
interface CTABoxProps {
  text: string;
  style?: 'primary' | 'secondary';
  onClick?: () => void;
  href?: string;
  className?: string;
}

export function CTABox({ text, style = 'primary', onClick, href, className }: CTABoxProps) {
  const baseClasses = cn(
    "my-6 p-6 rounded-2xl text-center",
    "transition-all duration-300 hover:scale-[1.02]",
    style === 'primary' 
      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25"
      : "bg-muted/50 border border-border text-foreground",
    className
  );

  const content = (
    <div className={baseClasses}>
      <p className="text-lg font-bold mb-3">{text}</p>
      <button className={cn(
        "px-6 py-2.5 rounded-lg font-semibold transition-colors",
        style === 'primary'
          ? "bg-white text-primary hover:bg-white/90"
          : "bg-primary text-primary-foreground hover:bg-primary/90"
      )}>
        Get Started →
      </button>
    </div>
  );

  if (href) {
    return <a href={href} className="block">{content}</a>;
  }

  return <div onClick={onClick} className="cursor-pointer">{content}</div>;
}
