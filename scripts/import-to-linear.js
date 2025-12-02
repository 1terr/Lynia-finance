#!/usr/bin/env node
/**
 * Linear Import Script for Phase 1 Tasks P1-T031 to P1-T045
 *
 * Usage:
 *   1. Set LINEAR_API_KEY environment variable
 *   2. Set LINEAR_TEAM_ID environment variable (optional)
 *   3. Run: node scripts/import-to-linear.js
 *
 * Get your Linear API key: https://linear.app/settings/api
 */

const https = require('https');

// Configuration
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID; // Optional, will prompt if not set

if (!LINEAR_API_KEY) {
  console.error('❌ Error: LINEAR_API_KEY environment variable not set');
  console.error('\nTo get your API key:');
  console.error('1. Go to https://linear.app/settings/api');
  console.error('2. Create a new Personal API Key');
  console.error('3. Set it: export LINEAR_API_KEY="your-key-here"');
  console.error('4. Run this script again\n');
  process.exit(1);
}

// Phase 1 Tasks P1-T031 to P1-T045
const tasks = [
  {
    title: 'P1-T031: Privacy & Consent Management',
    description: `Design privacy and consent management framework for customer data handling.

**Acceptance Criteria**:
- [ ] Privacy policy document created
- [ ] Consent collection flow designed
- [ ] Data retention policies defined
- [ ] GDPR/POPIA compliance reviewed
- [ ] Customer data access/deletion workflows designed

**Specification File**: planning/privacy-consent-management.md
**GitHub Issue**: #104`,
    priority: 1, // High
    estimate: 4,
    labels: ['phase-1', 'kyc', 'high-priority']
  },
  {
    title: 'P1-T032: Device Catalog Design',
    description: `Design device catalog structure including device specifications, pricing, and inventory management.

**Acceptance Criteria**:
- [ ] Device catalog schema designed
- [ ] Device pricing model defined
- [ ] Device specifications template created
- [ ] Inventory tracking approach defined
- [ ] Device availability logic designed
- [ ] Multi-product support (Smartphone Financing)

**Specification File**: planning/device-catalog-design.md
**GitHub Issue**: #105

**Key Requirements**:
- Support for multiple device types (smartphones, tablets)
- Device attributes: brand, model, storage, color, condition
- Pricing: retail_price, loan_amount, deposit_amount (20%)
- Inventory tracking per distributor
- Device images and descriptions`,
    priority: 1, // High
    estimate: 6,
    labels: ['phase-1', 'device-management', 'high-priority']
  },
  {
    title: 'P1-T033: Device Lock/Unlock Integration',
    description: `Design integration with device lock/unlock APIs (Google Find My Device, Samsung Knox) for payment enforcement.

**Acceptance Criteria**:
- [ ] Device lock API options researched (Google, Samsung, MDM)
- [ ] Lock/unlock trigger logic designed
- [ ] Lock notification flow designed
- [ ] Unlock upon payment confirmation designed
- [ ] Manual admin override workflow designed
- [ ] Lock event audit trail designed

**Specification File**: planning/device-lock-unlock-integration.md
**GitHub Issue**: #106

**Key Requirements**:
- Automated lock after 7 days overdue
- Lock notification to customer (WhatsApp)
- Automatic unlock upon payment confirmation
- Admin manual unlock capability
- Lock status tracking in database
- Support for Google and Samsung devices

**Lock Triggers**: Payment 7+ days overdue, Loan defaulted
**Unlock Triggers**: Payment received, Admin override`,
    priority: 0, // Critical
    estimate: 8,
    labels: ['phase-1', 'device-management', 'critical']
  },
  {
    title: 'P1-T034: Device Handover Process',
    description: `Design device handover process from distributor to customer with mandatory deposit enforcement.

**Acceptance Criteria**:
- [ ] Handover workflow designed (10 steps)
- [ ] Deposit verification logic designed (blocks handover if not paid)
- [ ] Distributor notification system designed
- [ ] Device verification checklist created
- [ ] Serial number tracking designed
- [ ] Handover confirmation process designed
- [ ] Repayment schedule generation designed

**Specification File**: planning/device-handover-process.md
**GitHub Issue**: #107

**CRITICAL**: NO CASH ON DELIVERY - deposit must be confirmed before handover
**Deposit**: 20% of device value
**Flow**: Approval → Deposit Payment → Verification → Notification → Appointment → Handover → Active Loan`,
    priority: 1, // High
    estimate: 6,
    labels: ['phase-1', 'device-management', 'high-priority']
  },
  {
    title: 'P1-T035: Device Return/Repossession Flow',
    description: `Design device return and repossession workflows for defaults and voluntary returns.

**Acceptance Criteria**:
- [ ] Voluntary return process designed
- [ ] Repossession trigger logic designed (30+ days default)
- [ ] Device recovery workflow designed
- [ ] Device condition check process designed
- [ ] Refund/settlement calculation designed
- [ ] Return notification flows designed

**Specification File**: planning/device-return-repossession-flow.md
**GitHub Issue**: #108

**Triggers**: 30+ days overdue, Voluntary return, Fraud/breach`,
    priority: 2, // Medium
    estimate: 4,
    labels: ['phase-1', 'device-management', 'medium-priority']
  },
  {
    title: 'P1-T036: Device Condition Assessment',
    description: `Design device condition assessment criteria and workflow for returns and trade-ins.

**Acceptance Criteria**:
- [ ] Device condition criteria defined (excellent, good, fair, poor)
- [ ] Condition assessment checklist created
- [ ] Photo documentation requirements defined
- [ ] Value adjustment logic designed
- [ ] Condition tracking in database designed

**Specification File**: planning/device-condition-assessment.md
**GitHub Issue**: #109

**Condition Grades**: Excellent (100%), Good (80%), Fair (60%), Poor (40%), Damaged (20%)`,
    priority: 3, // Low
    estimate: 4,
    labels: ['phase-1', 'device-management', 'low-priority']
  },
  {
    title: 'P1-T037: Multi-Channel Notification Design',
    description: `Design multi-channel notification system (WhatsApp, SMS, Email) with fallback logic.

**Acceptance Criteria**:
- [ ] Notification channels defined (WhatsApp primary, SMS fallback)
- [ ] Channel priority/fallback logic designed
- [ ] Notification delivery tracking designed
- [ ] Failed delivery retry logic designed
- [ ] Notification preferences management designed
- [ ] Opt-out/unsubscribe logic designed

**Specification File**: planning/multi-channel-notification-design.md
**GitHub Issue**: #110

**Channels**: WhatsApp (primary), SMS (fallback), Email (admin)
**Retry**: 3 attempts with exponential backoff`,
    priority: 1, // High
    estimate: 6,
    labels: ['phase-1', 'notifications', 'high-priority']
  },
  {
    title: 'P1-T038: Notification Templates & Triggers',
    description: `Design notification templates and automated trigger events for all customer touchpoints.

**Acceptance Criteria**:
- [ ] All notification templates created (15+ templates)
- [ ] Trigger events defined
- [ ] Template variables identified
- [ ] Multi-language support designed (English, Shona)
- [ ] Template versioning designed
- [ ] A/B testing approach designed

**Specification File**: planning/notification-templates-triggers.md
**GitHub Issue**: #111

**Types**: Onboarding, Payment, Device, Support
**Languages**: English, Shona`,
    priority: 1, // High
    estimate: 6,
    labels: ['phase-1', 'notifications', 'high-priority']
  },
  {
    title: 'P1-T039: Payment Reminder Strategy',
    description: `Design payment reminder strategy and escalation logic to reduce defaults.

**Acceptance Criteria**:
- [ ] Reminder schedule designed (7, 3, 1 days before due)
- [ ] Escalation logic designed (1, 7, 14, 30 days overdue)
- [ ] Reminder messaging tone defined
- [ ] Grace period logic designed
- [ ] Device lock warning timeline designed
- [ ] Default prevention tactics designed

**Specification File**: planning/payment-reminder-strategy.md
**GitHub Issue**: #112

**Pre-Due**: -7, -3, -1 days
**Post-Due**: +1, +3, +5 (lock warning), +7 (lock), +14, +30 days
**Tone**: Friendly → Professional → Urgent → Formal`,
    priority: 1, // High
    estimate: 4,
    labels: ['phase-1', 'notifications', 'high-priority']
  },
  {
    title: 'P1-T040: Notification Queue Management',
    description: `Design notification queue and delivery management system for reliability and scale.

**Acceptance Criteria**:
- [ ] Notification queue architecture designed (SQS/RabbitMQ)
- [ ] Priority queue logic designed
- [ ] Rate limiting strategy designed
- [ ] Dead letter queue designed
- [ ] Notification batching logic designed
- [ ] Queue monitoring designed

**Specification File**: planning/notification-delivery-tracking.md
**GitHub Issue**: #113

**Queue**: AWS SQS or RabbitMQ
**Priorities**: Critical, High, Normal, Low
**Rate Limits**: WhatsApp 80 msg/sec, SMS provider-dependent`,
    priority: 2, // Medium
    estimate: 4,
    labels: ['phase-1', 'notifications', 'medium-priority']
  },
  {
    title: 'P1-T041: Admin Dashboard Wireframes',
    description: `Design admin dashboard wireframes and user interface layouts for all management features.

**Acceptance Criteria**:
- [ ] Dashboard overview wireframe created
- [ ] Customer management wireframes created
- [ ] Loan management wireframes created
- [ ] Payment management wireframes created
- [ ] Device management wireframes created
- [ ] Reporting wireframes created
- [ ] Navigation structure defined
- [ ] Responsive design approach defined

**Specification File**: planning/admin-dashboard-overview.md
**GitHub Issue**: #114

**Screens**: Dashboard, Customers, Loans, Payments, Devices, Reports
**Design**: Clean, modern, responsive, dark mode, WCAG 2.1 AA`,
    priority: 2, // Medium
    estimate: 8,
    labels: ['phase-1', 'admin-dashboard', 'medium-priority']
  },
  {
    title: 'P1-T042: Admin User Roles & Permissions',
    description: `Design role-based access control (RBAC) system for admin users with granular permissions.

**Acceptance Criteria**:
- [ ] Admin roles defined (Super Admin, Manager, Support)
- [ ] Permission matrix created
- [ ] Role assignment workflow designed
- [ ] Permission enforcement logic designed
- [ ] Audit trail for admin actions designed
- [ ] Role management UI designed

**Specification File**: planning/admin-user-roles-permissions.md
**GitHub Issue**: #115

**Roles**: Super Admin (full), Manager (operations), Support (read-only + limited)
**Audit**: Log all admin actions with who, what, when, why`,
    priority: 1, // High
    estimate: 4,
    labels: ['phase-1', 'admin-dashboard', 'high-priority']
  },
  {
    title: 'P1-T043: Reporting Requirements',
    description: `Define reporting requirements and dashboard analytics for business intelligence.

**Acceptance Criteria**:
- [ ] Core reports identified (7 reports)
- [ ] Report filters defined (product, date range, status)
- [ ] Report data sources mapped
- [ ] Export formats defined (CSV, PDF)
- [ ] Report scheduling designed
- [ ] Performance metrics defined

**Specification File**: planning/reporting-requirements.md
**GitHub Issue**: #116

**Reports**: Loan Disbursement, Payment Collection, Default Rate, KYC Status, Device Management, Customer Acquisition, Portfolio Health
**Filters**: Product, Date Range, Distributor, Status, Tier
**NO P&L or Balance Sheet in Phase 2**`,
    priority: 2, // Medium
    estimate: 6,
    labels: ['phase-1', 'admin-dashboard', 'medium-priority']
  },
  {
    title: 'P1-T044: Manual Review Workflows',
    description: `Design manual review workflows for loan applications requiring human judgment.

**Acceptance Criteria**:
- [ ] Review trigger conditions defined
- [ ] Review queue design created
- [ ] Review checklist created
- [ ] Decision workflow designed (approve, reject, request info)
- [ ] Review SLA defined (1-2 business days)
- [ ] Review notification flows designed

**Specification File**: planning/manual-review-workflows.md
**GitHub Issue**: #117

**Triggers**: Score 600-649, KYC issues, Affordability concerns, Fraud flags
**SLA**: 1 business day target, 2 days max
**Decisions**: Approve, Reject, Request More Info`,
    priority: 1, // High
    estimate: 6,
    labels: ['phase-1', 'admin-dashboard', 'high-priority']
  },
  {
    title: 'P1-T045: Admin Notification System',
    description: `Design notification system for admin users to receive alerts and updates.

**Acceptance Criteria**:
- [ ] Admin notification types defined
- [ ] Notification channels designed (email, in-app)
- [ ] Notification preferences system designed
- [ ] Alert priority levels defined
- [ ] Notification aggregation logic designed
- [ ] Admin notification UI designed

**Specification File**: planning/admin-notification-system.md
**GitHub Issue**: #118

**Channels**: In-app (real-time), Email (configurable), SMS (critical only)
**Priorities**: Critical (immediate), High (1 hour), Medium (daily), Low (weekly)
**Preferences**: Per-user settings, channel preferences, DND hours`,
    priority: 3, // Low
    estimate: 4,
    labels: ['phase-1', 'admin-dashboard', 'low-priority']
  }
];

