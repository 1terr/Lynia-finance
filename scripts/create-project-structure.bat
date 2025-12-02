@echo off
REM =====================================================
REM Lynia Finance - Project Structure Setup Script (Windows)
REM =====================================================
REM Creates all necessary folders for Phase 2 development
REM Run from project root directory

echo 🚀 Creating Lynia Finance project structure...
echo.

REM Create services directory structure
echo 📁 Creating services directories...
mkdir services\shared\types 2>nul
mkdir services\shared\utils 2>nul
mkdir services\shared\clients 2>nul

mkdir services\scoring-service\src\handlers 2>nul
mkdir services\scoring-service\src\scoring 2>nul
mkdir services\scoring-service\tests 2>nul

mkdir services\whatsapp-service\src\handlers 2>nul
mkdir services\whatsapp-service\src\flows 2>nul
mkdir services\whatsapp-service\src\templates 2>nul
mkdir services\whatsapp-service\tests 2>nul

mkdir services\kyc-service\src\handlers 2>nul
mkdir services\kyc-service\tests 2>nul

mkdir services\payment-service\src\handlers 2>nul
mkdir services\payment-service\src\providers 2>nul
mkdir services\payment-service\tests 2>nul

mkdir services\lock-service\src\handlers 2>nul
mkdir services\lock-service\src\providers 2>nul
mkdir services\lock-service\tests 2>nul

mkdir services\notification-service\src\handlers 2>nul
mkdir services\notification-service\tests 2>nul

REM Create frontend directories
echo 📁 Creating frontend directories...
mkdir frontend\admin-portal\src\app 2>nul
mkdir frontend\admin-portal\src\components 2>nul
mkdir frontend\admin-portal\src\lib 2>nul
mkdir frontend\admin-portal\public 2>nul

mkdir frontend\distributor-dashboard\src\app 2>nul
mkdir frontend\distributor-dashboard\src\components 2>nul
mkdir frontend\distributor-dashboard\src\lib 2>nul

REM Infrastructure directories
echo 📁 Creating infrastructure directories...
mkdir infrastructure\aws\lambda 2>nul
mkdir infrastructure\aws\api-gateway 2>nul
mkdir infrastructure\supabase 2>nul
mkdir infrastructure\monitoring 2>nul

REM Config directories
echo 📁 Creating config directories...
mkdir config\development 2>nul
mkdir config\staging 2>nul
mkdir config\production 2>nul

REM Documentation directories
echo 📁 Creating docs directories...
mkdir docs\api 2>nul
mkdir docs\architecture 2>nul
mkdir docs\deployment 2>nul

REM Test directories
echo 📁 Creating test directories...
mkdir tests\integration 2>nul
mkdir tests\e2e 2>nul
mkdir tests\fixtures 2>nul

REM Logs directory
echo 📁 Creating logs directory...
mkdir logs 2>nul

echo.
echo ✅ Project structure created successfully!
echo.
echo 📊 Summary:
echo    - Services: 6 microservices
echo    - Frontend: 2 applications
echo    - Database: migrations ^& seed
echo    - Infrastructure: AWS ^& Supabase
echo.
echo 📋 Next steps:
echo    1. Run: pnpm install
echo    2. Copy .env.example to .env
echo    3. Fill in environment variables
echo    4. Review SETUP.md for detailed setup instructions
echo.
echo 🚀 Happy coding!
pause
