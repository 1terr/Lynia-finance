# Lynia Finance - Website

This directory contains the public-facing website for Lynia Finance platform.

## Overview

The Lynia Finance website serves as the main digital presence for the platform, providing information about services, customer portal access, and marketing content.

## Features (Planned)

### Public Pages
- Landing page with service information
- About Us
- Services & Products
- Contact Us
- Financial literacy blog
- FAQs
- Terms & Conditions
- Privacy Policy

### Customer Portal
- User registration and login
- Account dashboard
- Apply for loans
- View transaction history
- Download statements
- Profile management
- Support ticket system

### Admin Portal
- Customer management
- Loan approval workflow
- Reports and analytics
- System configuration

## Technology Stack

- **Frontend Framework**: React.js / Next.js / Vue.js (to be decided)
- **Styling**: Tailwind CSS / Material-UI
- **Backend**: Node.js / Express (API Gateway)
- **Integration**: Apache Fineract REST API
- **Authentication**: JWT / OAuth 2.0
- **Hosting**: Vercel / Netlify / AWS

## Project Structure

```
website/
├── public/               # Static assets
│   ├── images/
│   ├── fonts/
│   └── favicon.ico
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Page components
│   ├── services/         # API integration services
│   ├── hooks/            # Custom React hooks
│   ├── context/          # State management
│   ├── utils/            # Helper functions
│   └── styles/           # Global styles
├── tests/                # Unit and integration tests
├── docs/                 # Additional documentation
└── package.json          # Dependencies
```

## Getting Started

Coming soon...

## Environment Variables

```env
REACT_APP_API_URL=http://localhost:8443/fineract-provider/api/v1
REACT_APP_TENANT_ID=default
REACT_APP_WHATSAPP_NUMBER=+1234567890
```

## Design Guidelines

- Mobile-first responsive design
- Accessibility (WCAG 2.1 AA compliance)
- Fast loading times
- SEO optimized
- Multi-language support (English, local languages)

## Development Roadmap

- [ ] Design mockups and wireframes
- [ ] Set up frontend framework
- [ ] Create landing page
- [ ] Build customer portal
- [ ] Integrate with Fineract API
- [ ] Add WhatsApp integration
- [ ] Testing and deployment

## Contributing

Please see the main project [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

Same as parent project - Apache License 2.0