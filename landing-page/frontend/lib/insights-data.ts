import { client } from './sanity';
import type { SanityPost, SanityCategory } from './sanity-types';

// Re-export types for convenience
export type { SanityPost as Post, SanityCategory as Category, SanityAuthor as Author } from './sanity-types';

const postsQuery = `
*[_type == "post"] | order(publishedAt desc) {
  _id,
  title,
  "slug": slug.current,
  excerpt,
  "category": category->{ _id, title, "slug": slug.current },
  "author": author->{ _id, name, role, image },
  publishedAt,
  readTime,
  featuredImage,
  body,
  seo
}
`;

const postBySlugQuery = `
*[_type == "post" && slug.current == $slug][0] {
  _id,
  title,
  "slug": slug.current,
  excerpt,
  "category": category->{ _id, title, "slug": slug.current },
  "author": author->{ _id, name, role, bio, image },
  publishedAt,
  readTime,
  featuredImage,
  body,
  seo
}
`;

const categoriesQuery = `
*[_type == "category"] | order(title asc) {
  _id,
  title,
  "slug": slug.current,
  description
}
`;

export async function getPosts(): Promise<SanityPost[]> {
  return client.fetch<SanityPost[]>(postsQuery);
}

export async function getPostBySlug(slug: string): Promise<SanityPost | null> {
  return client.fetch<SanityPost | null>(postBySlugQuery, { slug });
}

export async function getPostSlugs(): Promise<string[]> {
  return client.fetch<string[]>(`*[_type == "post"].slug.current`);
}

export async function getCategories(): Promise<SanityCategory[]> {
  return client.fetch<SanityCategory[]>(categoriesQuery);
}

export async function getRelatedPosts(
  currentSlug: string,
  limit = 3
): Promise<SanityPost[]> {
  const query = `
    *[_type == "post" && slug.current != $currentSlug] | order(publishedAt desc) {
      _id,
      title,
      "slug": slug.current,
      excerpt,
      "category": category->{ _id, title, "slug": slug.current },
      "author": author->{ _id, name, role },
      publishedAt,
      readTime,
      featuredImage
    }[0...$limit]
  `;
  return client.fetch<SanityPost[]>(query, { currentSlug, limit });
}
