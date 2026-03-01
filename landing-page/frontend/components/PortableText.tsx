import { PortableText as PortableTextReact, type PortableTextComponents } from '@portabletext/react';
import type { PortableTextBlock } from '@portabletext/types';
import { urlFor } from '@/lib/sanity';

function getEmbedUrl(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const videoId = url.includes('youtu.be')
      ? url.split('youtu.be/')[1]?.split('?')[0]
      : new URL(url).searchParams.get('v');
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  }
  if (url.includes('vimeo.com')) {
    const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
    return `https://player.vimeo.com/video/${videoId}`;
  }
  return url;
}

const components: PortableTextComponents = {
  types: {
    image: ({ value }) => {
      if (!value?.asset?._ref) return null;
      return (
        <figure className="my-8">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlFor(value).width(1200).height(675).format('webp').url()}
              alt={value.alt || ''}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          {value.caption && (
            <figcaption className="text-caption text-slate mt-3 text-center">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
    videoEmbed: ({ value }) => {
      if (!value?.url) return null;
      return (
        <figure className="my-8">
          <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
            <iframe
              src={getEmbedUrl(value.url)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={value.caption || 'Video'}
            />
          </div>
          {value.caption && (
            <figcaption className="text-caption text-slate mt-3 text-center">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
  block: {
    h2: ({ children }) => (
      <h2 className="text-heading-mobile lg:text-heading text-primary-dark mt-12 mb-4">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-subheading text-primary-dark mt-8 mb-3">
        {children}
      </h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary pl-6 my-6 italic text-body text-slate">
        {children}
      </blockquote>
    ),
    normal: ({ children }) => (
      <p className="text-body text-slate leading-relaxed">{children}</p>
    ),
  },
  marks: {
    link: ({ children, value }) => {
      const rel = !value?.href?.startsWith('/') ? 'noopener noreferrer' : undefined;
      return (
        <a
          href={value?.href}
          rel={rel}
          target={value?.blank ? '_blank' : undefined}
          className="text-primary hover:text-primary-hover underline transition-colors"
        >
          {children}
        </a>
      );
    },
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ children }) => (
      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc list-outside ml-6 my-5 space-y-2">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal list-outside ml-6 my-5 space-y-2">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="text-body text-slate">{children}</li>,
    number: ({ children }) => <li className="text-body text-slate">{children}</li>,
  },
};

interface PortableTextProps {
  value: PortableTextBlock[];
}

export function PortableText({ value }: PortableTextProps) {
  return (
    <div className="space-y-5">
      <PortableTextReact value={value} components={components} />
    </div>
  );
}
