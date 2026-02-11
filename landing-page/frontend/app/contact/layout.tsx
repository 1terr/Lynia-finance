import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact — Lynia Finance',
  description:
    'Get in touch with Lynia Finance. Reach us via WhatsApp, email, or fill out a partnership application.',
  openGraph: {
    title: 'Contact — Lynia Finance',
    description:
      'Get in touch with Lynia Finance. Reach us via WhatsApp, email, or fill out a partnership application.',
    url: '/contact',
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
