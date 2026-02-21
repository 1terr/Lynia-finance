import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Lynia Finance',
  description:
    'Terms and conditions governing the use of Lynia Finance services.',
  openGraph: {
    title: 'Terms of Service — Lynia Finance',
    description:
      'Terms and conditions governing the use of Lynia Finance services.',
    url: '/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="pt-[72px]">
      {/* Header */}
      <section className="bg-primary-light py-16 lg:py-20">
        <div className="container-main">
          <h1 className="text-display-mobile lg:text-display text-primary-dark">
            Terms of Service
          </h1>
          <p className="text-body text-slate mt-3">
            Last updated: February 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-narrow px-6 lg:px-12">
          <div className="space-y-10">
            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                1. Acceptance of terms
              </h2>
              <p className="text-body text-slate">
                By accessing or using any Lynia Finance services, including our
                WhatsApp-based lending platform, asset financing products, and
                digital credit services, you agree to be bound by these Terms of
                Service. If you do not agree, do not use our services.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                2. Eligibility
              </h2>
              <p className="text-body text-slate mb-3">
                To use Lynia Finance services, you must:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-body text-slate">
                <li>Be at least 18 years of age</li>
                <li>Be a resident of Zimbabwe</li>
                <li>Hold a valid Zimbabwean national identity document</li>
                <li>
                  Have an active mobile money account (EcoCash, OneMoney, or
                  InnBucks)
                </li>
                <li>
                  Provide accurate and complete information during registration
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                3. Services
              </h2>
              <p className="text-body text-slate mb-3">
                Lynia Finance provides the following services:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-body text-slate">
                <li>
                  <strong>Asset financing:</strong> Financing for smartphones
                  and productive assets, with repayment via mobile money.
                </li>
                <li>
                  <strong>Digital credit:</strong> Short-term cash loans
                  disbursed directly to your mobile wallet.
                </li>
                <li>
                  <strong>Enterprise partnerships:</strong> API-based credit
                  integration for third-party platforms.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                4. Loan terms and repayment
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-body text-slate">
                <li>
                  All loan amounts, interest rates, fees, and repayment
                  schedules will be clearly disclosed before you accept any loan
                  offer.
                </li>
                <li>
                  Repayments are due as per the agreed schedule. Late payments
                  may result in additional fees as disclosed at the time of
                  borrowing.
                </li>
                <li>
                  For asset financing, the financed device may be locked or
                  restricted if payments are overdue beyond the grace period.
                </li>
                <li>
                  You may repay your loan early without penalty unless otherwise
                  specified.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                5. Identity verification (KYC)
              </h2>
              <p className="text-body text-slate">
                As required by the Reserve Bank of Zimbabwe, we must verify your
                identity before providing financial services. You agree to
                provide accurate identification documents and to complete any
                verification steps requested. Providing false or fraudulent
                information is grounds for immediate account termination and may
                be reported to relevant authorities.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                6. Device management (asset financing)
              </h2>
              <p className="text-body text-slate">
                Devices financed through Lynia remain subject to a lien until
                fully paid off. We reserve the right to remotely lock a financed
                device if repayments fall significantly behind schedule.
                Emergency calling capabilities will always remain available
                regardless of lock status. Full device functionality is restored
                immediately upon payment.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                7. Privacy
              </h2>
              <p className="text-body text-slate">
                Your use of our services is also governed by our{' '}
                <a
                  href="/privacy"
                  className="text-primary hover:text-primary-hover underline"
                >
                  Privacy Policy
                </a>
                , which describes how we collect, use, and protect your personal
                information.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                8. Prohibited use
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-body text-slate">
                <li>
                  Using our services for money laundering, fraud, or any illegal
                  activity
                </li>
                <li>
                  Providing false information during registration or loan
                  applications
                </li>
                <li>
                  Attempting to bypass device management controls on financed
                  devices
                </li>
                <li>
                  Using another person&apos;s identity or mobile money account
                  without authorization
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                9. Limitation of liability
              </h2>
              <p className="text-body text-slate">
                To the maximum extent permitted by law, Lynia Finance shall not
                be liable for any indirect, incidental, or consequential damages
                arising from the use of our services, including but not limited
                to delays in payment processing, temporary device restrictions,
                or service interruptions caused by third-party providers.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                10. Governing law
              </h2>
              <p className="text-body text-slate">
                These Terms of Service are governed by the laws of the Republic
                of Zimbabwe. Any disputes arising from or relating to these
                terms shall be subject to the jurisdiction of the courts of
                Zimbabwe.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                11. Changes to these terms
              </h2>
              <p className="text-body text-slate">
                We may update these terms from time to time. Material changes
                will be communicated via WhatsApp or SMS at least 14 days before
                they take effect. Continued use of our services after changes
                take effect constitutes acceptance of the updated terms.
              </p>
            </div>

            <div>
              <h2 className="text-heading text-primary-dark mb-4">
                12. Contact
              </h2>
              <p className="text-body text-slate">
                For questions about these Terms of Service, contact us at{' '}
                <a
                  href="mailto:legal@lyniafinance.com"
                  className="text-primary hover:text-primary-hover underline"
                >
                  legal@lyniafinance.com
                </a>{' '}
                or visit our{' '}
                <a
                  href="/contact"
                  className="text-primary hover:text-primary-hover underline"
                >
                  contact page
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
