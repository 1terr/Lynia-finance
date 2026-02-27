/**
 * Data Privacy Service (P3-T029)
 *
 * This file is a barrel re-export for backwards compatibility.
 * Implementation has been decomposed into:
 *  - data-privacy/consent-management.ts -- consent tracking, types, audit logging
 *  - data-privacy/pii-masking.ts        -- PII masking, anonymization, data export
 *  - data-privacy/data-retention.ts     -- breach notification, authority reporting
 *  - data-privacy/index.ts             -- barrel re-exports
 */
export * from './data-privacy/index';
