'use client';

import { MapPin, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormInput, FormTextarea, FormSelect } from '@/components/ui/FormInput';
import { WHATSAPP_URL, CONTACT_EMAIL } from '@/lib/constants';
import { useFormSubmit } from '@/lib/useFormSubmit';

function ContactForm() {
  const { status, errorMsg, handleSubmit } = useFormSubmit();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    await handleSubmit({
      type: 'contact',
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
      _hp: (form.elements.namedItem('_hp') as HTMLInputElement).value,
    });
  };

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-8 text-center">
        <p className="text-subheading text-primary-dark">Message sent</p>
        <p className="text-body-sm text-slate mt-2">
          We&apos;ll get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Honeypot — hidden from humans, catches bots that auto-fill */}
      <input type="text" name="_hp" autoComplete="off" tabIndex={-1} aria-hidden="true" className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none" />
      <FormInput id="name" name="name" type="text" required label="Name" placeholder="Your full name" />
      <FormInput id="phone" name="phone" type="tel" required label="Phone number" placeholder="+263 7X XXX XXXX" />
      <FormInput id="email" name="email" type="email" label="Email" optional placeholder="you@example.com" />
      <FormTextarea id="message" name="message" rows={4} label="Message" optional placeholder="How can we help?" />
      {status === 'error' && (
        <p className="text-body-sm text-error">{errorMsg}</p>
      )}
      <Button type="submit" variant="accent" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending\u2026' : 'Send message'}
      </Button>
    </form>
  );
}

function PartnershipForm() {
  const { status, errorMsg, handleSubmit } = useFormSubmit();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    await handleSubmit({
      type: 'partnership',
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      partner_type: (form.elements.namedItem('partnerType') as HTMLSelectElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
      _hp: (form.elements.namedItem('_hp_p') as HTMLInputElement).value,
    });
  };

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-8 text-center">
        <p className="text-subheading text-primary-dark">Application received</p>
        <p className="text-body-sm text-slate mt-2">
          Our partnerships team will review your application and get in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Honeypot — hidden from humans, catches bots that auto-fill */}
      <input type="text" name="_hp_p" autoComplete="off" tabIndex={-1} aria-hidden="true" className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none" />
      <div className="grid sm:grid-cols-2 gap-5">
        <FormInput id="partner-name" name="name" type="text" required label="Name" placeholder="Your full name" />
        <FormInput id="partner-phone" name="phone" type="tel" required label="Phone number" placeholder="+263 7X XXX XXXX" />
      </div>
      <FormInput id="partner-email" name="email" type="email" required label="Email" placeholder="you@example.com" />
      <FormSelect id="partner-type" name="partnerType" required label="Type of partnership" defaultValue="">
        <option value="" disabled>Select partnership type</option>
        <option value="distributor">Distributor</option>
        <option value="b2b">B2B Partnership</option>
        <option value="other">Other</option>
      </FormSelect>
      <FormTextarea id="partner-message" name="message" rows={3} label="Message" optional placeholder="Tell us about your business and partnership goals" />
      {status === 'error' && (
        <p className="text-body-sm text-error">{errorMsg}</p>
      )}
      <Button type="submit" variant="accent" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Submitting\u2026' : 'Submit partnership application'}
      </Button>
    </form>
  );
}

const contactMethods = [
  {
    icon: Phone,
    label: 'WhatsApp',
    value: 'Chat with us',
    href: WHATSAPP_URL,
  },
  {
    icon: Mail,
    label: 'Email',
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
  },
  {
    icon: MapPin,
    label: 'Location',
    value: 'Harare, Zimbabwe',
    href: undefined,
  },
];

export default function ContactPage() {
  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section className="bg-white py-16 lg:py-20">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            CONTACT
          </span>
          <h1 className="text-display-mobile md:text-display-tablet lg:text-display text-primary-dark mt-4">
            Get in touch
          </h1>
          <p className="text-body-lg text-slate mt-4 max-w-[600px]">
            Have a question about our products, want to become a distributor,
            or explore a partnership? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact form + info */}
      <section className="py-16 lg:py-20">
        <div className="container-main">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
            {/* Left — contact info */}
            <div className="lg:col-span-2">
              <h2 className="text-heading text-primary-dark">
                Contact methods
              </h2>
              <p className="text-body text-slate mt-3">
                Reach us through WhatsApp for the fastest response. We typically
                reply within a few hours during business days.
              </p>
              <div className="space-y-6 mt-8">
                {contactMethods.map((m) => {
                  const Icon = m.icon;
                  const content = (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-caption text-slate-light uppercase tracking-wide">
                          {m.label}
                        </p>
                        <p className="text-body-sm text-primary-dark font-medium mt-0.5">
                          {m.value}
                        </p>
                      </div>
                    </div>
                  );
                  return m.href ? (
                    <a key={m.label} href={m.href} className="block hover:opacity-80 transition-opacity">
                      {content}
                    </a>
                  ) : (
                    <div key={m.label}>{content}</div>
                  );
                })}
              </div>
            </div>

            {/* Right — contact form */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl border border-border p-6 lg:p-8 shadow-sm">
                <h3 className="text-subheading text-primary-dark mb-6">
                  Send us a message
                </h3>
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership section */}
      <section className="bg-white py-16 lg:py-20">
        <div className="container-main">
          <div className="max-w-narrow mx-auto">
            <span className="text-overline uppercase tracking-wider text-primary">
              PARTNERSHIPS
            </span>
            <h2 className="text-title-mobile md:text-title-tablet lg:text-title text-primary-dark mt-4">
              Become a Lynia partner
            </h2>
            <p className="text-body text-slate mt-4">
              Sell smartphones in your community as a distributor, or embed
              credit into your platform through our APIs. Apply below and our
              team will be in touch.
            </p>
            <div className="bg-white rounded-xl border border-border p-6 lg:p-8 shadow-sm mt-8">
              <PartnershipForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
