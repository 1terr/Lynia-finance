import { SectionLabel } from './SectionLabel';

interface SectionHeadingProps {
  overline: string;
  title: string;
  subtitle?: string;
  isVisible: boolean;
  dark?: boolean;
  titleDelay?: string;
  subtitleDelay?: string;
}

export function SectionHeading({
  overline,
  title,
  subtitle,
  isVisible,
  dark,
  titleDelay = '60ms',
  subtitleDelay = '120ms',
}: SectionHeadingProps) {
  return (
    <>
      <SectionLabel dark={dark} isVisible={isVisible}>{overline}</SectionLabel>
      <h2
        className={`text-display-mobile md:text-display-tablet lg:text-display mt-4 fade-in ${
          dark ? 'text-white' : 'text-primary-dark'
        } ${isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'}`}
        style={{ transitionDelay: titleDelay }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-body-lg max-w-[640px] mt-6 fade-in ${
            dark ? 'text-white/70' : 'text-slate'
          } ${isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'}`}
          style={{ transitionDelay: subtitleDelay }}
        >
          {subtitle}
        </p>
      )}
    </>
  );
}
