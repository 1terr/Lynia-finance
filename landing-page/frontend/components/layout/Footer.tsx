const footerColumns = [
  {
    title: 'Products',
    links: [
      { label: 'Asset financing', href: '/#asset-financing' },
      { label: 'Digital credit', href: '/#digital-credit' },
      { label: 'Enterprise partnerships', href: '/#enterprise' },
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
      { label: 'X (Twitter)', href: 'https://x.com' },
      { label: 'LinkedIn', href: 'https://linkedin.com' },
      { label: 'WhatsApp', href: 'https://wa.me/263' },
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
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-body-sm text-white/70 hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
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
