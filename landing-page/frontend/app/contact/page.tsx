'use client';

import { useState } from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { WHATSAPP_URL, CONTACT_EMAIL } from '@/lib/constants';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

function ContactForm() {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-8 text-center">
        <p className="text-h4 text-primary-dark font-medium">Message sent</p>
        <p className="text-body-sm text-slate mt-2">
          We&apos;ll get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-body-sm font-medium text-primary-dark mb-1.5">
          Name <span className="text-error">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full h-11 px-4 rounded-md border border-border bg-white text-body-sm text-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
          placeholder="Your full name"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-body-sm font-medium text-primary-dark mb-1.5">
          Phone number <span className="text-error">*</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          className="w-full h-11 px-4 rounded-md border border-border bg-white text-body-sm text-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
          placeholder="+263 7X XXX XXXX"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-body-sm font-medium text-primary-dark mb-1.5">
          Email <span className="text-slate-light text-caption">(optional)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="w-full h-11 px-4 rounded-md border border-border bg-white text-body-sm text-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-body-sm font-medium text-primary-dark mb-1.5">
          Message <span className="text-slate-light text-caption">(optional)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="w-full px-4 py-3 rounded-md border border-border bg-white text-body-sm text-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow resize-y"
          placeholder="How can we help?"
        />
      </div>
      {status === 'error' && (
        <p className="text-body-sm text-error">{errorMsg}</p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending\u2026' : 'Send message'}
      </Button>
    </form>
  );
}

function PartnershipForm() {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      partnerType: (form.elements.namedItem('partnerType') as HTMLSelectElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch('/api/partnership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-8 text-center">
        <p className="text-h4 text-primary-dark font-medium">Application received</p>
        <p className="text-body-sm text-slate mt-2">
          Our partnerships team will review your application and get in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="partner-name" className="block text-body-sm font-medium text-primary-dark mb-1.5">
            Name <span className="text-error">*</span>
          </label>
          <input
            id="partner-name"
            name="name"
            type="text"
            required
            className="w-full h-11 px-4 rounded-md border border-border bg-white text-body-sm text-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
            placeholder="Your full name"
          />
        </div>
        <div>
          <label htmlFor="partner-phone" className="block text-body-sm font-medium text-primary-dark mb-1.5">
            Phone number <span className="text-error">*</span>
          </label>
          <input
            id="partner-phone"
            name="phone"
            type="tel"
            required
            className="w-full h-11 px-4 rounded-md border border-border bg-white text-body-sm text-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
            placeholder="+263 7X XXX XXXX"
          />
        </div>
      </div>
      <div>
        <label htmlFor="partner-email" className="block text-body-sm font-medium text-primary-dark mb-1.5">
          Email <span className="text-error">*</span>
        </label>
        <input
          id="partner-email"
          name="email"
          type="email"
          required
          className="w-full h-11 px-4 rounded-md border border-border bg-white text-body-sm text-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="partner-type" className="block text-body-sm font-medium text-primary-dark mb-1.5">
          Type of partnership <span className="text-error">*</span>
        </label>
        <select
          id="partner-type"
          name="partnerType"
          required
          className="w-full h-11 px-4 rounded-md border border-border bg-white text-body-sm text-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
          defaultValue=""
        >
          <option value="" disabled>Select partnership type</option>
          <option value="distributor">Distributor</option>
          <option value="b2b">B2B Partnership</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="partner-message" className="block text-body-sm font-medium text-primary-dark mb-1.5">
          Message <span className="text-slate-light text-caption">(optional)</span>
        </label>
        <textarea
          id="partner-message"
          name="message"
          rows={3}
          className="w-full px-4 py-3 rounded-md border border-border bg-white text-body-sm text-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow resize-y"
          placeholder="Tell us about your business and partnership goals"
        />
      </div>
      {status === 'error' && (
        <p className="text-body-sm text-error">{errorMsg}</p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={status === 'submitting'}>
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
      <section className="bg-primary-light py-16 lg:py-20">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            CONTACT
          </span>
          <h1 className="text-h1-mobile lg:text-h1 text-primary-dark font-medium mt-4">
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
              <h2 className="text-h3 text-primary-dark font-medium">
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
                <h3 className="text-h4 text-primary-dark font-medium mb-6">
                  Send us a message
                </h3>
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership section */}
      <section className="bg-primary-light py-16 lg:py-20">
        <div className="container-main">
          <div className="max-w-narrow mx-auto">
            <span className="text-overline uppercase tracking-wider text-primary">
              PARTNERSHIPS
            </span>
            <h2 className="text-h2-mobile lg:text-h2 text-primary-dark font-medium mt-4">
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
