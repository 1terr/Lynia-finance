#!/bin/bash

# =====================================================
# Lynia Finance - Project Structure Setup Script
# =====================================================
# Creates all necessary folders for Phase 2 development
# Run from project root directory

echo "🚀 Creating Lynia Finance project structure..."
echo ""

# Create services directory structure
echo "📁 Creating services directories..."
mkdir -p services/shared/types
mkdir -p services/shared/utils
mkdir -p services/shared/clients

mkdir -p services/scoring-service/src/handlers
mkdir -p services/scoring-service/src/scoring
mkdir -p services/scoring-service/tests

mkdir -p services/whatsapp-service/src/handlers
mkdir -p services/whatsapp-service/src/flows
mkdir -p services/whatsapp-service/src/templates
mkdir -p services/whatsapp-service/tests

mkdir -p services/kyc-service/src/handlers
mkdir -p services/kyc-service/tests

mkdir -p services/payment-service/src/handlers
mkdir -p services/payment-service/src/providers
mkdir -p services/payment-service/tests

mkdir -p services/lock-service/src/handlers
mkdir -p services/lock-service/src/providers
mkdir -p services/lock-service/tests

mkdir -p services/notification-service/src/handlers
mkdir -p services/notification-service/tests

# Create frontend directories
echo "📁 Creating frontend directories..."
mkdir -p frontend/admin-portal/src/app
mkdir -p frontend/admin-portal/src/components
mkdir -p frontend/admin-portal/src/lib
mkdir -p frontend/admin-portal/public

mkdir -p frontend/distributor-dashboard/src/app
mkdir -p frontend/distributor-dashboard/src/components
mkdir -p frontend/distributor-dashboard/src/lib

# Database directories (already created but ensure they exist)
echo "📁 Creating database directories..."
mkdir -p database/migrations
mkdir -p database/seed
mkdir -p database/backups

# Infrastructure directories
echo "📁 Creating infrastructure directories..."
mkdir -p infrastructure/aws/lambda
mkdir -p infrastructure/aws/api-gateway
mkdir -p infrastructure/supabase
mkdir -p infrastructure/monitoring

# Config directories
echo "📁 Creating config directories..."
mkdir -p config/development
mkdir -p config/staging
mkdir -p config/production

# Documentation directories
echo "📁 Creating docs directories..."
mkdir -p docs/api
mkdir -p docs/architecture
mkdir -p docs/deployment

# Test directories
echo "📁 Creating test directories..."
mkdir -p tests/integration
mkdir -p tests/e2e
mkdir -p tests/fixtures

# Logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Create .gitkeep files in empty directories
echo "📝 Adding .gitkeep files..."
find services frontend database infrastructure config tests -type d -empty -exec touch {}/.gitkeep \;

# Create basic package.json files
echo "📦 Creating package.json files..."

# Root package.json
cat > package.json << 'EOF'
{
  "name": "lynia-finance",
  "version": "1.0.0",
  "description": "WhatsApp-based device financing platform",
  "private": true,
  "workspaces": [
    "services/*",
    "frontend/*"
  ],
  "scripts": {
    "dev": "pnpm run --parallel dev",
    "build": "pnpm run --recursive build",
    "test": "pnpm run --recursive test",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\""
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.50.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.2.0"
  }
}
EOF

# Shared types package.json
cat > services/shared/package.json << 'EOF'
{
  "name": "@lynia/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.38.0"
  },
  "devDependencies": {
    "typescript": "^5.2.0"
  }
}
EOF

# Create basic README files
echo "📄 Creating README files..."

cat > services/README.md << 'EOF'
# Lynia Finance Services

Microservices for the Lynia Finance platform.

## Services

- **scoring-service**: Credit scoring algorithm (5-component affordability model)
- **whatsapp-service**: WhatsApp bot conversation flow
- **kyc-service**: KYC verification with DIDIT
- **payment-service**: Mobile money payment processing
- **lock-service**: Device lock/unlock management
- **notification-service**: Multi-channel notifications

## Development

```bash
# Install dependencies
pnpm install

# Run all services in dev mode
pnpm dev

# Run specific service
cd scoring-service
pnpm dev

# Run tests
pnpm test
```

See individual service README files for detailed documentation.
EOF

cat > frontend/README.md << 'EOF'
# Lynia Finance Frontend Applications

## Applications

- **admin-portal**: Admin dashboard (Next.js 14)
- **distributor-dashboard**: Agent/distributor dashboard

## Development

```bash
# Install dependencies
pnpm install

# Run admin portal
cd admin-portal
pnpm dev

# Build for production
pnpm build
```
EOF

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
  echo "📄 Creating .gitignore..."
  cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
*.test.ts.snap

# Production
build/
dist/
.next/
out/

# Environment Variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.*
!.env.example

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# AWS
.aws-sam/
samconfig.toml

# Supabase
.supabase/

# Database
database/backups/*.sql
!database/backups/.gitkeep

# Temporary
tmp/
temp/
*.tmp
EOF
fi

# Success message
echo ""
echo "✅ Project structure created successfully!"
echo ""
echo "📊 Summary:"
echo "   - Services: 6 microservices"
echo "   - Frontend: 2 applications"
echo "   - Database: migrations & seed"
echo "   - Infrastructure: AWS & Supabase"
echo ""
echo "📋 Next steps:"
echo "   1. Run: pnpm install"
echo "   2. Copy .env.example to .env"
echo "   3. Fill in environment variables"
echo "   4. Review SETUP.md for detailed setup instructions"
echo ""
echo "🚀 Happy coding!"
