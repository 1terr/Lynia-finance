# Lynia Finance Platform

A modern microfinance platform built on Apache Fineract v1.13.0, designed for digital lending and financial inclusion.

## 📁 Project Structure

```
Lynia Finance Dev/
│
├── fineract/                    # Apache Fineract v1.13.0
│   ├── modules/                 # All Fineract modules (24 modules)
│   ├── tests/                   # Integration, OAuth2, 2FA tests
│   ├── custom/                  # Custom Fineract extensions
│   ├── config/                  # Fineract configuration
│   ├── buildSrc/                # Gradle build scripts
│   ├── docker/                  # Docker configurations
│   ├── kubernetes/              # Kubernetes deployments
│   ├── build.gradle             # Fineract build configuration
│   ├── settings.gradle          # Fineract module settings
│   └── README.md                # Fineract documentation
│
├── lynia-specs/                 # Lynia Finance Specifications
│   ├── 001-whatsapp-bot-lending/  # WhatsApp Bot Lending Feature
│   ├── templates/               # Specification templates
│   ├── scripts/                 # Automation scripts
│   └── memory/                  # Project memory & constitution
│
├── docs/                        # Project Documentation
│   ├── Apache_Fineract_Setup_Guide.pdf
│   ├── Apache_Fineract_Upgrade_Strategy.md
│   ├── FINERACT_V1.13_HIGHLIGHTS.md
│   └── UPGRADE_LOG.md
│
├── scripts/                     # Utility Scripts
│   ├── check-fineract-updates.bat
│   └── check-fineract-updates.sh
│
├── gradle/                      # Gradle Wrapper
└── .github/                     # GitHub Workflows
```

## 🚀 Quick Start

### Prerequisites
- Java 17 or higher
- Docker & Docker Compose (optional)
- Git

### Build the Project
```bash
./gradlew clean build
```

### Run Tests
```bash
./gradlew test
```

### Run with Docker
```bash
cd fineract
docker-compose up
```

## 📚 Documentation

- **Apache Fineract Docs**: [fineract/README.md](fineract/README.md)
- **Upgrade Strategy**: [docs/Apache_Fineract_Upgrade_Strategy.md](docs/Apache_Fineract_Upgrade_Strategy.md)
- **Fineract v1.13 Highlights**: [docs/FINERACT_V1.13_HIGHLIGHTS.md](docs/FINERACT_V1.13_HIGHLIGHTS.md)
- **Upgrade Log**: [docs/UPGRADE_LOG.md](docs/UPGRADE_LOG.md)

## 🎯 Features

### Core Features (Apache Fineract)
- ✅ Loan Management
- ✅ Savings Accounts
- ✅ Client Management
- ✅ Accounting & Financial Reporting
- ✅ Multi-tenancy Support
- ✅ RESTful APIs

### Lynia Finance Features
- 🚀 WhatsApp Bot Lending (In Development)
- 📱 Mobile-first Design
- 💰 Digital Wallet Integration
- 🔐 Enhanced Security
- 📊 Advanced Analytics

## 🔄 Staying Updated

Check for Apache Fineract updates:
```bash
# Windows
scripts\check-fineract-updates.bat

# Linux/Mac
scripts/check-fineract-updates.sh
```

## 🛠️ Development

### Project Organization
- **Apache Fineract Core**: All Fineract-related files in `fineract/`
- **Lynia Customizations**: Specifications in `lynia-specs/`
- **Documentation**: Project docs in `docs/`
- **Build Tools**: Gradle wrapper in root, Fineract build in `fineract/`

### Adding Custom Features
1. Create specification in `lynia-specs/`
2. Follow spec-kit templates
3. Implement in `fineract/custom/` or as separate service
4. Document in `docs/`

## 📋 Version Information

- **Apache Fineract**: v1.13.0
- **Java Version**: 17
- **Gradle Version**: 8.x
- **Spring Boot**: 3.x

## 🔗 Useful Links

- **Apache Fineract**: https://fineract.apache.org/
- **GitHub Repository**: https://github.com/apache/fineract
- **Documentation**: https://fineract.apache.org/docs/
- **Community**: https://fineract.apache.org/community.html

## 📞 Support

For issues or questions:
- Check the documentation in `docs/`
- Review specifications in `lynia-specs/`
- See Apache Fineract docs in `fineract/README.md`

## 📄 License

- **Apache Fineract**: Apache License 2.0 (see `fineract/LICENSE_SOURCE`)
- **Lynia Finance**: Proprietary (see LICENSE file)

---

**Last Updated**: 2025-10-30
**Maintained By**: Lynia Finance Development Team
