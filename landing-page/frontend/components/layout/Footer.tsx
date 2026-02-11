import Link from 'next/link';
import { SOCIAL_LINKS } from '@/lib/constants';

const footerColumns = [
  {
    title: 'Products',
    links: [
      { label: 'Asset financing', href: '/products#asset-financing' },
      { label: 'Digital credit', href: '/products#digital-credit' },
      { label: 'Enterprise partnerships', href: '/products#enterprise' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { label: 'X (Twitter)', href: SOCIAL_LINKS.twitter },
      { label: 'LinkedIn', href: SOCIAL_LINKS.linkedin },
      { label: 'WhatsApp', href: SOCIAL_LINKS.whatsapp },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

function isExternal(href: string) {
  return href.startsWith('http');
}

export function Footer() {
  return (
    <footer className="bg-navy">
      <div className="container-main pt-16 pb-8">
        {/* Logo */}
        <div className="mb-10">
          <span className="text-h4 font-medium text-white">Lynia Finance</span>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="text-caption uppercase tracking-wide text-white/40 mb-4">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => {
                  const cls = "text-body-sm text-white/70 hover:text-white transition-colors duration-150";
                  return (
                    <li key={link.label}>
                      {isExternal(link.href) ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cls}
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className={cls}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider + copyright */}
        <div className="border-t border-white/10 pt-8">
          <p className="text-caption text-white/30">
            &copy; {new Date().getFullYear()} Lynia Finance. All rights reserved.
          </p>
          <p className="text-caption text-white/30 mt-1">
            Regulated by the Reserve Bank of Zimbabwe.
          </p>
        </div>
      </div>
    </footer>
  );
}
