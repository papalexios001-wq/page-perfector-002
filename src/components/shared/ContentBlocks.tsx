import { motion } from 'framer-motion';
import { Lightbulb, Quote, FileText, Youtube, BookOpen, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TLDRBoxProps {
  points: string[];
}

export function TLDRBox({ points }: TLDRBoxProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative my-8 p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/20 overflow-hidden"
    >
      {/* Glow effect */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
      
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/20">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-primary">TL;DR — The Bottom Line</h3>
        </div>
        <ul className="space-y-2">
          {points.map((point, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3 text-foreground/90"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{point}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

interface ExpertQuoteProps {
  quote: string;
  author: string;
  role: string;
  avatarUrl?: string;
}

export function ExpertQuoteBox({ quote, author, role, avatarUrl }: ExpertQuoteProps) {
  return (
    <motion.blockquote
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative my-8 p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20"
    >
      <Quote className="absolute top-4 left-4 w-8 h-8 text-amber-500/30" />
      <div className="pl-8">
        <p className="text-lg italic text-foreground/90 leading-relaxed mb-4">
          "{quote}"
        </p>
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt={author} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-amber-600 font-bold">{author[0]}</span>
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

interface KeyTakeawaysProps {
  takeaways: string[];
}

export function KeyTakeawaysBox({ takeaways }: KeyTakeawaysProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-8 p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border border-emerald-500/20"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-emerald-500/20">
          <Lightbulb className="w-5 h-5 text-emerald-500" />
        </div>
        <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Key Takeaways</h3>
      </div>
      <div className="grid gap-3">
        {takeaways.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center justify-center">
              ✓
            </div>
            <span className="text-foreground/90">{item}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
}

export function YouTubeEmbed({ videoId, title }: YouTubeEmbedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-8 rounded-2xl overflow-hidden border border-border/50 shadow-lg"
    >
      <div className="bg-gradient-to-r from-red-500/10 to-red-600/5 p-4 flex items-center gap-3 border-b border-border/50">
        <Youtube className="w-6 h-6 text-red-500" />
        <span className="font-semibold">{title || 'Related Video'}</span>
      </div>
      <div className="aspect-video">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title || 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    </motion.div>
  );
}

interface PatentReferenceProps {
  patentNumber: string;
  title: string;
  abstract: string;
  link?: string;
}

export function PatentReferenceBox({ patentNumber, title, abstract, link }: PatentReferenceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-8 p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/20"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-blue-500/20">
          <BookOpen className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">Research Reference</h3>
          <p className="text-xs text-muted-foreground font-mono">{patentNumber}</p>
        </div>
      </div>
      <h4 className="font-semibold text-foreground mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{abstract}</p>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-500 hover:underline"
        >
          View Full Patent →
        </a>
      )}
    </motion.div>
  );
}

