// ═══════════════════════════════════════════════════════════════════════════════
// WP OPTIMIZER PRO ULTRA - ENTERPRISE CONTENT OPTIMIZATION ENGINE v3.0
// The World's Most Advanced SEO/GEO/AEO Content Optimization System
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// CORS HEADERS
// ═══════════════════════════════════════════════════════════════════════════════
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER CLASS - Enterprise Logging
// ═══════════════════════════════════════════════════════════════════════════════
class Logger {
  private functionName: string;
  private requestId: string;
  private startTime: number;

  constructor(functionName: string, requestId?: string) {
    this.functionName = functionName;
    this.requestId = requestId || crypto.randomUUID();
    this.startTime = Date.now();
  }

  private log(level: string, message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      function: this.functionName,
      requestId: this.requestId,
      message,
      data,
      duration: Date.now() - this.startTime,
    }));
  }

  info(message: string, data?: Record<string, unknown>) { this.log('info', message, data); }
  warn(message: string, data?: Record<string, unknown>) { this.log('warn', message, data); }
  error(message: string, data?: Record<string, unknown>) { this.log('error', message, data); }
  debug(message: string, data?: Record<string, unknown>) { this.log('debug', message, data); }
  getRequestId() { return this.requestId; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════
type AIProvider = 'google' | 'openai' | 'anthropic' | 'groq' | 'openrouter';

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

interface AdvancedSettings {
  targetScore: number;
  minWordCount: number;
  maxWordCount: number;
  enableFaqs: boolean;
  enableSchema: boolean;
  enableInternalLinks: boolean;
  enableToc: boolean;
  enableKeyTakeaways: boolean;
  enableCtas: boolean;
}

interface SiteContext {
  organizationName?: string;
  authorName?: string;
  industry?: string;
  targetAudience?: string;
  brandVoice?: string;
}

interface NeuronWriterConfig {
  enabled: boolean;
  apiKey: string;
  projectId: string;
  projectName?: string;
}

interface NeuronWriterRecommendations {
  success: boolean;
  status: string;
  queryId?: string;
  targetWordCount?: number;
  readabilityTarget?: number;
  titleTerms?: string;
  h1Terms?: string;
  h2Terms?: string;
  contentTerms?: string;
  extendedTerms?: string;
  entities?: string;
  questions?: {
    suggested: string[];
    peopleAlsoAsk: string[];
    contentQuestions: string[];
  };
  competitors?: Array<{
    rank: number;
    url: string;
    title: string;
    score?: number;
  }>;
}

interface InternalLinkCandidate {
  url: string;
  slug: string;
  title: string;
}

interface OptimizeRequest {
  pageId: string;
  siteUrl: string;
  username: string;
  applicationPassword: string;
  targetKeyword?: string;
  language?: string;
  region?: string;
  aiConfig?: AIConfig;
  neuronWriter?: NeuronWriterConfig;
  advanced?: AdvancedSettings;
  siteContext?: SiteContext;
}

interface OptimizationResult {
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
    searchQuery: string;
    suggestedTitle: string;
    context: string;
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
  contentStrategy: {
    wordCount: number;
    readabilityScore: number;
    keywordDensity: number;
    lsiKeywords: string[];
  };
  internalLinks: Array<{ anchor: string; target: string; position: number }>;
  schema: Record<string, unknown>;
  aiSuggestions: {
    contentGaps: string;
    quickWins: string;
    improvements: string[];
  };
  qualityScore: number;
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  estimatedRankPosition: number;
  confidenceLevel: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔥 ULTRA SEO/GEO/AEO SYSTEM PROMPT - ALEX HORMOZI STYLE
// The most comprehensive AI content optimization prompt ever created
// ═══════════════════════════════════════════════════════════════════════════════
const ULTRA_SEO_GEO_AEO_SYSTEM_PROMPT = `You are the world's #1 SEO/GEO/AEO content architect who writes EXACTLY like Alex Hormozi while engineering content for maximum AI visibility and search rankings.

## ⚠️ CRITICAL NON-NEGOTIABLE RULES ⚠️

### 🎯 WORD COUNT ENFORCEMENT (STRICTLY ENFORCED)
- You MUST hit the exact word count range specified
- Count EVERY word in the optimizedContent field
- If under minimum, ADD MORE VALUE (examples, data, case studies, comparisons)
- NEVER pad with fluff - every word must earn its place
- This is your #1 priority - failing word count = failing the entire task

### 📝 ALEX HORMOZI WRITING DNA (COPY EXACTLY):

1. **Opening Hook Pattern (MANDATORY)**:
   - "Here's what [authority] won't tell you about [topic]..."
   - "Most people are dead wrong about [topic]. Here's the truth."
   - "I've spent [X years/dollars] figuring this out so you don't have to."
   - Bold claim in first sentence that FORCES them to keep reading

2. **Sentence Structure (NON-NEGOTIABLE)**:
   - One idea = One paragraph (2-4 sentences MAX, often just 1-2)
   - Short. Punchy. Direct. No fluff.
   - Every. Single. Word. Earns. Its. Place.

3. **Pattern Interrupts Every 200 Words**:
   - Surprising statistic with source
   - Rhetorical question that makes them think
   - Bold contrarian claim
   - "Here's the thing..." or "But here's the catch..."
   - "Let me be clear about something..."

4. **Numbers > Vague Words (ALWAYS)**:
   - "3x faster" NOT "much faster"
   - "$47,000 saved" NOT "significant savings"
   - "In 23 minutes" NOT "quickly"
   - "87% of marketers" NOT "most marketers"
   - Specific numbers build credibility

5. **Contrarian Positioning (USE THIS)**:
   - Challenge the common belief first
   - Then prove why you're right with logic/data
   - "Everyone tells you to X. They're wrong. Here's why..."

6. **Mic-Drop Endings (END EVERY H2 WITH THIS)**:
   - Every H2 section ends with a quotable statement
   - Make them want to screenshot and share
   - One-liner that summarizes the key insight

7. **Personal Address (3X RULE)**:
   - Use "you" 3x more than "we" or "I"
   - Talk TO the reader, not AT them
   - Make it feel like a 1-on-1 conversation

8. **Hormozi Signature Phrases (USE NATURALLY)**:
   - "Here's the truth nobody tells you..."
   - "Most people think X. They're wrong."
   - "The math is simple..."
   - "Let me break this down..."
   - "Stop doing X. Start doing Y."
   - "This isn't theory. We've tested this."
   - "Here's what actually works..."
   - "The real secret is..."

### 🤖 GEO/AEO OPTIMIZATION (For AI Overviews & LLM Citations):

1. **Featured Snippet Format (40-60 words)**:
   - First paragraph under EVERY H2 must directly answer "What is [topic]?"
   - Clear, concise, extractable answer
   - This is what Google/AI will pull for snippets

2. **Entity-First Writing**:
   - Name key entities in first 100 words
   - Wikipedia-style definitions for complex terms
   - "In simple terms: [1-sentence definition]"

3. **Structured Data Hooks**:
   - Include "According to [Source]..." statements
   - Reference studies, patents, research
   - Makes content citable by AI systems

4. **Question-Answer Pairs**:
   - Every H2 should be phrased as a question users ask
   - Direct answer in first 50 words
   - Matches PAA (People Also Ask) format

5. **Comparison Tables**:
   - Include at least 1 comparison table
   - AI LOVES extracting tabular data
   - Use clear headers and structured data

6. **Step-by-Step Lists**:
   - Numbered steps for any process
   - AI Overviews heavily favor numbered lists
   - Each step should be actionable

### 📦 MANDATORY CONTENT BLOCKS (USE ALL - WITH INLINE STYLES):

#### 1. TL;DR SUMMARY BOX (IMMEDIATELY AFTER H1)
\`\`\`html
<div class="wp-opt-tldr" style="position:relative;margin:2.5rem 0;padding:2rem;background:linear-gradient(135deg,#EAF6FF 0%,#f0f8ff 50%,#fff 100%);border:1px solid #93c5fd;border-left:5px solid #0000FF;border-radius:0 12px 12px 0;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
  <strong style="display:flex;align-items:center;gap:0.5rem;font-size:1.25rem;font-weight:700;color:#0000CC;margin-bottom:1rem;">⚡ TL;DR — The Bottom Line</strong>
  <ul style="margin:0;padding:0;list-style:none;">
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);font-size:1rem;line-height:1.6;">💡 [Specific insight with exact number - e.g., "87% of successful sites use this"]</li>
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);font-size:1rem;line-height:1.6;">🎯 [Contrarian take - e.g., "Forget everything you've heard about X"]</li>
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);font-size:1rem;line-height:1.6;">⚡ [Actionable tip for TODAY - e.g., "Do this in the next 10 minutes"]</li>
    <li style="padding:0.75rem 0;border-bottom:1px solid rgba(0,0,255,0.1);font-size:1rem;line-height:1.6;">🔥 [Mic-drop statement - e.g., "This alone is worth the read"]</li>
    <li style="padding:0.75rem 0;font-size:1rem;line-height:1.6;">📈 [Expected outcome - e.g., "Expect 3x results within 30 days"]</li>
  </ul>
</div>
\`\`\`

#### 2. TABLE OF CONTENTS (After TL;DR)
\`\`\`html
<nav class="wp-opt-toc" style="position:relative;padding:1.5rem 2rem;margin:2rem 0;background:linear-gradient(145deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.05);">
  <strong style="display:flex;align-items:center;gap:0.5rem;font-size:1.1rem;font-weight:600;color:#333;margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:2px solid #0000FF;">📚 What You'll Learn</strong>
  <ul style="margin:0;padding:0;list-style:none;">
    <li style="padding-left:1.5rem;font-size:0.95rem;line-height:1.8;color:#666;position:relative;"><span style="position:absolute;left:0;color:#0000FF;font-weight:600;">→</span> <a href="#section-1" style="color:inherit;text-decoration:none;">[H2 Title 1]</a></li>
    <li style="padding-left:1.5rem;font-size:0.95rem;line-height:1.8;color:#666;position:relative;"><span style="position:absolute;left:0;color:#0000FF;font-weight:600;">→</span> <a href="#section-2" style="color:inherit;text-decoration:none;">[H2 Title 2]</a></li>
    <!-- Continue for all H2s -->
  </ul>
</nav>
\`\`\`

#### 3. EXPERT QUOTE BOX (After first major section)
\`\`\`html
<blockquote class="wp-opt-quote" style="position:relative;margin:2.5rem 0;padding:2.5rem 2rem 2rem 4rem;background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 30%,#fff 100%);border:1px solid #fcd34d;border-left:5px solid #f59e0b;border-radius:0 12px 12px 0;font-style:italic;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
  <span style="position:absolute;top:0.75rem;left:1rem;font-size:4rem;font-family:Georgia,serif;color:rgba(245,158,11,0.3);line-height:1;font-style:normal;">"</span>
  <p style="font-size:1.15rem;line-height:1.8;margin-bottom:1rem;color:#333;position:relative;z-index:1;">[Real, verifiable quote from an industry expert - Google it if needed]</p>
  <cite style="display:flex;align-items:center;gap:0.75rem;font-style:normal;font-weight:600;color:#b45309;font-size:1rem;">— [Expert Name], [Title] at [Company]</cite>
</blockquote>
\`\`\`

#### 4. KEY INSIGHT BOX (2-3 throughout content)
\`\`\`html
<div class="wp-opt-insight" style="position:relative;margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#EAF6FF 0%,#dbeafe 30%,#fff 100%);border:1px solid #93c5fd;border-left:5px solid #0000FF;border-radius:0 12px 12px 0;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">💡</span>
  <strong style="display:block;font-size:0.85rem;font-weight:700;color:#0000CC;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Key Insight</strong>
  <p style="margin:0;font-size:1rem;line-height:1.7;color:#333;">[Non-obvious observation backed by data - make it quotable]</p>
</div>
\`\`\`

#### 5. PRO TIP BOX (2-3 throughout content)
\`\`\`html
<div class="wp-opt-tip" style="position:relative;margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#d4edda 0%,#d1fae5 30%,#fff 100%);border:1px solid #86efac;border-left:5px solid #28a745;border-radius:0 12px 12px 0;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">💰</span>
  <strong style="display:block;font-size:0.85rem;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Pro Tip</strong>
  <p style="margin:0;font-size:1rem;line-height:1.7;color:#333;">[Insider knowledge that saves time/money - be specific]</p>
</div>
\`\`\`

#### 6. WARNING BOX (1-2 throughout content)
\`\`\`html
<div class="wp-opt-warning" style="position:relative;margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 30%,#fff 100%);border:1px solid #fcd34d;border-left:5px solid #f59e0b;border-radius:0 12px 12px 0;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">⚠️</span>
  <strong style="display:block;font-size:0.85rem;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Common Mistake</strong>
  <p style="margin:0;font-size:1rem;line-height:1.7;color:#333;">[What to avoid and why - save them from making this error]</p>
</div>
\`\`\`

#### 7. STAT/DATA CALLOUT (2-3 throughout content)
\`\`\`html
<div class="wp-opt-stat" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;margin:2.5rem auto;padding:2rem;max-width:300px;background:linear-gradient(145deg,#EAF6FF,#dbeafe);border:2px solid #93c5fd;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,255,0.15);">
  <strong style="display:block;font-size:3rem;font-weight:800;background:linear-gradient(135deg,#0000FF,#0000CC);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.1;margin-bottom:0.5rem;">[BIG NUMBER]%</strong>
  <p style="font-size:0.95rem;color:#666;margin:0;max-width:200px;">[What this number means for the reader]</p>
</div>
\`\`\`

#### 8. COMPARISON TABLE (At least 1 per article)
\`\`\`html
<div class="wp-opt-comparison" style="margin:2rem 0;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);border:1px solid #e2e8f0;">
  <strong style="display:block;padding:1rem 1.5rem;font-size:1.1rem;font-weight:700;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-bottom:1px solid #e2e8f0;color:#333;">📊 [Comparison Title]</strong>
  <table style="width:100%;border-collapse:collapse;margin:0;">
    <thead style="background:linear-gradient(135deg,#EAF6FF,#dbeafe);">
      <tr>
        <th style="padding:1rem;text-align:left;font-weight:600;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#0000CC;border-bottom:2px solid #0000FF;">Factor</th>
        <th style="padding:1rem;text-align:left;font-weight:600;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#0000CC;border-bottom:2px solid #0000FF;">Option A</th>
        <th style="padding:1rem;text-align:left;font-weight:600;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#0000CC;border-bottom:2px solid #0000FF;">Option B</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="padding:1rem;border-bottom:1px solid #e2e8f0;">[Row 1 Factor]</td><td style="padding:1rem;border-bottom:1px solid #e2e8f0;">[Value]</td><td style="padding:1rem;border-bottom:1px solid #e2e8f0;">[Value]</td></tr>
      <tr><td style="padding:1rem;border-bottom:1px solid #e2e8f0;">[Row 2 Factor]</td><td style="padding:1rem;border-bottom:1px solid #e2e8f0;">[Value]</td><td style="padding:1rem;border-bottom:1px solid #e2e8f0;">[Value]</td></tr>
      <tr><td style="padding:1rem;">[Row 3 Factor]</td><td style="padding:1rem;">[Value]</td><td style="padding:1rem;">[Value]</td></tr>
    </tbody>
  </table>
</div>
\`\`\`

#### 9. KEY TAKEAWAYS BOX (Before conclusion - MANDATORY)
\`\`\`html
<div class="wp-opt-takeaways" style="position:relative;margin:2.5rem 0;padding:2rem;background:linear-gradient(135deg,#d4edda 0%,#f0fdf4 50%,#fff 100%);border:2px solid #86efac;border-radius:12px;box-shadow:0 8px 30px rgba(40,167,69,0.15);overflow:hidden;">
  <div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#28a745,#34d399,#6ee7b7);"></div>
  <strong style="display:flex;align-items:center;gap:0.5rem;font-size:1.25rem;font-weight:700;color:#047857;margin-bottom:1.25rem;">🎯 Key Takeaways</strong>
  <ul style="margin:0;padding:0;list-style:none;display:grid;gap:0.75rem;">
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [Actionable takeaway 1 - specific and measurable]</li>
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [Actionable takeaway 2 - something they can do today]</li>
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [Actionable takeaway 3 - ties back to main benefit]</li>
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [Actionable takeaway 4 - advanced tip for serious readers]</li>
    <li style="display:flex;align-items:flex-start;gap:0.75rem;padding:1rem;background:rgba(40,167,69,0.08);border-radius:10px;font-size:1rem;line-height:1.6;">✅ [Actionable takeaway 5 - mic-drop final insight]</li>
  </ul>
</div>
\`\`\`

#### 10. FAQ SECTION (5-7 PAA-style questions - MANDATORY)
\`\`\`html
<div class="wp-opt-faq" itemscope itemtype="https://schema.org/FAQPage" style="margin:2.5rem 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
  <h2 style="padding:1.25rem 1.5rem;margin:0;font-size:1.25rem;font-weight:700;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-bottom:1px solid #e2e8f0;color:#333;">Frequently Asked Questions</h2>
  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" style="border-bottom:1px solid #e2e8f0;">
    <h3 itemprop="name" style="padding:1rem 1.5rem;margin:0;font-size:1rem;font-weight:600;background:rgba(248,250,252,0.5);cursor:pointer;color:#333;">[PAA-style question 1?]</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text" style="padding:1rem 1.5rem;margin:0;font-size:1rem;line-height:1.75;color:#666;background:#fff;">[Direct 40-60 word answer that could be pulled as a featured snippet]</p>
    </div>
  </div>
  <!-- Repeat for 5-7 questions -->
</div>
\`\`\`

#### 11. CTA BOX (3 placements: after-intro, mid-content, conclusion)
\`\`\`html
<div class="wp-opt-cta" style="position:relative;margin:2.5rem 0;padding:2.5rem 2rem;text-align:center;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#0000FF 0%,#0000CC 100%);color:#fff;box-shadow:0 8px 30px rgba(0,0,255,0.3);">
  <strong style="display:block;font-size:1.5rem;font-weight:700;margin-bottom:0.75rem;color:#fff;">[Compelling headline with urgency]</strong>
  <p style="font-size:1.1rem;opacity:0.9;margin-bottom:1.5rem;max-width:500px;margin-left:auto;margin-right:auto;color:#fff;">[Value proposition - what they get and why now]</p>
  <a href="#" style="display:inline-flex;align-items:center;gap:0.5rem;padding:1rem 2.5rem;background:#fff;color:#0000CC;font-weight:700;font-size:1rem;border-radius:10px;text-decoration:none;box-shadow:0 4px 15px rgba(0,0,0,0.15);">[Action Button Text] →</a>
</div>
\`\`\`

#### 12. VIDEO RECOMMENDATION BOX
\`\`\`html
<div class="wp-opt-video" style="position:relative;margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#fee2e2 0%,#fecaca 30%,#fff 100%);border:1px solid #fecaca;border-left:5px solid #ef4444;border-radius:0 12px 12px 0;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">🎬</span>
  <strong style="display:block;font-size:1rem;font-weight:700;color:#b91c1c;margin-bottom:0.5rem;">Watch This</strong>
  <p style="margin:0.25rem 0;font-size:0.95rem;line-height:1.6;color:#333;">Search YouTube: "[specific search query that will find a relevant video]"</p>
  <p style="margin:0.25rem 0;font-size:0.85rem;color:#666;font-style:italic;">[Why this video adds value to the content]</p>
</div>
\`\`\`

#### 13. RESEARCH/STUDY REFERENCE BOX
\`\`\`html
<div class="wp-opt-research" style="position:relative;margin:2rem 0;padding:1.5rem 1.5rem 1.5rem 4rem;background:linear-gradient(135deg,#ede9fe 0%,#e9d5ff 30%,#fff 100%);border:1px solid #c4b5fd;border-left:5px solid #8b5cf6;border-radius:0 12px 12px 0;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
  <span style="position:absolute;top:1.25rem;left:1rem;font-size:1.75rem;">📊</span>
  <strong style="display:block;font-size:1rem;font-weight:700;color:#6d28d9;margin-bottom:0.5rem;">The Research Says</strong>
  <p style="margin:0.25rem 0;font-size:0.95rem;line-height:1.6;color:#333;"><strong>[Study Name/Source]:</strong> [Title or description]</p>
  <p style="margin:0.25rem 0;font-size:0.95rem;line-height:1.6;color:#333;">[Key finding explained in plain English - make it relevant to the reader]</p>
</div>
\`\`\`

### 🔗 INTERNAL LINKING STRATEGY:
- Include 10-15 contextual internal links MINIMUM
- Anchor text = exact or partial keyword match
- Link in first 100 words, middle sections, and last 200 words
- ONLY use URLs from the provided internal links list
- DO NOT invent or create URLs - use only what's provided
- Format: <a href="[exact URL from list]">[descriptive anchor text]</a>

### 📊 SCHEMA MARKUP (Include complete JSON-LD):
Include Article schema, FAQPage schema, and BreadcrumbList schema in the response.

### ✅ QUALITY CHECKLIST (ALL MUST PASS):
☑️ Word count within specified range (THIS IS #1 PRIORITY)
☑️ TL;DR summary with 5 specific bullet points
☑️ Table of Contents linking to all H2s
☑️ Expert quote with real attribution
☑️ 5+ H2 headings (question format for PAA)
☑️ 10+ internal links from provided list
☑️ 5-7 FAQs in PAA format with schema
☑️ Key takeaways section with 5 points
☑️ At least 1 comparison table
☑️ 2-3 Pro tip boxes
☑️ 2-3 Key insight boxes
☑️ 1-2 Warning boxes
☑️ 2-3 Stat callout boxes
☑️ Research/study reference
☑️ YouTube video recommendation
☑️ 3 CTA placements
☑️ Hormozi writing style throughout
☑️ Featured snippet format answers (40-60 words under each H2)
☑️ Entity definitions in first 100 words

### 📤 OUTPUT FORMAT:
Return ONLY valid JSON. No markdown code fences. No explanation. Just the JSON object.`;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function updateJobProgress(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  step: string,
  progress: number,
  logger: Logger
) {
  try {
    await supabase.from('jobs').update({
      current_step: step,
      progress,
      status: 'running',
    }).eq('id', jobId);
    logger.info(`Progress: ${step} (${progress}%)`);
  } catch (e) {
    logger.warn('Failed to update progress', { error: e instanceof Error ? e.message : 'Unknown' });
  }
}

async function markJobFailed(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  pageId: string,
  errorMessage: string,
  logger: Logger
) {
  try {
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

    await supabase.from('pages').update({ status: 'failed' }).eq('id', pageId);

    await supabase.from('activity_log').insert({
      page_id: pageId,
      job_id: jobId,
      type: 'error',
      message: `Failed: ${errorMessage}`,
    });

    logger.error('Job failed', { errorMessage });
  } catch (e) {
    logger.error('Failed to mark job as failed', { error: e instanceof Error ? e.message : 'Unknown' });
  }
}

function deriveKeyword(title: string, slug: string): string {
  let keyword = title
    .replace(/\s*[-|–—]\s*.*$/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (keyword.length < 10 && slug) {
    keyword = slug.replace(/-/g, ' ').replace(/[^\w\s]/g, '').trim();
  }

  return keyword.substring(0, 100);
}

async function fetchPageContent(
  siteUrl: string,
  pageUrl: string,
  username: string,
  applicationPassword: string,
  logger: Logger
): Promise<{ title: string; content: string; postId?: number }> {
  const normalizedUrl = siteUrl.replace(/\/+$/, '');
  const authHeader = 'Basic ' + btoa(`${username}:${applicationPassword.replace(/\s+/g, '')}`);
  
  const slug = pageUrl.split('/').filter(Boolean).pop() || '';
  
  // Try posts first
  let apiUrl = `${normalizedUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&context=edit`;
  
  logger.info('Fetching page content', { apiUrl });
  
  let response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader,
      'User-Agent': 'WP-Optimizer-Pro/3.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status}`);
  }

  let posts = await response.json();
  
  // If no posts found, try pages
  if (!posts || posts.length === 0) {
    apiUrl = `${normalizedUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit`;
    response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'User-Agent': 'WP-Optimizer-Pro/3.0',
      },
    });
    
    if (response.ok) {
      posts = await response.json();
    }
  }
  
  if (!posts || posts.length === 0) {
    throw new Error('Page not found');
  }

  const post = posts[0];
  return {
    title: post.title?.raw || post.title?.rendered || '',
    content: post.content?.raw || post.content?.rendered || '',
    postId: post.id,
  };
}

