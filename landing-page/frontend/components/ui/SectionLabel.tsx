interface SectionLabelProps {
  children: React.ReactNode;
  dark?: boolean;
}

export function SectionLabel({ children, dark }: SectionLabelProps) {
  return (
    <span
      className={`text-overline uppercase tracking-wider font-medium ${
        dark ? 'text-primary' : 'text-primary'
      }`}
    >
      {children}
    </span>
  );
}
