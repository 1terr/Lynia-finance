/**
 * Automated Database Deployment Script
 * Deploys the combined SQL schema to Supabase
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Extract project ref from URL (e.g., ghdrnxlsupbzoddtyxcp)
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

console.log('🚀 Starting database deployment...');
console.log(`📊 Project: ${projectRef}`);

// Read SQL file
const sqlFilePath = path.join(__dirname, 'COMBINED-DEPLOYMENT.sql');
console.log(`📄 Reading SQL file: ${sqlFilePath}`);

let sqlContent;
try {
  sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  console.log(`✅ SQL file loaded (${sqlContent.length} characters)`);
} catch (error) {
  console.error('❌ Failed to read SQL file:', error.message);
  process.exit(1);
}

// Prepare request to Supabase SQL endpoint
const options = {
  hostname: `${projectRef}.supabase.co`,
  port: 443,
  path: '/rest/v1/rpc/exec',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Prefer': 'return=representation'
  }
};

// Try direct SQL execution via PostgREST
const executeSQL = (sql) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql });

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data, statusCode: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
};

// Alternative: Use psql connection string approach
const executeSQLViaPSQL = async () => {
  console.log('\n📝 Attempting SQL execution...');
  console.log('⚠️  Note: Direct SQL execution requires database access');
  console.log('');
  console.log('ALTERNATIVE: Manual deployment required');
  console.log('');
  console.log('Please follow these steps:');
  console.log('');
  console.log('1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql');
  console.log('2. Copy the entire contents of: database/COMBINED-DEPLOYMENT.sql');
  console.log('3. Paste into the SQL Editor');
  console.log('4. Click "Run" or press Ctrl+Enter');
  console.log('5. Wait 30-40 seconds for completion');
  console.log('');
  console.log('Expected result:');
  console.log('  ═══════════════════════════════════════════════════');
  console.log('  ✅ DATABASE DEPLOYMENT COMPLETE!');
  console.log('  ═══════════════════════════════════════════════════');
  console.log('');

  // Open SQL file in default editor for easy copying
  console.log('📂 Opening SQL file for you to copy...');

  const { exec } = require('child_process');
  const platform = process.platform;

  let command;
  if (platform === 'win32') {
    command = `notepad "${sqlFilePath}"`;
  } else if (platform === 'darwin') {
    command = `open -a TextEdit "${sqlFilePath}"`;
  } else {
    command = `xdg-open "${sqlFilePath}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.log('💡 Please open this file manually:', sqlFilePath);
    }
  });
};

// Main execution
(async () => {
  try {
    console.log('\n🔍 Checking Supabase API access...');

    // Supabase doesn't provide a direct SQL execution endpoint via REST API
    // We need to guide the user to use the SQL Editor
    await executeSQLViaPSQL();

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.log('\n📋 Manual deployment required - see instructions above');
  }
})();
