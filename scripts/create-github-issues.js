#!/usr/bin/env node

/**
 * Script to create GitHub issues from tasks.md
 *
 * Usage:
 *   node scripts/create-github-issues.js [--phase PHASE] [--dry-run]
 *
 * Options:
 *   --phase PHASE   Only create issues for specific phase (e.g., "Phase 0", "Phase 1")
 *   --dry-run       Preview issues without creating them
 *   --limit N       Limit number of issues to create (for testing)
 *
 * Prerequisites:
 *   - GitHub CLI (gh) must be installed and authenticated
 *   - Run: gh auth login
 */

const fs = require('fs');
const { execSync } = require('child_process');

// Configuration
const TASKS_FILE = './lynia-specs/lynia-lending/tasks.md';
const REPO = '1terr/Lynia-finance';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Get phase filter (skip if --dry-run or --limit)
let phaseFilter = null;
const phaseIndex = args.indexOf('--phase');
if (phaseIndex !== -1 && phaseIndex + 1 < args.length) {
  const nextArg = args[phaseIndex + 1];
  if (!nextArg.startsWith('--')) {
    phaseFilter = nextArg;
  }
}

// Get limit
let limit = null;
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && limitIndex + 1 < args.length) {
  limit = parseInt(args[limitIndex + 1]);
}

console.log('🚀 GitHub Issue Creator for Lynia Finance');
console.log('==========================================\n');
console.log(`📁 Reading tasks from: ${TASKS_FILE}`);
console.log(`🎯 Target repository: ${REPO}`);
if (phaseFilter) console.log(`🔍 Filter: ${phaseFilter} only`);
if (limit) console.log(`⚠️  Limit: Creating max ${limit} issues`);
if (dryRun) console.log('🔬 DRY RUN MODE - No issues will be created\n');

/**
 * Parse tasks.md and extract task information
 */
function parseTasks(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const tasks = [];
  let currentPhase = null;
  let currentSection = null;
  let inTaskDescription = false;
  let currentTask = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect phase headers: ## Phase 0: Research
    const phaseMatch = line.match(/^## (Phase \d+[^(]*)/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim();
      currentSection = null;
      continue;
    }

    // Detect section headers: ### R0.1: Apache Fineract
    const sectionMatch = line.match(/^### (.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    // Detect task lines: - [ ] T001 [P] [M0] Description
    const taskMatch = line.match(/^- \[ \] (T\d+[a-z]?)\s*(\[P\])?\s*(\[[^\]]+\])?\s*(.+)$/);

    if (taskMatch) {
      // Save previous task if exists
      if (currentTask) {
        tasks.push(currentTask);
      }

      const [, taskId, parallel, milestone, description] = taskMatch;

      currentTask = {
        id: taskId,
        title: description.trim(),
        parallel: !!parallel,
        milestone: milestone?.replace(/[\[\]]/g, ''),
        phase: currentPhase,
        section: currentSection,
        description: '',
        subtasks: [],
        labels: []
      };

      inTaskDescription = false;
      continue;
    }

    // Detect subtask description (indented content after task)
    if (currentTask && line.match(/^  \-/)) {
      // This is a subtask or detail line
      currentTask.description += line.trim() + '\n';
      inTaskDescription = true;
      continue;
    }

    // Continue capturing task description if indented
    if (currentTask && inTaskDescription && line.match(/^  /)) {
      currentTask.description += line.trim() + '\n';
    } else if (currentTask && line.trim() === '') {
      // Empty line might end task description
      inTaskDescription = false;
    }
  }

  // Add last task
  if (currentTask) {
    tasks.push(currentTask);
  }

  // Assign labels based on task metadata
  tasks.forEach(task => {
    if (task.milestone) task.labels.push(task.milestone);
    if (task.parallel) task.labels.push('parallel');
    if (task.phase?.includes('Phase 0')) task.labels.push('research');
    if (task.phase?.includes('Phase 1')) task.labels.push('design');
    if (task.phase?.includes('Phase 2')) task.labels.push('foundation');
    if (task.phase?.match(/Phase [3-8]/)) task.labels.push('user-story');
    if (task.phase?.match(/Phase (9|10|11|12)/)) task.labels.push('admin');
    if (task.section?.includes('Tests')) task.labels.push('testing');
  });

  return tasks;
}

