# Lynia Finance Platform

> A modern digital banking platform built on Apache Fineract, providing accessible financial services through web and WhatsApp channels.

## Overview

**Lynia Finance** is a comprehensive banking solution designed to serve underbanked and unbanked populations through accessible digital channels. Built on the robust Apache Fineract core banking platform, Lynia Finance extends traditional banking with modern communication channels like WhatsApp and a customer-friendly web portal.

## Key Features

- **Core Banking**: Full-featured banking operations powered by Apache Fineract
- **Multi-Channel Access**: Web portal and WhatsApp bot for customer convenience
- **Account Management**: Savings accounts, loans, and transaction tracking
- **Loan Origination**: Complete loan application and servicing workflow
- **Digital Payments**: Integration with payment gateways
- **Customer Portal**: Modern web interface for account access
- **WhatsApp Banking**: Conversational banking through WhatsApp
- **Reports & Analytics**: Comprehensive financial reporting

## Project Structure

```
lynia-finance/
├── fineract-*/              # Apache Fineract core banking modules
├── whatsapp-bot/            # WhatsApp bot integration
├── website/                 # Public website & customer portal
├── docs/                    # Documentation
├── docker/                  # Docker configurations
└── kubernetes/              # Kubernetes deployment files
```

## Quick Start

### Prerequisites

- Java 21 or higher
- MariaDB 11.5.2
- Docker & Docker Compose (recommended)
- Node.js 18+ (for WhatsApp bot and website)

### Running with Docker

1. Clone the repository:
```bash
git clone https://github.com/1terr/lynia-finance.git
cd lynia-finance
```

2. Start the services:
```bash
docker-compose -f docker-compose-development.yml up -d
```

3. Access the services:
- Fineract API: https://localhost:8443/fineract-provider
- Health Check: https://localhost:8443/fineract-provider/actuator/health
- API Documentation: https://localhost:8443/fineract-provider/swagger-ui/index.html

4. Default credentials:
- Username: `mifos`
- Password: `password`

### Local Development Setup

1. **Set up the database**:
```bash
./gradlew createDB -PdbName=fineract_tenants
./gradlew createDB -PdbName=fineract_default
```

2. **Run Fineract**:
```bash
./gradlew devRun
```

3. **Set up WhatsApp Bot** (coming soon):
```bash
cd whatsapp-bot
npm install
npm run dev
```

4. **Set up Website** (coming soon):
```bash
cd website
npm install
npm run dev
```

## Documentation

- **Project Overview**: [LYNIA_FINANCE_PROJECT.md](LYNIA_FINANCE_PROJECT.md) - Detailed project documentation
- **WhatsApp Bot**: [whatsapp-bot/README.md](whatsapp-bot/README.md)
- **Website**: [website/README.md](website/README.md)
- **Apache Fineract Docs**: https://fineract.apache.org/docs/current/

## Architecture

Lynia Finance follows a microservices-inspired architecture:

- **Apache Fineract**: Core banking backend with REST API
- **WhatsApp Bot**: Node.js service for WhatsApp Business API integration
- **Website**: React-based customer portal and public website
- **Database**: MariaDB for data persistence
- **API Gateway**: (Optional) For request routing and authentication

See [LYNIA_FINANCE_PROJECT.md](LYNIA_FINANCE_PROJECT.md) for detailed architecture diagrams.

## Technology Stack

- **Backend**: Java 21, Spring Boot, Apache Fineract 1.12.1
- **Database**: MariaDB 11.5.2
- **WhatsApp Bot**: Node.js, WhatsApp Business API
- **Website**: React.js / Next.js, Tailwind CSS
- **DevOps**: Docker, Kubernetes, GitHub Actions
- **Monitoring**: Prometheus, Grafana

## Development Status

| Component | Status | Progress |
|-----------|--------|----------|
| Fineract Core | ✅ Active | Base setup complete |
| Project Structure | ✅ Active | Complete |
| WhatsApp Bot | 🚧 Planned | Not started |
| Website | 🚧 Planned | Not started |
| Documentation | 🚧 In Progress | Ongoing |

## Roadmap

### Phase 1: Foundation ✅
- [x] Set up Apache Fineract
- [x] Create project structure
- [x] Initial documentation

### Phase 2: Core Development 🚧
- [ ] Configure Fineract for production
- [ ] Develop WhatsApp bot MVP
- [ ] Build website landing page
- [ ] Implement authentication

### Phase 3: Integration
- [ ] Connect WhatsApp bot to Fineract
- [ ] Integrate website with backend
- [ ] Add payment gateway
- [ ] Implement notifications

### Phase 4: Launch
- [ ] Security audit
- [ ] Load testing
- [ ] User acceptance testing
- [ ] Production deployment

## API Reference

### Fineract REST API

Base URL: `https://localhost:8443/fineract-provider/api/v1`

**Authentication**:
```bash
curl -X POST https://localhost:8443/fineract-provider/api/v1/authentication \
  -H "Content-Type: application/json" \
  -H "Fineract-Platform-TenantId: default" \
  -d '{"username":"mifos","password":"password"}'
```

**Common Endpoints**:
- `GET /clients` - List all clients
- `GET /savingsaccounts` - List savings accounts
- `GET /loans` - List loans
- `POST /clients` - Create new client

See [API Documentation](https://localhost:8443/fineract-provider/swagger-ui/index.html) for complete reference.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

```bash
# Run unit tests
./gradlew test

# Run integration tests
./gradlew integrationTest

# Run all tests
./gradlew clean build
```

## Security

- All API communications use HTTPS
- JWT-based authentication
- Role-based access control
- Data encryption at rest and in transit
- Regular security audits

Report security vulnerabilities privately to the maintainers.

## License

This project is based on [Apache Fineract](https://fineract.apache.org/) and is licensed under the Apache License 2.0.

See [LICENSE](LICENSE) for details.

## Acknowledgments

- [Apache Fineract](https://fineract.apache.org/) - Core banking platform
- [Apache Software Foundation](https://www.apache.org/)
- All contributors to the Apache Fineract project

## Support

- **Issues**: [GitHub Issues](https://github.com/1terr/lynia-finance/issues)
- **Discussions**: [GitHub Discussions](https://github.com/1terr/lynia-finance/discussions)
- **Documentation**: [docs/](docs/)

## Contact

For questions and support, please open an issue on GitHub.

---

**Built with ❤️ for financial inclusion**