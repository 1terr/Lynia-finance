import { getPosts, getCategories } from '@/lib/insights-data';
import { InsightsContent } from '@/components/InsightsContent';

export default async function InsightsPage() {
  const [posts, categories] = await Promise.all([getPosts(), getCategories()]);

  return <InsightsContent posts={posts} categories={categories} />;
}
