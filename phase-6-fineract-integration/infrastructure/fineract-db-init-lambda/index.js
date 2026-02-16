const { Client } = require('pg');

// CloudFormation Custom Resource response helper
async function sendResponse(event, status, reason) {
  const body = JSON.stringify({
    Status: status,
    Reason: reason || '',
    PhysicalResourceId: 'fineract-db-init',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  });

  const url = new URL(event.ResponseURL);
  const https = require('https');

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'PUT',
        headers: { 'Content-Type': '', 'Content-Length': body.length },
      },
      (res) => resolve(res.statusCode)
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify({ ...event, ResponseURL: '***' }));

  // Only run on Create, skip Update/Delete
  if (event.RequestType !== 'Create') {
    return sendResponse(event, 'SUCCESS', 'Skipped (not a Create event)');
  }

  const host = process.env.RDS_HOST;
  const port = parseInt(process.env.RDS_PORT || '5432');
  const adminUser = process.env.DB_ADMIN_USER;
  const adminPass = process.env.DB_ADMIN_PASSWORD;
  const fineractUser = process.env.FINERACT_DB_USER || 'fineract_admin';
  const fineractPass = process.env.FINERACT_DB_PASSWORD;

  const adminClient = new Client({
    host,
    port,
    user: adminUser,
    password: adminPass,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await adminClient.connect();
    console.log('Connected to RDS');

    // Step 1: Create fineract_admin user if not exists
    const userExists = await adminClient.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [fineractUser]
    );
    if (userExists.rows.length === 0) {
      // Use SET ROLE to avoid SQL injection - parameterized DDL not supported
      await adminClient.query(
        `CREATE ROLE ${fineractUser} WITH LOGIN PASSWORD '${fineractPass.replace(/'/g, "''")}'`
      );
      console.log(`Created user ${fineractUser}`);
    } else {
      await adminClient.query(
        `ALTER ROLE ${fineractUser} WITH PASSWORD '${fineractPass.replace(/'/g, "''")}'`
      );
      console.log(`User ${fineractUser} already exists, password updated`);
    }

    // Step 2: Create fineract_tenants database
    const tenantsExists = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'fineract_tenants'"
    );
    if (tenantsExists.rows.length === 0) {
      await adminClient.query(
        `CREATE DATABASE fineract_tenants OWNER ${fineractUser}`
      );
      console.log('Created database fineract_tenants');
    } else {
      console.log('Database fineract_tenants already exists');
    }

    // Step 3: Create fineract_default database
    const defaultExists = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'fineract_default'"
    );
    if (defaultExists.rows.length === 0) {
      await adminClient.query(
        `CREATE DATABASE fineract_default OWNER ${fineractUser}`
      );
      console.log('Created database fineract_default');
    } else {
      console.log('Database fineract_default already exists');
    }

    await adminClient.end();

    // Step 4: Grant privileges on each database
    for (const dbName of ['fineract_tenants', 'fineract_default']) {
      const dbClient = new Client({
        host,
        port,
        user: adminUser,
        password: adminPass,
        database: dbName,
        ssl: { rejectUnauthorized: false },
      });
      await dbClient.connect();
      await dbClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${fineractUser}`);
      await dbClient.query(`GRANT ALL PRIVILEGES ON SCHEMA public TO ${fineractUser}`);
      await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${fineractUser}`);
      await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${fineractUser}`);
      await dbClient.end();
      console.log(`Granted privileges on ${dbName}`);
    }

    console.log('All Fineract databases initialized successfully');
    return sendResponse(event, 'SUCCESS', 'Fineract databases initialized');
  } catch (err) {
    console.error('Error:', err.message);
    return sendResponse(event, 'FAILED', err.message);
  }
};