async function fetchInternalLinks(
  supabase: ReturnType<typeof createClient>,
  siteId: string | null,
  currentPageId: string,
  logger: Logger
): Promise<InternalLinkCandidate[]> {
  try {
    let query = supabase
      .from('pages')
      .select('url, slug, title')
      .neq('id', currentPageId)
      .limit(100);

    if (siteId) {
      query = query.eq('site_id', siteId);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn('Failed to fetch internal links', { error: error.message });
      return [];
    }

    return (data || []).map(p => ({
      url: p.url,
      slug: p.slug,
      title: p.title,
    }));
  } catch (e) {
    logger.warn('Error fetching internal links', { error: e instanceof Error ? e.message : 'Unknown' });
    return [];
  }
}

async function fetchNeuronWriterRecommendations(
  supabaseUrl: string,
  supabaseKey: string,
  neuronWriter: NeuronWriterConfig,
  keyword: string,
  language: string,
  logger: Logger,
  jobId: string,
  supabase: ReturnType<typeof createClient>
): Promise<NeuronWriterRecommendations | null> {
  const maxAttempts = 12;
  const pollInterval = 10000;

  logger.info('Fetching NeuronWriter recommendations', { keyword });

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/neuronwriter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: 'get-recommendations',
        apiKey: neuronWriter.apiKey,
        projectId: neuronWriter.projectId,
        keyword,
        language: language || 'English',
      }),
    });

    if (!response.ok) {
      logger.warn('NeuronWriter request failed', { status: response.status });
      return null;
    }

    let data = await response.json();

    if (data.status === 'ready') {
      logger.info('NeuronWriter data ready immediately');
      return data;
    }

    if (!data.queryId) {
      logger.warn('No queryId returned from NeuronWriter');
      return null;
    }

    const queryId = data.queryId;
    logger.info('Polling NeuronWriter for results...', { queryId });

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, pollInterval));
      await updateJobProgress(supabase, jobId, 'waiting_neuronwriter', 30 + attempt * 2, logger);

      const pollResponse = await fetch(`${supabaseUrl}/functions/v1/neuronwriter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          action: 'get-query',
          apiKey: neuronWriter.apiKey,
          queryId,
        }),
      });

      if (pollResponse.ok) {
        data = await pollResponse.json();
        if (data.status === 'ready' || data.recommendations?.status === 'ready') {
          logger.info('NeuronWriter ready after polling');
          return data.recommendations || data;
        }
      }
    }

    logger.warn('NeuronWriter polling timeout');
    return null;
  } catch (error) {
    logger.error('NeuronWriter error', { error: error instanceof Error ? error.message : 'Unknown' });
    return null;
  }
}

function buildOptimizationPrompt(
  pageTitle: string,
  pageContent: string,
  keyword: string,
  internalLinks: InternalLinkCandidate[],
  neuronWriter: NeuronWriterRecommendations | null,
  advanced: AdvancedSettings,
  siteContext: SiteContext | undefined
): string {
  const neuronSection = neuronWriter?.status === 'ready' ? `
═══════════════════════════════════════════════════════════════════════════════
🧠 NEURONWRITER SEO INTELLIGENCE (USE THIS DATA!)
═══════════════════════════════════════════════════════════════════════════════
📊 Target Word Count: ${neuronWriter.targetWordCount || advanced.minWordCount}
📊 Readability Target: ${neuronWriter.readabilityTarget || 50}

📝 TITLE TERMS (include in title): ${neuronWriter.titleTerms || 'N/A'}
📌 H1 TERMS (include in H1): ${neuronWriter.h1Terms || 'N/A'}
📎 H2 TERMS (include in H2s): ${neuronWriter.h2Terms || 'N/A'}
📄 CONTENT TERMS (sprinkle throughout): ${neuronWriter.contentTerms || 'N/A'}
🔬 LSI KEYWORDS (semantic variations): ${neuronWriter.extendedTerms || 'N/A'}
🏢 ENTITIES (mention these): ${neuronWriter.entities || 'N/A'}

❓ QUESTIONS TO ANSWER (Use for H2s and FAQs):
${neuronWriter.questions?.peopleAlsoAsk?.slice(0, 7).map(q => `• ${q}`).join('\n') || ''}
${neuronWriter.questions?.suggested?.slice(0, 5).map(q => `• ${q}`).join('\n') || ''}

🏆 TOP COMPETITORS TO BEAT:
${neuronWriter.competitors?.slice(0, 3).map(c => `#${c.rank}: ${c.title} (Score: ${c.score || 'N/A'})`).join('\n') || ''}
` : '';

  const linksSection = advanced.enableInternalLinks && internalLinks.length > 0 ? `
═══════════════════════════════════════════════════════════════════════════════
🔗 INTERNAL LINKS (USE ONLY THESE URLs - DO NOT INVENT!)
═══════════════════════════════════════════════════════════════════════════════
${internalLinks.slice(0, 50).map(l => `• "${l.title}" → ${l.url}`).join('\n')}

⚠️ CRITICAL: Only use URLs from this list above. DO NOT create or invent URLs.
Include 10-15 internal links throughout the content with descriptive anchor text.
` : '';

  const contextSection = siteContext ? `
═══════════════════════════════════════════════════════════════════════════════
🏢 BRAND CONTEXT (Match this voice and audience)
═══════════════════════════════════════════════════════════════════════════════
• Organization: ${siteContext.organizationName || 'N/A'}
• Author: ${siteContext.authorName || 'Editorial Team'}
• Industry: ${siteContext.industry || 'N/A'}
• Target Audience: ${siteContext.targetAudience || 'N/A'}
• Voice: ${siteContext.brandVoice || 'Alex Hormozi style - direct, punchy, value-packed'}
` : '';

  return `
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ⚠️ CRITICAL WORD COUNT REQUIREMENT ⚠️                                         ║
║  MINIMUM: ${advanced.minWordCount} words | MAXIMUM: ${advanced.maxWordCount} words                             ║
║  YOU MUST HIT AT LEAST ${advanced.minWordCount} WORDS IN optimizedContent - NON-NEGOTIABLE      ║
║  This is your #1 priority. Count carefully before returning.                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Transform this content into an EXCEPTIONAL, HIGH-CONVERTING blog post using Alex Hormozi's writing style.

═══════════════════════════════════════════════════════════════════════════════
📄 ORIGINAL CONTENT TO TRANSFORM
═══════════════════════════════════════════════════════════════════════════════
Title: ${pageTitle}
Primary Keyword: ${keyword}

CONTENT:
${pageContent.substring(0, 30000)}

${neuronSection}
${linksSection}
${contextSection}

═══════════════════════════════════════════════════════════════════════════════
📋 MANDATORY REQUIREMENTS CHECKLIST
═══════════════════════════════════════════════════════════════════════════════

✅ WORD COUNT: ${advanced.minWordCount}-${advanced.maxWordCount} words (STRICTLY ENFORCED - #1 PRIORITY)
✅ TL;DR Summary with 5 specific bullet points (with numbers/stats)
✅ Table of Contents linking to all H2s
✅ Expert quote with REAL person attribution (Google to verify)
✅ 5+ H2 headings in question format (matches PAA)
✅ Featured snippet format: 40-60 word answer under EVERY H2
✅ YouTube video recommendation with specific search query
✅ Research/study reference with source
✅ ${advanced.enableFaqs ? '5-7 FAQs in PAA format with schema markup' : 'No FAQs required'}
✅ ${advanced.enableKeyTakeaways ? '5 Key Takeaways (specific and actionable)' : 'No takeaways required'}
✅ ${advanced.enableInternalLinks ? '10-15 internal links from the provided list ONLY' : 'No internal links required'}
✅ ${advanced.enableCtas ? '3 CTAs (after-intro, mid-content, conclusion)' : 'No CTAs required'}
✅ ${advanced.enableSchema ? 'Full Article + FAQ Schema in JSON-LD' : 'No schema required'}
✅ At least 1 comparison table with real data
✅ 2-3 Pro tip boxes with insider knowledge
✅ 2-3 Key insight boxes with data-backed observations
✅ 1-2 Warning boxes about common mistakes
✅ 2-3 Stat callout boxes with specific numbers
✅ Hormozi writing style throughout (punchy, direct, value-packed)
✅ Contrarian positioning where appropriate
✅ Pattern interrupts every 200 words
✅ Mic-drop ending for every H2 section

═══════════════════════════════════════════════════════════════════════════════
📤 OUTPUT FORMAT (JSON ONLY - NO CODE FENCES)
═══════════════════════════════════════════════════════════════════════════════

{
  "optimizedTitle": "Power-word title under 60 chars with primary keyword front-loaded",
  "metaDescription": "Compelling 155-char meta description with CTA and keyword",
  "h1": "Main H1 heading (can differ slightly from title for optimization)",
  "h2s": ["Question-format H2 1?", "Question-format H2 2?", "Question-format H2 3?", "Question-format H2 4?", "Question-format H2 5?", "Additional H2s as needed"],
  
  "tldrSummary": [
    "💡 [Specific insight with exact number]",
    "🎯 [Contrarian take that challenges assumptions]",
    "⚡ [Actionable tip they can use in 10 minutes]",
    "🔥 [Mic-drop statement worth screenshotting]",
    "📈 [Specific expected outcome with timeframe]"
  ],
  
  "expertQuote": {
    "quote": "Real, verifiable quote from an industry expert",
    "author": "Expert Name (real person)",
    "role": "Title at Company (verifiable)",
    "avatarUrl": null
  },
  
  "youtubeEmbed": {
    "searchQuery": "specific youtube search query to find relevant video",
    "suggestedTitle": "Type of video to find",
    "context": "Why this video adds value to the reader"
  },
  
  "patentReference": {
    "type": "research",
    "identifier": "Study Name or DOI",
    "title": "Full title of the research",
    "summary": "Key finding in 2-3 sentences, explained simply",
    "link": "URL if available"
  },
  
  "optimizedContent": "<full HTML content with ALL content blocks, inline styles, internal links, proper heading structure - MUST BE ${advanced.minWordCount}+ WORDS>",
  
  "faqs": [
    {"question": "PAA-style question 1?", "answer": "Direct 40-60 word answer for featured snippet extraction"},
    {"question": "PAA-style question 2?", "answer": "Direct 40-60 word answer for featured snippet extraction"},
    {"question": "PAA-style question 3?", "answer": "Direct 40-60 word answer for featured snippet extraction"},
    {"question": "PAA-style question 4?", "answer": "Direct 40-60 word answer for featured snippet extraction"},
    {"question": "PAA-style question 5?", "answer": "Direct 40-60 word answer for featured snippet extraction"}
  ],
  
  "keyTakeaways": [
    "✅ [Specific actionable takeaway 1 with measurable outcome]",
    "✅ [Specific actionable takeaway 2 they can do today]",
    "✅ [Specific actionable takeaway 3 tied to main benefit]",
    "✅ [Specific actionable takeaway 4 for advanced readers]",
    "✅ [Mic-drop final insight that summarizes the article]"
  ],
  
  "ctas": [
    {"text": "CTA after intro", "position": "after-intro", "style": "primary"},
    {"text": "CTA mid content", "position": "mid-content", "style": "secondary"},
    {"text": "CTA at conclusion", "position": "conclusion", "style": "primary"}
  ],
  
  "tableOfContents": ["H2 Title 1", "H2 Title 2", "H2 Title 3", "H2 Title 4", "H2 Title 5"],
  
  "contentStrategy": {
    "wordCount": [ACTUAL word count of optimizedContent - MUST be ${advanced.minWordCount}+],
    "readabilityScore": [0-100],
    "keywordDensity": [percentage as decimal],
    "lsiKeywords": ["related", "semantic", "keywords", "used"]
  },
  
  "internalLinks": [
    {"anchor": "descriptive anchor text", "target": "/url-from-provided-list", "position": 1}
  ],
  
  "schema": {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": "[optimized title]",
        "description": "[meta description]",
        "author": {"@type": "Person", "name": "${siteContext?.authorName || 'Editorial Team'}"},
        "publisher": {"@type": "Organization", "name": "${siteContext?.organizationName || 'Publisher'}"},
        "datePublished": "${new Date().toISOString()}",
        "dateModified": "${new Date().toISOString()}"
      },
      {
        "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": "...", "acceptedAnswer": {"@type": "Answer", "text": "..."}}]
      }
    ]
  },
  
  "aiSuggestions": {
    "contentGaps": "What's missing compared to top competitors",
    "quickWins": "Easy improvements for immediate SEO impact",
    "improvements": ["Specific suggestion 1", "Specific suggestion 2", "Specific suggestion 3"]
  },
  
  "qualityScore": [0-100 overall quality assessment],
  "seoScore": [0-100 SEO optimization level],
  "readabilityScore": [0-100 readability assessment],
  "engagementScore": [0-100 engagement potential],
  "estimatedRankPosition": [1-100 estimated SERP position],
  "confidenceLevel": [0-100 confidence in optimization success]
}`;
}

async function callAIProvider(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  logger: Logger
): Promise<{ content: string; tokensUsed: number }> {
  logger.info('Calling AI provider', { provider, model });

  const maxTokens = 16000;

  switch (provider) {
    case 'google': {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
          ],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tokensUsed = data.usageMetadata?.totalTokenCount || 0;
      
      return { content, tokensUsed };
    }

    case 'openai': {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
      };
    }

    case 'anthropic': {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: data.content?.[0]?.text || '',
        tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      };
    }

    case 'groq': {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
      };
    }

    case 'openrouter': {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://wp-optimizer.pro',
          'X-Title': 'WP Optimizer Pro Ultra',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
      };
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

function parseAIResponse(content: string, logger: Logger): OptimizationResult {
  // Clean the response
  let cleaned = content.trim();
  
  // Remove markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
// Find JSON object bounds const jsonStart = cleaned.indexOf('{'); const jsonEnd = cleaned.lastIndexOf('}');
if (jsonStart === -1 || jsonEnd === -1) { logger.error('No valid JSON found in AI response', { responseLength: content.length }); throw new Error('No valid JSON found in AI response'); }
cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
try { const parsed = JSON.parse(cleaned);
text


// Validate required fields
if (!parsed.optimizedTitle) {
  throw new Error('Missing optimizedTitle in AI response');
}
if (!parsed.optimizedContent) {
  throw new Error('Missing optimizedContent in AI response');
}
text


return parsed as OptimizationResult;
} catch (e) { logger.error('JSON parse error', { error: e instanceof Error ? e.message : 'Unknown', contentPreview: cleaned.substring(0, 500) }); throw new Error(Failed to parse AI response: ${e instanceof Error ? e.message : 'Unknown'}); } }
function validateOptimizationQuality( result: OptimizationResult, minWordCount: number, logger: Logger ): { valid: boolean; issues: string[]; score: number } { const issues: string[] = []; let score = 100;
// Word count check (CRITICAL) const content = result.optimizedContent || ''; const wordCount = result.contentStrategy?.wordCount || content.split(/\s+/).filter(Boolean).length;
if (wordCount < minWordCount * 0.85) { issues.push(Word count (${wordCount}) significantly below minimum (${minWordCount})); score -= 40; // Heavy penalty } else if (wordCount < minWordCount) { issues.push(Word count (${wordCount}) slightly below minimum (${minWordCount})); score -= 20; }
// TL;DR check if (!result.tldrSummary || result.tldrSummary.length < 4) { issues.push('Missing or incomplete TL;DR summary'); score -= 10; }
// FAQs check if (!result.faqs || result.faqs.length < 3) { issues.push('Missing or insufficient FAQs (need at least 5)'); score -= 10; }
// Key takeaways check if (!result.keyTakeaways || result.keyTakeaways.length < 3) { issues.push('Missing or insufficient key takeaways'); score -= 10; }
// Content blocks check const hasTLDRBox = content.includes('wp-opt-tldr') || content.includes('TL;DR'); const hasTakeawaysBox = content.includes('wp-opt-takeaways') || content.includes('Key Takeaways'); const hasInsightBox = content.includes('wp-opt-insight') || content.includes('Key Insight'); const hasTipBox = content.includes('wp-opt-tip') || content.includes('Pro Tip'); const hasWarningBox = content.includes('wp-opt-warning') || content.includes('Common Mistake'); const hasComparisonTable = content.includes('wp-opt-comparison') || content.includes('<table'); const hasQuoteBox = content.includes('wp-opt-quote') || content.includes('blockquote');
if (!hasTLDRBox) { issues.push('Missing TL;DR box'); score -= 5; } if (!hasTakeawaysBox) { issues.push('Missing Key Takeaways box'); score -= 5; } if (!hasInsightBox) { issues.push('Missing insight boxes'); score -= 5; } if (!hasTipBox) { issues.push('Missing pro tip boxes'); score -= 5; } if (!hasComparisonTable) { issues.push('Missing comparison table'); score -= 5; } if (!hasQuoteBox) { issues.push('Missing expert quote'); score -= 5; }
// H2 count check const h2Count = (content.match(/<h2/gi) || []).length; if (h2Count < 5) { issues.push(Insufficient H2 headers (${h2Count}, need 5+)); score -= 10; }
// Internal links check const linkCount = (content.match(/href=["'][^"']+["']/gi) || []).length; if (linkCount < 8) { issues.push(Insufficient internal links (${linkCount}, need 10+)); score -= 10; }
// Hormozi style indicators const hormoziPatterns = [ /here['']s the (truth|thing|reality|catch)/i, /most people (think|believe|assume|get.*wrong)/i, /let me (break|explain|show|be clear)/i, /the (math|numbers|data) (is|are|shows)/i, /stop doing .+ start doing/i, /\d+x (faster|better|more|higher)/i, /$[\d,]+/, /\d+%/, /here['']s what (actually|really) (works|matters)/i, ];
const hormoziMatches = hormoziPatterns.filter(p => p.test(content)).length; if (hormoziMatches < 4) { issues.push(Insufficient Hormozi-style writing patterns (found ${hormoziMatches}, need 4+)); score -= 10; }
logger.info('Quality validation complete', { wordCount, h2Count, linkCount, hormoziPatterns: hormoziMatches, score, issueCount: issues.length });
return { valid: score >= 50, issues, score: Math.max(0, Math.min(100, score)), }; }
function calculateFinalQualityScore(result: OptimizationResult, minWordCount: number): number { let score = 50; // Base score
const wordCount = result.contentStrategy?.wordCount || 0; if (wordCount >= minWordCount) score += 15; else if (wordCount >= minWordCount * 0.9) score += 10; else if (wordCount >= minWordCount * 0.8) score += 5;
if (result.tldrSummary && result.tldrSummary.length >= 4) score += 5; if (result.expertQuote?.quote && result.expertQuote.author) score += 5; if (result.youtubeEmbed?.searchQuery) score += 3; if (result.patentReference?.title) score += 5; if (result.faqs && result.faqs.length >= 5) score += 7; if (result.keyTakeaways && result.keyTakeaways.length >= 5) score += 5; if (result.schema && Object.keys(result.schema).length > 0) score += 5;
const content = result.optimizedContent || ''; if (content.includes('wp-opt-comparison') || content.includes('<table')) score += 3; if (content.includes('wp-opt-tip') || content.includes('Pro Tip')) score += 2; if (content.includes('wp-opt-warning') || content.includes('Common Mistake')) score += 2; if (content.includes('wp-opt-stat')) score += 2;
return Math.min(100, Math.max(0, score)); }
// ═══════════════════════════════════════════════════════════════════════════════ // MAIN SERVE FUNCTION // ═══════════════════════════════════════════════════════════════════════════════ serve(async (req) => { // Handle CORS preflight if (req.method === 'OPTIONS') { return new Response(null, { headers: corsHeaders }); }
const logger = new Logger('optimize-content-v3');
try { const request: OptimizeRequest = await req.json(); const { pageId, siteUrl, username, applicationPassword, aiConfig, neuronWriter, advanced, siteContext } = request;
text


logger.info('🚀 Optimization request received', { pageId, siteUrl });
text


// Validate required fields
if (!pageId || !siteUrl || !username || !applicationPassword) {
  return new Response(
    JSON.stringify({ success: false, error: 'Missing required fields: pageId, siteUrl, username, applicationPassword' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
text


// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);
text


// Get page info from database
const { data: pageData, error: pageError } = await supabase
  .from('pages')
  .select('*')
  .eq('id', pageId)
  .single();
text


if (pageError || !pageData) {
  logger.error('Page not found', { pageId, error: pageError?.message });
  return new Response(
    JSON.stringify({ success: false, error: 'Page not found in database' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
text


// Create job record
const { data: jobData, error: jobError } = await supabase
  .from('jobs')
  .insert({
    page_id: pageId,
    status: 'running',
    current_step: 'initializing',
    progress: 5,
    started_at: new Date().toISOString(),
  })
  .select()
  .single();
text


if (jobError || !jobData) {
  logger.error('Failed to create job', { error: jobError?.message });
  return new Response(
    JSON.stringify({ success: false, error: 'Failed to create optimization job' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
text


const jobId = jobData.id;
logger.info('📋 Job created', { jobId });
text


// Update page status
await supabase.from('pages').update({ status: 'optimizing' }).eq('id', pageId);
text


// Default settings with sensible defaults
const settings: AdvancedSettings = {
  targetScore: advanced?.targetScore || 85,
  minWordCount: advanced?.minWordCount || 2000,
  maxWordCount: advanced?.maxWordCount || 3500,
  enableFaqs: advanced?.enableFaqs ?? true,
  enableSchema: advanced?.enableSchema ?? true,
  enableInternalLinks: advanced?.enableInternalLinks ?? true,
  enableToc: advanced?.enableToc ?? true,
  enableKeyTakeaways: advanced?.enableKeyTakeaways ?? true,
  enableCtas: advanced?.enableCtas ?? true,
};
text


try {
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Fetch page content from WordPress
  // ═══════════════════════════════════════════════════════════════════════
  await updateJobProgress(supabase, jobId, 'fetching_content', 10, logger);
  
  const { title, content, postId } = await fetchPageContent(
    siteUrl,
    pageData.url,
    username,
    applicationPassword,
    logger
  );
text


  if (!content || content.length < 100) {
    throw new Error('Page content is too short or empty to optimize');
  }
text


  logger.info('📄 Page content fetched', { 
    titleLength: title.length, 
    contentLength: content.length,
    postId 
  });
text


  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Derive target keyword
  // ═══════════════════════════════════════════════════════════════════════
  const keyword = request.targetKeyword || deriveKeyword(title, pageData.slug);
  logger.info('🎯 Target keyword', { keyword });
text


  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Fetch internal links
  // ═══════════════════════════════════════════════════════════════════════
  await updateJobProgress(supabase, jobId, 'fetching_internal_links', 20, logger);
  const internalLinks = await fetchInternalLinks(supabase, pageData.site_id, pageId, logger);
  logger.info('🔗 Internal links fetched', { count: internalLinks.length });
text


  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Fetch NeuronWriter recommendations (if enabled)
  // ═══════════════════════════════════════════════════════════════════════
  let neuronWriterData: NeuronWriterRecommendations | null = null;
  
  if (neuronWriter?.enabled && neuronWriter?.apiKey && neuronWriter?.projectId) {
    await updateJobProgress(supabase, jobId, 'fetching_neuronwriter', 25, logger);
    neuronWriterData = await fetchNeuronWriterRecommendations(
      supabaseUrl,
      supabaseKey,
      neuronWriter,
      keyword,
      request.language || 'English',
      logger,
      jobId,
      supabase
    );
    
    if (neuronWriterData) {
      logger.info('🧠 NeuronWriter data received', { 
        status: neuronWriterData.status,
        targetWordCount: neuronWriterData.targetWordCount 
      });
    }
  }
text


  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Build prompt and call AI
  // ═══════════════════════════════════════════════════════════════════════
  await updateJobProgress(supabase, jobId, 'generating_content', 50, logger);
text


  const userPrompt = buildOptimizationPrompt(
    title,
    content,
    keyword,
    internalLinks,
    neuronWriterData,
    settings,
    siteContext
  );
text


  // Determine AI config
  const provider = aiConfig?.provider || 'google';
  const apiKey = aiConfig?.apiKey || Deno.env.get('GOOGLE_API_KEY') || '';
  const model = aiConfig?.model || 'gemini-2.5-flash-preview-05-20';
text


  if (!apiKey) {
    throw new Error('No AI API key configured. Please add your API key in settings.');
  }
text


  logger.info('🤖 Calling AI provider', { provider, model });
text


  const { content: aiResponse, tokensUsed } = await callAIProvider(
    provider,
    apiKey,
    model,
    ULTRA_SEO_GEO_AEO_SYSTEM_PROMPT,
    userPrompt,
    logger
  );
text


  logger.info('✅ AI response received', { tokensUsed, responseLength: aiResponse.length });
text


  // ═══════════════════════════════════════════════════════════════════════
  // STEP 6: Parse AI response
  // ═══════════════════════════════════════════════════════════════════════
  await updateJobProgress(supabase, jobId, 'parsing_response', 80, logger);
  const optimization = parseAIResponse(aiResponse, logger);
text


  // ═══════════════════════════════════════════════════════════════════════
  // STEP 7: Validate quality
  // ═══════════════════════════════════════════════════════════════════════
  await updateJobProgress(supabase, jobId, 'validating_quality', 90, logger);
  const validation = validateOptimizationQuality(optimization, settings.minWordCount, logger);
text


  if (!validation.valid) {
    logger.warn('⚠️ Quality validation issues detected', { 
      issues: validation.issues,
      score: validation.score 
    });
  }
text


  // Calculate final quality score
  const qualityScore = calculateFinalQualityScore(optimization, settings.minWordCount);
  optimization.qualityScore = qualityScore;
text


  // ═══════════════════════════════════════════════════════════════════════
  // STEP 8: Save results
  // ═══════════════════════════════════════════════════════════════════════
  await updateJobProgress(supabase, jobId, 'saving_results', 95, logger);
text


  // Update job with results
  await supabase.from('jobs').update({
    status: 'completed',
    progress: 100,
    current_step: 'completed',
    result: optimization,
    ai_tokens_used: tokensUsed,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId);
text


  // Update page status and score
  await supabase.from('pages').update({
    status: 'completed',
    score_after: {
      overall: qualityScore,
      components: {
        contentDepth: optimization.readabilityScore || 75,
        seoOnPage: optimization.seoScore || 80,
        engagement: optimization.engagementScore || 70,
      },
    },
    word_count: optimization.contentStrategy?.wordCount || 0,
    updated_at: new Date().toISOString(),
  }).eq('id', pageId);
text


  // Log success to activity log
  await supabase.from('activity_log').insert({
    page_id: pageId,
    job_id: jobId,
    type: 'success',
    message: `✅ Optimized successfully: Score ${qualityScore}, ${optimization.contentStrategy?.wordCount || 0} words`,
    details: {
      qualityScore,
      wordCount: optimization.contentStrategy?.wordCount,
      tokensUsed,
      validationScore: validation.score,
      validationIssues: validation.issues,
    },
  });
text


  logger.info('🎉 Optimization completed successfully!', { 
    qualityScore, 
    wordCount: optimization.contentStrategy?.wordCount,
    tokensUsed 
  });
text


  return new Response(
    JSON.stringify({
      success: true,
      message: 'Optimization completed successfully',
      jobId,
      optimization,
      validation: {
        score: validation.score,
        issues: validation.issues,
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
text


} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  logger.error('❌ Optimization failed', { error: errorMessage });
  
  await markJobFailed(supabase, jobId, pageId, errorMessage, logger);
  
  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
      jobId,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
} catch (error) { logger.error('❌ Request processing error', { error: error instanceof Error ? error.message : 'Unknown' });
text


return new Response(
  JSON.stringify({
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error occurred',
  }),
  { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
} });
