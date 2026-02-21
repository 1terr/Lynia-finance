import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RBZ Compliance — Lynia Finance',
  description:
    'Lynia Finance operates in compliance with the Reserve Bank of Zimbabwe regulations and the National Financial Inclusion Strategy.',
};

export default function CompliancePage() {
  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section className="bg-primary-light py-16 lg:py-20">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            REGULATORY COMPLIANCE
          </span>
          <h1 className="text-display-mobile lg:text-display text-primary-dark mt-4">
            RBZ Compliance
          </h1>
          <p className="text-body-lg text-slate mt-4 max-w-[600px]">
            Lynia Finance operates within the regulatory framework established
            by the Reserve Bank of Zimbabwe.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <div className="max-w-[780px] space-y-12">
            {/* KYC */}
            <div>
              <h2 className="text-heading-mobile lg:text-heading text-primary-dark">
                Know Your Customer (KYC)
              </h2>
              <p className="text-body text-slate mt-4">
                All customers undergo identity verification in accordance with
                RBZ requirements. We verify national IDs, collect proof of
                residence for loans exceeding $500, and require source of income
                declarations for loans above $1,000.
              </p>
            </div>

            {/* Transaction limits */}
            <div>
              <h2 className="text-heading-mobile lg:text-heading text-primary-dark">
                Transaction Limits
              </h2>
              <div className="mt-4 grid sm:grid-cols-3 gap-6">
                <div className="p-4 bg-primary-light rounded-lg">
                  <p className="text-subheading text-primary-dark">$5,000</p>
                  <p className="text-body-sm text-slate mt-1">Daily limit (USD equivalent)</p>
                </div>
                <div className="p-4 bg-primary-light rounded-lg">
                  <p className="text-subheading text-primary-dark">$50,000</p>
                  <p className="text-body-sm text-slate mt-1">Monthly limit (USD equivalent)</p>
                </div>
                <div className="p-4 bg-primary-light rounded-lg">
                  <p className="text-subheading text-primary-dark">$2,000</p>
                  <p className="text-body-sm text-slate mt-1">Single transaction limit</p>
                </div>
              </div>
            </div>

            {/* Record retention */}
            <div>
              <h2 className="text-heading-mobile lg:text-heading text-primary-dark">
                Record Retention
              </h2>
              <p className="text-body text-slate mt-4">
                In compliance with RBZ directives, we maintain:
              </p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="text-body text-slate">
                    Transaction records for <span className="font-medium text-primary-dark">7 years</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="text-body text-slate">
                    KYC documents for <span className="font-medium text-primary-dark">10 years</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="text-body text-slate">
                    Audit logs for <span className="font-medium text-primary-dark">5 years</span>
                  </span>
                </li>
              </ul>
            </div>

            {/* Reporting */}
            <div>
              <h2 className="text-heading-mobile lg:text-heading text-primary-dark">
                Reporting Obligations
              </h2>
              <p className="text-body text-slate mt-4">
                We submit Suspicious Transaction Reports (STRs) within 24 hours
                of detection, provide monthly transaction reports to the Reserve
                Bank of Zimbabwe, and undergo annual compliance audits.
              </p>
            </div>

            {/* Multi-currency */}
            <div>
              <h2 className="text-heading-mobile lg:text-heading text-primary-dark">
                Multi-Currency Support
              </h2>
              <p className="text-body text-slate mt-4">
                All amounts are stored and displayed in their original currency.
                We support USD, ZWL, and ZAR in compliance with Zimbabwe&apos;s
                multi-currency framework.
              </p>
            </div>

            {/* Data protection */}
            <div>
              <h2 className="text-heading-mobile lg:text-heading text-primary-dark">
                Data Protection
              </h2>
              <p className="text-body text-slate mt-4">
                All personally identifiable information is encrypted at rest and
                in transit. We use TLS 1.3 for all communications, implement
                field-level encryption for sensitive data, and maintain strict
                access controls audited on a quarterly basis.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
