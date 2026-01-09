BlogBoxComponents.tsx'use client';

import React from 'react';
import styles from './blog-boxes.module.css';

// KEY TAKEAWAYS BOX - Blue gradient with checkmarks
export const KeyTakeawaysBox: React.FC<{ items: string[] }> = ({ items }) => (
  <div className={styles.keyTakeawaysBox}>
    <div className={styles.boxHeader}>
      <span className={styles.icon}>📌</span>
      <h3 className={styles.boxTitle}>Key Takeaways</h3>
    </div>
    <ul className={styles.takeawaysList}>
      {items.map((item, idx) => (
        <li key={idx} className={styles.takeawayItem}>
          <span className={styles.checkmark}>✓</span>
          <span className={styles.itemText}>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

// QUOTE BOX - Amber gradient for testimonials
export const QuoteBox: React.FC<{
  quote: string;
  author?: string;
  role?: string;
}> = ({ quote, author, role }) => (
  <div className={styles.quoteBox}>
    <div className={styles.quoteIcon}>"</div>
    <p className={styles.quoteText}>{quote}</p>
    {author && (
      <div className={styles.quoteAttribution}>
        <p className={styles.quoteAuthor}>— {author}</p>
        {role && <p className={styles.quoteRole}>{role}</p>}
      </div>
    )}
  </div>
);

// STATISTICS BOX - Dynamic grid with metrics
export const StatsBox: React.FC<
  { label: string; value: string; icon?: string }[]
> = (stats) => (
  <div className={styles.statsBox}>
    {Object.values(stats).map((stat, idx) => (
      <div key={idx} className={styles.statCard}>
        {stat.icon && <div className={styles.statIcon}>{stat.icon}</div>}
        <div className={styles.statValue}>{stat.value}</div>
        <div className={styles.statLabel}>{stat.label}</div>
      </div>
    ))}
  </div>
);

// CALL-TO-ACTION BOX - Green gradient for conversions
export const CTABox: React.FC<{
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  icon?: string;
}> = ({ title, description, buttonText, buttonHref, icon = '🚀' }) => (
  <div className={styles.ctaBox}>
    <div className={styles.ctaIcon}>{icon}</div>
    <h3 className={styles.ctaTitle}>{title}</h3>
    <p className={styles.ctaDescription}>{description}</p>
    <a href={buttonHref} className={styles.ctaButton}>
      {buttonText}
    </a>
  </div>
);

// PRO TIP BOX - Gold/amber for valuable insights
export const ProTipBox: React.FC<{ tip: string; icon?: string }> = ({
  tip,
  icon = '💡',
}) => (
  <div className={styles.proTipBox}>
    <div className={styles.proTipIcon}>{icon}</div>
    <div className={styles.proTipContent}>
      <h4 className={styles.proTipLabel}>Pro Tip</h4>
      <p className={styles.proTipText}>{tip}</p>
    </div>
  </div>
);

// WARNING BOX - Red/orange for important information
export const WarningBox: React.FC<{ message: string }> = ({ message }) => (
  <div className={styles.warningBox}>
    <span className={styles.warningIcon}>⚠️</span>
    <p className={styles.warningText}>{message}</p>
  </div>
);

// COMPARISON BOX - Side-by-side comparison
export const ComparisonBox: React.FC<{
  leftLabel: string;
  leftItems: string[];
  rightLabel: string;
  rightItems: string[];
}> = ({ leftLabel, leftItems, rightLabel, rightItems }) => (
  <div className={styles.comparisonBox}>
    <div className={styles.comparisonColumn}>
      <h4 className={styles.comparisonHeader}>{leftLabel}</h4>
      <ul className={styles.comparisonList}>
        {leftItems.map((item, idx) => (
          <li key={idx} className={styles.comparisonItem}>
            ✗ {item}
          </li>
        ))}
      </ul>
    </div>
    <div className={styles.comparisonDivider} />
    <div className={styles.comparisonColumn}>
      <h4 className={styles.comparisonHeader}>{rightLabel}</h4>
      <ul className={styles.comparisonList}>
        {rightItems.map((item, idx) => (
          <li key={idx} className={styles.comparisonItem}>
            ✓ {item}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

// STEPS BOX - Numbered steps guide
export const StepsBox: React.FC<{ steps: string[] }> = ({ steps }) => (
  <div className={styles.stepsBox}>
    {steps.map((step, idx) => (
      <div key={idx} className={styles.stepItem}>
        <div className={styles.stepNumber}>{idx + 1}</div>
        <p className={styles.stepText}>{step}</p>
      </div>
    ))}
  </div>
);

// HIGHLIGHT BOX - Important information highlight
export const HighlightBox: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className={styles.highlightBox}>{children}</div>;

export default {
  KeyTakeawaysBox,
  QuoteBox,
  StatsBox,
  CTABox,
  ProTipBox,
  WarningBox,
  ComparisonBox,
  StepsBox,
  HighlightBox,
};
