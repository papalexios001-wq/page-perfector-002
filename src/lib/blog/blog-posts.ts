import React from 'react';
import {
  KeyTakeawaysBox,
  QuoteBox,
  StatsBox,
  CTABox,
  ProTipBox,
  WarningBox,
  StepsBox,
} from './BlogBoxComponents';

export const BLOG_POSTS = [
  {
    id: 'copywriting-principles-alex-hormozi',
    title: 'What Is Copywriting: Promotes, Advertises, or Entertains? The Real Story',
    slug: 'what-is-copywriting-alex-hormozi',
    excerpt: 'Most people think copywriting is about selling. They\'re wrong. Here\'s what copywriting actually does and why it matters.',
    content: (
      <>
        <section style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '20px' }}>
            Here\'s the thing: most people get copywriting completely wrong.
          </p>
          <p style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '20px' }}>
            They think it\'s about fancy words. Manipulative tactics. Sleazy sales tricks that force people to buy things they don\'t want.
          </p>
          <p style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '20px', fontWeight: '600', color: '#dc2626' }}>
            That\'s not copywriting. That\'s the opposite of copywriting.
          </p>
          <p style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '20px' }}>
            The real definition? Copywriting is the art of communicating value so clearly that people feel compelled to take action. Not because they\'re tricked. But because they see something worth having.
          </p>
        </section>

        <KeyTakeawaysBox
          items={[
            'Copywriting is fundamentally about clarity, not manipulation',
            'The best copy addresses a specific problem with a specific solution',
            'Promotion and advertising are byproducts of good copywriting, not the goal',
            'Entertainment in copy keeps people reading, but conversion is the real purpose',
            'The difference between good copy and bad copy is simply: does the reader take action?',
          ]}
        />

        <section style={{ marginTop: '40px', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '20px', color: '#111827' }}>
            The Three Layers of Copywriting
          </h2>

          <StepsBox
            steps={[
              'Get Attention: The copy must stop the scroll. Without attention, nothing else matters.',
              'Keep Interest: The copy must demonstrate that you understand their problem. Really understand it.',
              'Drive Action: The copy must make it crystal clear what they need to do next and why it\'s the right move.',
            ]}
          />
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '20px', color: '#111827' }}>
            Why People Think Copywriting Is About Promoting
          </h2>

          <ProTipBox
            tip="Most copywriting you\'ve seen is bad. It\'s pushy. It\'s salesy. So people assume promotion is the point. The truth: good copy doesn\'t feel like promotion because it\'s too busy solving a real problem."
            icon="💡"
          />
        </section>

        <QuoteBox
          quote="The best copy doesn\'t make people buy something they don\'t want. It makes them realize they already wanted something they didn\'t know existed."
          author="Direct Response Marketing Principle"
          role="Proven Through Data"
        />

        <section style={{ marginBottom: '40px', marginTop: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '20px', color: '#111827' }}>
            The Real Numbers: What Good Copy Actually Does
          </h2>

          <StatsBox
            {[
              { label: 'Attention (First 3 Seconds)', value: '80%', icon: '👀' },
              { label: 'Audience That Keeps Reading', value: '15-25%', icon: '📖' },
              { label: 'Conversion Rate (Good Copy)', value: '2-5%', icon: '🎯' },
              { label: 'Improvement vs Bad Copy', value: '300%+', icon: '📈' },
            ]}
          />
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '20px', color: '#111827' }}>
            The Copy Spectrum: Promotes, Advertises, Entertains
          </h2>

          <p style={{ fontSize: '16px', lineHeight: '1.8', marginBottom: '20px' }}>
            <strong>Promotes:</strong> Direct. Straightforward. "Buy this, it does this." Mostly used in saturated markets where you\'re fighting for attention.
          </p>
          <p style={{ fontSize: '16px', lineHeight: '1.8', marginBottom: '20px' }}>
            <strong>Advertises:</strong> Emotional. Story-driven. Creates desire. Builds brand. Used when you have permission and attention.
          </p>
          <p style={{ fontSize: '16px', lineHeight: '1.8', marginBottom: '20px' }}>
            <strong>Entertains:</strong> Storytelling first, offer second. Keeps people so engaged they\'re willing to be sold to because the content is valuable on its own.
          </p>

          <WarningBox
            message="Most businesses use the wrong approach for their situation. E-commerce? Promote. Building brand? Advertise. Already have an audience? Entertain then convert. Misalignment kills conversions."
          />
        </section>

        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '20px', color: '#111827' }}>
            The One Thing That Actually Matters
          </h2>

          <p style={{ fontSize: '16px', lineHeight: '1.8', marginBottom: '20px' }}>
            Whether your copy promotes, advertises, or entertains is less important than whether it converts. And conversion only happens when you solve a problem better than the alternatives.
          </p>

          <p style={{ fontSize: '16px', lineHeight: '1.8', marginBottom: '20px' }}>
            Spend less time worrying about which category your copy falls into. Spend more time understanding what your customer actually wants, why they want it, and why your solution is the obvious choice.
          </p>
        </section>

        <CTABox
          title="Ready to Write Copy That Actually Converts?"
          description="Stop guessing about what works. Start measuring what converts. The difference is everything."
          buttonText="Learn More About Real Copywriting"
          buttonHref="/copywriting-guide"
          icon="✍️"
        />
      </>
    ),
    author: 'Copywriting Expert',
    publishedAt: new Date('2025-01-20'),
    publishedDate: '2025-01-20',
    readTime: '8 min',
    category: 'Copywriting',
    tags: ['copywriting', 'marketing', 'conversion', 'sales-psychology'],
  },
  {
    id: 'marketing-funnel-basics',
    title: 'The $100M Funnel: Why Most Funnels Fail (And How Yours Doesn\'t Have To)',
    slug: 'marketing-funnel-100-million',
    excerpt: 'There\'s a reason most marketing funnels fail. It\'s not the traffic. It\'s not the offer. Here\'s what actually breaks funnels.',
    content: (
      <>
        <section style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '20px' }}>
            Here\'s what I see all the time: businesses building funnels backwards.
          </p>
          <p style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '20px' }}>
            They start with the technology. Landing page builder, email sequences, sales pages. Then they shove traffic into it.
          </p>
          <p style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '20px', fontWeight: '600', color: '#dc2626' }}>
            And then they wonder why nobody converts.
          </p>
        </section>

        <KeyTakeawaysBox
          items={[
            'A funnel\'s success is determined before you build the first page',
            'The "funnel" is really just a sequence of conversations',
            'Each step must move the person closer to a decision, not further away',
            'The biggest leak isn\'t at the bottom of the funnel, it\'s at the top',
            'You don\'t need a perfect funnel, you need a funnel that works for YOUR customer',
          ]}
        />

        <ProTipBox
          tip="Forget complicated multi-step funnels for a second. Start simple: awareness → interest → decision → action. If you can\'t make that work, adding more steps won\'t help."
          icon="🎯"
        />

        <StatsBox
          {[
            { label: 'Average Funnel Conversion (Industry)', value: '1-3%', icon: '📊' },
            { label: 'Top 10% Funnel Conversion', value: '10-25%', icon: '🌟' },
            { label: 'Improvement From Optimization', value: '300-500%', icon: '🚀' },
            { label: 'Time to First Conversion', value: '2-4 weeks', icon: '⏱️' },
          ]}
        />

        <QuoteBox
          quote="Most funnels fail because they try to convert strangers into customers in one step. The best funnels convert strangers into interested people first, then customers second."
          author="Funnel Psychology Expert"
          role="Real Results"
        />

        <CTABox
          title="Build Your First Funnel (Or Fix Your Broken One)"
          description="The best time to build a funnel was yesterday. The second-best time is right now. Let\'s make yours convert."
          buttonText="Get Your Funnel Audit"
          buttonHref="/funnel-audit"
          icon="🔧"
        />
      </>
    ),
    author: 'Growth Strategist',
    publishedAt: new Date('2025-01-19'),
    publishedDate: '2025-01-19',
    readTime: '7 min',
    category: 'Marketing Strategy',
    tags: ['funnel', 'conversion', 'marketing', 'sales-funnel'],
  },
];
