import { SectionLabel } from './SectionLabel';

interface SectionHeadingProps {
  overline: string;
  title: string;
  subtitle?: string;
  isVisible: boolean;
  titleDelay?: string;
  subtitleDelay?: string;
}

export function SectionHeading({
  overline,
  title,
  subtitle,
  isVisible,
  titleDelay = '60ms',
  subtitleDelay = '120ms',
}: SectionHeadingProps) {
  return (
    <>
      <SectionLabel isVisible={isVisible}>{overline}</SectionLabel>
      <h2
        className={`text-display-mobile md:text-display-tablet lg:text-display text-primary-dark mt-4 fade-in ${
          isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
        }`}
        style={{ transitionDelay: titleDelay }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-body-lg text-slate max-w-[640px] mt-6 fade-in ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
          }`}
          style={{ transitionDelay: subtitleDelay }}
        >
          {subtitle}
        </p>
      )}
    </>
  );
}