/**
 * Create a GitHub issue
 */
function createGitHubIssue(task) {
  // Build issue body
  let body = '';

  if (task.phase) {
    body += `**Phase:** ${task.phase}\n`;
  }

  if (task.section) {
    body += `**Section:** ${task.section}\n`;
  }

  if (task.milestone) {
    body += `**Milestone:** ${task.milestone}\n`;
  }

  if (task.parallel) {
    body += `**Can run in parallel:** Yes ✅\n`;
  }

  body += '\n---\n\n';

  if (task.description) {
    body += task.description + '\n';
  } else {
    body += `This task is part of ${task.phase || 'the project'} and needs to be completed.\n\n`;
    body += `Refer to [tasks.md](https://github.com/${REPO}/blob/master/lynia-specs/lynia-lending/tasks.md) for full context.\n`;
  }

  // Build labels string
  const labels = task.labels.length > 0 ? task.labels.join(',') : '';

  // Build gh command
  const title = `${task.id}: ${task.title}`;
  const escapedBody = body.replace(/`/g, '\\`').replace(/"/g, '\\"');

  let command = `gh issue create --repo ${REPO} --title "${title}" --body "${escapedBody}"`;

  if (labels) {
    command += ` --label "${labels}"`;
  }

  return command;
}

/**
 * Main execution
 */
function main() {
  // Parse tasks
  console.log('📋 Parsing tasks...\n');
  const allTasks = parseTasks(TASKS_FILE);
  console.log(`✅ Found ${allTasks.length} total tasks\n`);

  // Filter by phase if specified
  let tasks = allTasks;
  if (phaseFilter) {
    tasks = allTasks.filter(task =>
      task.phase?.toLowerCase().includes(phaseFilter.toLowerCase())
    );
    console.log(`🔍 Filtered to ${tasks.length} tasks in ${phaseFilter}\n`);
  }

  // Apply limit if specified
  if (limit && tasks.length > limit) {
    console.log(`⚠️  Limiting to first ${limit} tasks\n`);
    tasks = tasks.slice(0, limit);
  }

  if (tasks.length === 0) {
    console.log('❌ No tasks found matching criteria');
    return;
  }

  // Preview tasks
  console.log('📝 Tasks to be created:\n');
  tasks.forEach((task, index) => {
    console.log(`${index + 1}. ${task.id}: ${task.title}`);
    console.log(`   Phase: ${task.phase || 'N/A'}`);
    console.log(`   Labels: ${task.labels.join(', ') || 'none'}`);
    console.log();
  });

  if (dryRun) {
    console.log('🔬 DRY RUN - Stopping here. Remove --dry-run to create issues.');

    // Show example of first issue
    if (tasks.length > 0) {
      console.log('\n📄 Example issue (first task):');
      console.log('================================');
      const cmd = createGitHubIssue(tasks[0]);
      console.log(cmd);
    }
    return;
  }

  // Confirm with user
  console.log(`\n⚠️  About to create ${tasks.length} GitHub issues in ${REPO}`);
  console.log('Starting in 3 seconds...\n');

  // Wait 3 seconds (Windows compatible)
  const waitMs = 3000;
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    // Busy wait for compatibility
  }

  // Create issues
  console.log('🚀 Creating issues...\n');

  let created = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      const command = createGitHubIssue(task);
      const result = execSync(command, { encoding: 'utf-8' });

      console.log(`✅ Created: ${task.id} - ${result.trim()}`);
      created++;

      // Rate limiting: wait 1 second between requests (Windows compatible)
      const start = Date.now();
      while (Date.now() - start < 1000) {
        // Busy wait
      }
    } catch (error) {
      console.error(`❌ Failed: ${task.id} - ${error.message}`);
      failed++;
    }
  }

  console.log('\n=====================================');
  console.log('📊 Summary:');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📋 Total: ${tasks.length}`);
  console.log('=====================================\n');

  console.log(`🔗 View issues: https://github.com/${REPO}/issues`);
}

// Run
try {
  main();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
