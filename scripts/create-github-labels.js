#!/usr/bin/env node

/**
 * Script to create GitHub labels for Lynia Finance project
 *
 * Usage:
 *   node scripts/create-github-labels.js
 *
 * Prerequisites:
 *   - GitHub CLI (gh) must be installed and authenticated
 *   - Run: gh auth login
 */

const { execSync } = require('child_process');

const REPO = '1terr/Lynia-finance';

console.log('🏷️  GitHub Label Creator for Lynia Finance');
console.log('==========================================\n');
console.log(`🎯 Target repository: ${REPO}\n`);

// Define all labels
const labels = [
  // Milestone labels (blue)
  { name: 'M0', description: 'Milestone 0: Research', color: '0366d6' },
  { name: 'M1', description: 'Milestone 1: Foundation', color: '0366d6' },
  { name: 'M2', description: 'Milestone 2: User Story 1 - Onboarding', color: '0366d6' },
  { name: 'M3', description: 'Milestone 3: User Story 2 - Payment (Part 1)', color: '0366d6' },
  { name: 'M4', description: 'Milestone 4: User Story 2 - Payment (Part 2)', color: '0366d6' },
  { name: 'M5', description: 'Milestone 5: User Story 3 - Collection (Part 1)', color: '0366d6' },
  { name: 'M6', description: 'Milestone 6: User Story 3 - Collection (Part 2)', color: '0366d6' },
  { name: 'M7', description: 'Milestone 7: User Story 4 - Repayment', color: '0366d6' },
  { name: 'M8', description: 'Milestone 8: User Story 5 - Extensions & Default', color: '0366d6' },
  { name: 'M9', description: 'Milestone 9: User Story 6 - Customer Service', color: '0366d6' },
  { name: 'M10', description: 'Milestone 10: User Stories 7-8 - Agent Features', color: '0366d6' },
  { name: 'M11', description: 'Milestone 11: Admin Portal', color: '0366d6' },
  { name: 'M12', description: 'Milestone 12: ML & Polish', color: '0366d6' },

  // Phase labels (green)
  { name: 'research', description: 'Phase 0: Research tasks', color: '0e8a16' },
  { name: 'design', description: 'Phase 1: Design tasks', color: '0e8a16' },
  { name: 'foundation', description: 'Phase 2: Foundation/infrastructure tasks', color: '0e8a16' },
  { name: 'user-story', description: 'Phase 3-8: User story implementation', color: '0e8a16' },
  { name: 'admin', description: 'Phase 9-12: Admin portal and ML', color: '0e8a16' },

  // Special labels
  { name: 'parallel', description: 'Can run in parallel with other tasks', color: 'fbca04' },
  { name: 'testing', description: 'Testing-related task (TDD)', color: 'd73a4a' },
  { name: 'blocked', description: 'Blocked by another task', color: 'b60205' },

  // Priority labels (orange/red)
  { name: 'P1', description: 'Priority 1: Critical MVP feature', color: 'd93f0b' },
  { name: 'P2', description: 'Priority 2: Important feature', color: 'ff9800' },
  { name: 'P3', description: 'Priority 3: Nice to have', color: 'ffc107' },
  { name: 'P4', description: 'Priority 4: Low priority', color: 'ffeb3b' },

  // User Story labels (purple)
  { name: 'US1', description: 'User Story 1: Customer Onboarding & KYC', color: '7057ff' },
  { name: 'US2', description: 'User Story 2: Asset Selection & Payment', color: '7057ff' },
  { name: 'US3', description: 'User Story 3: Asset Collection & Verification', color: '7057ff' },
  { name: 'US4', description: 'User Story 4: Repayment Management', color: '7057ff' },
  { name: 'US5', description: 'User Story 5: Extensions & Default Management', color: '7057ff' },
  { name: 'US6', description: 'User Story 6: Customer Service Escalation', color: '7057ff' },
  { name: 'US7', description: 'User Story 7: Agent Inventory & Handover', color: '7057ff' },
  { name: 'US8', description: 'User Story 8: Agent History & Alerts', color: '7057ff' },

  // Component labels (teal)
  { name: 'whatsapp-service', description: 'WhatsApp bot service', color: '00897b' },
  { name: 'kyc-service', description: 'KYC verification service', color: '00897b' },
  { name: 'payment-service', description: 'Payment processing service', color: '00897b' },
  { name: 'scoring-service', description: 'Credit scoring service', color: '00897b' },
  { name: 'inventory-service', description: 'Inventory management service', color: '00897b' },
  { name: 'lock-service', description: 'Device lock service', color: '00897b' },
  { name: 'admin-service', description: 'Admin portal backend', color: '00897b' },
  { name: 'fineract', description: 'Apache Fineract integration', color: '00897b' },
];

/**
 * Create a GitHub label
 */
function createLabel(label) {
  try {
    const command = `gh label create "${label.name}" --repo ${REPO} --description "${label.description}" --color ${label.color}`;
    execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    return { success: true, label: label.name };
  } catch (error) {
    // Check if label already exists
    if (error.message.includes('already exists')) {
      return { success: true, label: label.name, exists: true };
    }
    return { success: false, label: label.name, error: error.message };
  }
}

/**
 * Main execution
 */
function main() {
  console.log(`📋 Creating ${labels.length} labels...\n`);

  let created = 0;
  let existed = 0;
  let failed = 0;

  // Group labels by type for better output
  const labelsByType = {
    'Milestones': labels.filter(l => l.name.startsWith('M')),
    'Phases': labels.filter(l => ['research', 'design', 'foundation', 'user-story', 'admin'].includes(l.name)),
    'Priorities': labels.filter(l => l.name.startsWith('P')),
    'User Stories': labels.filter(l => l.name.startsWith('US')),
    'Special': labels.filter(l => ['parallel', 'testing', 'blocked'].includes(l.name)),
    'Components': labels.filter(l => l.name.includes('-service') || l.name === 'fineract'),
  };

  for (const [type, typeLabels] of Object.entries(labelsByType)) {
    console.log(`\n📌 ${type}:`);

    for (const label of typeLabels) {
      const result = createLabel(label);

      if (result.success) {
        if (result.exists) {
          console.log(`   ⚪ ${label.name} (already exists)`);
          existed++;
        } else {
          console.log(`   ✅ ${label.name}`);
          created++;
        }
      } else {
        console.log(`   ❌ ${label.name} - ${result.error}`);
        failed++;
      }
    }
  }

  console.log('\n=====================================');
  console.log('📊 Summary:');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⚪ Already existed: ${existed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📋 Total: ${labels.length}`);
  console.log('=====================================\n');

  console.log(`🔗 View labels: https://github.com/${REPO}/labels`);
  console.log('\n✨ Labels are ready! Now you can create issues with:');
  console.log('   node scripts/create-github-issues.js --phase "Phase 0"\n');
}

// Run
try {
  main();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