/**
 * Make GraphQL request to Linear API
 */
function linearRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(response.errors[0].message));
          } else {
            resolve(response.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Get team ID (or use provided one)
 */
async function getTeamId() {
  if (LINEAR_TEAM_ID) {
    console.log(`✓ Using team ID: ${LINEAR_TEAM_ID}`);
    return LINEAR_TEAM_ID;
  }

  console.log('Fetching teams...');
  const query = `
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;

  const data = await linearRequest(query);
  const teams = data.teams.nodes;

  if (teams.length === 0) {
    throw new Error('No teams found in your Linear workspace');
  }

  console.log('\nAvailable teams:');
  teams.forEach((team, i) => {
    console.log(`  ${i + 1}. ${team.name} (${team.key})`);
  });

  // Use first team by default
  const selectedTeam = teams[0];
  console.log(`\n✓ Using team: ${selectedTeam.name} (${selectedTeam.key})`);
  console.log(`  Set LINEAR_TEAM_ID="${selectedTeam.id}" to skip this prompt next time\n`);

  return selectedTeam.id;
}

/**
 * Create a single issue in Linear
 */
async function createIssue(teamId, task) {
  const mutation = `
    mutation IssueCreate($teamId: String!, $title: String!, $description: String, $priority: Int, $estimate: Int, $labelIds: [String!]) {
      issueCreate(
        input: {
          teamId: $teamId
          title: $title
          description: $description
          priority: $priority
          estimate: $estimate
          labelIds: $labelIds
        }
      ) {
        success
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  `;

  const variables = {
    teamId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    estimate: task.estimate
    // Note: labelIds would need to be fetched/created first
    // Skipping labels for simplicity
  };

  const data = await linearRequest(mutation, variables);

  if (data.issueCreate.success) {
    const issue = data.issueCreate.issue;
    console.log(`✓ Created ${issue.identifier}: ${issue.title}`);
    console.log(`  URL: ${issue.url}`);
    return issue;
  } else {
    throw new Error(`Failed to create issue: ${task.title}`);
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Linear Import: Phase 1 Tasks P1-T031 to P1-T045');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Get team ID
    const teamId = await getTeamId();

    // Import tasks
    console.log(`\nImporting ${tasks.length} tasks...\n`);
    const created = [];

    for (const task of tasks) {
      try {
        const issue = await createIssue(teamId, task);
        created.push(issue);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`✗ Failed to create ${task.title}: ${error.message}`);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`✓ Import complete! Created ${created.length}/${tasks.length} tasks`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (created.length > 0) {
      console.log('Created tasks:');
      created.forEach(issue => {
        console.log(`  • ${issue.identifier}: ${issue.title}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run import
main();
