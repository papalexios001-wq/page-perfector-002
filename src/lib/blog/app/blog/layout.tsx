import type { Metadata } from 'next';
import '../../../globals.css';

export const metadata: Metadata = {
  title: 'Blog | Page Perfector - SEO Optimization Tips & Strategies',
  description: 'Learn SEO, GEO, and AEO optimization strategies with Page Perfector. Human-written, expert-level content about WordPress blog optimization and SERP ranking.',
  keywords: ['SEO', 'WordPress', 'Blog Optimization', 'SERP Ranking', 'GEO', 'AEO', 'Content Optimization'],
  authors: [{ name: 'Page Perfector Team' }],
  creator: 'Page Perfector',
  publisher: 'Page Perfector',
  openGraph: {
    title: 'Page Perfector Blog - SEO Optimization Guides',
    description: 'Expert guides on SERP ranking, content optimization, and WordPress SEO strategies.',
    url: 'https://page-perfector.app/blog',
    siteName: 'Page Perfector',
    images: [
      {
        url: 'https://page-perfector.app/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Page Perfector Blog - SEO Optimization',
    description: 'Expert guides on WordPress optimization and SERP ranking strategies',
    creator: '@PagePerfector',
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body>{children}</body>
    </html>
  );
}
