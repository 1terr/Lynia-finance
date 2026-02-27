import Link from 'next/link';
import { SOCIAL_LINKS } from '@/lib/constants';

const footerColumns = [
  {
    title: 'Products',
    links: [
      { label: 'Digital Credit', href: '/products#digital-credit' },
      { label: 'Embedded Credit', href: '/products#embedded-credit' },
      { label: 'Asset-Backed Credit', href: '/products#asset-backed-credit' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Thesis', href: '/thesis' },
      { label: 'Press', href: '/press' },
      { label: 'RBZ Compliance', href: '/compliance' },
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
    <footer className="bg-white border-t border-border">
      <div className="container-main pt-16 pb-8">
        {/* Logo + tagline */}
        <div className="mb-10">
          <span className="text-subheading text-primary-dark">Lynia Finance</span>
          <p className="text-body-sm text-slate mt-2 italic">
            Built for the productive majority.
          </p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="text-caption uppercase tracking-wide text-slate-light mb-4">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => {
                  const cls = "text-body-sm text-slate hover:text-primary-dark transition-colors duration-150";
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
        <div className="border-t border-border pt-8">
          <p className="text-caption text-muted">
            &copy; {new Date().getFullYear()} Lynia Finance. All rights reserved.
          </p>
          <p className="text-caption text-muted mt-1">
            Regulated by the Reserve Bank of Zimbabwe.
          </p>
        </div>
      </div>
    </footer>
  );
}
