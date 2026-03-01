import type { PortableTextBlock } from '@portabletext/types';

export interface SanityCategory {
  _id: string;
  title: string;
  slug: string;
  description?: string;
}

export interface SanityAuthor {
  _id: string;
  name: string;
  role: string;
  bio?: string;
  image?: SanityImageField;
}

export interface SanityImageField {
  asset: {
    _ref: string;
    _type: 'reference';
  };
  alt?: string;
  caption?: string;
  hotspot?: { x: number; y: number; width: number; height: number };
}

export interface SanityPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: SanityCategory;
  author: SanityAuthor;
  publishedAt: string;
  readTime: string;
  featuredImage?: SanityImageField;
  body: PortableTextBlock[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
  };
}
