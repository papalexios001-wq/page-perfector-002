import { useParams } from 'react-router-dom';
import BlogPostDisplay from '@/components/blog/BlogPostDisplay';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <BlogPostDisplay slug={slug || ''} />
      </div>
    </div>
  );
}
