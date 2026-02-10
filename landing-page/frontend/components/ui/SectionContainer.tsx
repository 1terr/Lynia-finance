interface SectionContainerProps {
  children: React.ReactNode;
  background?: 'white' | 'light' | 'dark' | 'gradient-stats' | 'gradient-cta' | 'gradient-hero';
  compact?: boolean;
  className?: string;
  id?: string;
}

const bgStyles: Record<string, string> = {
  white: 'bg-white',
  light: 'bg-primary-light',
  dark: 'bg-navy',
  'gradient-stats': 'bg-gradient-to-br from-navy to-primary',
  'gradient-cta': 'bg-gradient-to-br from-navy to-navy-light',
  'gradient-hero': '',
};

export function SectionContainer({
  children,
  background = 'white',
  compact = false,
  className = '',
  id,
}: SectionContainerProps) {
  const padding = compact ? 'py-16 lg:py-20' : 'py-16 lg:py-[120px]';

  return (
    <section
      id={id}
      className={`${bgStyles[background]} ${padding} ${className}`}
    >
      <div className="container-main">{children}</div>
    </section>
  );
}
