interface SectionLabelProps {
  children: React.ReactNode;
  dark?: boolean;
  isVisible?: boolean;
}

export function SectionLabel({ children, dark, isVisible }: SectionLabelProps) {
  const color = dark ? 'text-white/80' : 'text-primary';
  const animation =
    isVisible !== undefined
      ? `fade-in ${isVisible ? 'fade-in-visible' : 'fade-in-hidden-sm'}`
      : '';

  return (
    <span
      className={`text-overline uppercase tracking-wider font-medium ${color} ${animation}`}
    >
      {children}
    </span>
  );
}
