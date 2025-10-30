# Feature Specification: Lynia Finance - Asset-Backed Lending Platform

**Feature Branch**: `001-whatsapp-bot-lending`
**Created**: 2025-10-29
**Status**: Draft
**Input**: User description: "Lynia Finance platform for device financing - Customer onboarding via WhatsApp, KYC processing, loan application through Apache Fineract, asset selection, payment collection via EcoCash/Omari, repayment management, and agent operations"

## Constitution Extract

Lynia Finance is a technology-driven lending platform designed to provide accessible, asset-backed credit to underbanked individuals within Zimbabwe's informal sector. The system integrates Apache Fineract as its core banking engine and leverages the WhatsApp Business API for customer onboarding and engagement.

The business model focuses initially on mobile phone financing, expanding to other productive assets such as motorbikes and vehicles. Revenue is generated through loan interest and asset margins, supported by risk mitigation features like remote asset locking.

The platform architecture follows microservices principles, emphasizing API-first communication, independent service deployment, and event-driven workflows. Development adheres to a test-driven methodology (TDD), ensuring reliability through structured testing, observability, and integration validation.

Compliance is enforced across all operational levels through GDPR-aligned data protection, KYC/AML financial regulations, and secure data handling protocols. The system's design prioritizes scalability, performance, and transparency, enabling efficient credit management and sustainable growth within Zimbabwe's informal economy.

## Clarifications

### Session 2025-10-29

- Q: What authentication mechanism should be used for the Agent Dashboard (Next.js frontend)? → A: JWT with refresh tokens, stored securely in httpOnly cookies
- Q: Which Zimbabwe-specific regulatory framework must the KYC/AML process comply with? → A: Reserve Bank of Zimbabwe (RBZ) Financial Intelligence Unit (FIU) regulations
- Q: What should happen when both EcoCash AND Omari payment gateways are simultaneously unavailable? → A: Block all payment attempts and notify customers to retry later with estimated recovery time
- Q: What are the key factors used in the customer qualification scoring logic? → A: No creditbureau check
- Q: How long should customer KYC records, loan transaction history, and audit logs be retained for compliance purposes? → A: 7 years for all records uniformly (aligned with RBZ FIU requirements)
- Q: What is the complete customer journey from greeting to phone collection? → A: Greeting → Terms Acceptance → Menu (Buy Phone/Make Payment/Check Balance/Talk to CS) → "Let's get to know you" → KYC Collection → Qualification → Phone List (8 months) → Phone Selection → Go to Distributor → ID Verification → Distributor Approval → WhatsApp Confirmation → Customer Accepts → Pay Deposit Link → USSD Payment → Distributor Confirms Payment → Phone Handover
- Q: How is the deposit amount calculated when a customer selects a phone? → A: Fixed percentage of phone price (e.g., 20% deposit on all devices)
- Q: Which service/provider should be used for sending email/SMS notifications to admins for system alerts? → A: Twilio SendGrid for email + Twilio SMS (unified platform)
- Q: What specific permissions should each admin role have? → A: System Admin: Full access; Finance Manager: Financial reports + payment reconciliation; Risk Manager: KYC review + risk config + asset locks; CS Agent: Tickets + customer profiles + manual adjustments
- Q: What happens when an admin tries to deactivate a distributor who has customers with pending phone collections? → A: Reassign pending transactions to nearest active distributor and notify customers of new location
- Q: Should we consolidate "Agent" and "Distributor Staff" terminology throughout the spec? → A: Use "Distributor Staff" consistently

### Session 2025-10-29 - Comprehensive Pass (20 Questions)

- Q: What is the interest rate or margin charged on the loans? → A: 25-50% flat interest rate over 8 months
- Q: What late payment penalty should be charged when customers miss payment? → A: No monetary penalty, but customer becomes ineligible for future loans
- Q: How should commissions be calculated for distributor staff? → A: Fixed percentage of device sale price (3-5% of phone price)
- Q: After how many days past due should asset lock trigger? → A: 15 days past due (half-month grace), reduce grace by 5 days on next payment if extension granted
- Q: How should customer service tickets be assigned? → A: Automatic round-robin with priority weighting (urgent tickets assigned first)
- Q: What criteria for approving payment extension requests? → A: Based on payment history and default risk score (good history = approve, poor = deny)
- Q: Do stock transfers require admin approval? → A: All transfers require admin approval before execution
- Q: What is the Zimbabwean national ID format? → A: Format XX-XXXXXXAXX (e.g., 63-123456A78) - 2 digits, hyphen, 6 digits, letter, 2 digits
- Q: What phone number format for validation? → A: Accept both international (+263 7X XXX XXXX) and local (07X XXX XXXX) formats
- Q: How to verify Next of Kin information? → A: No verification - accept provided information as-is
- Q: How to detect duplicate customer applications? → A: Flag for review if phone number + ID number combination exists
- Q: What is the maximum loan amount limit? → A: $500 maximum (mid-range phones, balanced risk)
- Q: How to maintain WhatsApp bot conversation state? → A: Database state (PostgreSQL/Supabase) with 24-hour session expiry
- Q: How does asset lock mechanism work technically? → A: Custom pre-installed lock app on all devices that responds to remote commands
- Q: How frequently should inventory levels sync? → A: Real-time (instant sync on every inventory change via websockets)
- Q: What rate limiting for Apache Fineract API? → A: Token bucket: 100 requests/minute with burst allowance of 20
- Q: What session timeout values for different users? → A: Customer: 30 min, Distributor Staff: 2 hours, Admin/CS: 1 hour
- Q: What rules should auto-flag KYC applications? → A: Duplicate ID + blacklisted phone + invalid Next of Kin format + suspicious patterns (same address, rapid applications)
- Q: How to resolve payment reconciliation mismatches? → A: Create support ticket for finance manager manual review and resolution
- Q: How to calculate monthly repayment amount? → A: Simple interest: [(Phone Price - Deposit) × (1 + Interest Rate)] ÷ 8 equal installments

## Platform Overview

The Lynia Finance platform integrates multiple systems to deliver end-to-end asset-backed lending:

**Core Systems**:
- **Apache Fineract**: Loan management, customer records, repayment tracking, financial calculations
- **WhatsApp Business API**: Primary customer interface for onboarding, notifications, and self-service
- **Payment Gateway Integration**: EcoCash and Omari for deposit collection and loan repayments
- **PostgreSQL/Supabase**: Customer data, KYC records, inventory management, agent operations
- **Next.js Frontend**: Agent dashboard and back-office management
- **Twilio (SendGrid + SMS)**: Email and SMS notifications for admin alerts and system notifications
- **AWS Infrastructure**: Hosting, scaling, and service orchestration

**Integration Points**:
- WhatsApp Bot ↔ Apache Fineract (customer creation, loan applications, balance queries)
- Payment Gateways ↔ Apache Fineract (payment confirmation, loan balance updates)
- Agent Dashboard ↔ Inventory System (stock management, handover verification)
- Event Bus: Cross-service communication for notifications, workflows, and audit trails

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer Onboarding, KYC Submission & Menu Navigation (Priority: P1)

As a customer, I want to receive a greeting, accept terms, navigate a menu, and submit my KYC details via WhatsApp, so that I can be evaluated for loan eligibility and access device financing options.

**Why this priority**: This is the entry point for all customers and the foundation of the lending process. Without greeting, menu navigation, KYC collection and qualification, no other feature can function. This delivers immediate value by enabling the first customer interaction and self-service navigation.

**Independent Test**: Can be fully tested by sending a WhatsApp message to the bot, receiving the greeting and terms, accepting them, viewing menu options (Buy Phone, Make Payment, Check Balance, Talk to Customer Service), selecting "Buy Phone", receiving "Let's get to know you" message, submitting all KYC fields (Name, ID, Address, Phone, 2 Next of Kin with their details), and receiving a qualification response. Delivers value by qualifying or rejecting customers based on scoring logic.

**Acceptance Scenarios**:

1. **Given** a customer initiates contact with the WhatsApp bot, **When** the message is received, **Then** the customer receives a greeting message within 5 seconds with terms and conditions displayed or linked
2. **Given** the customer receives terms and conditions, **When** the customer replies "Accept" or similar keyword, **Then** the bot displays a menu with options: "Buy Phone", "Make Payment", "Check Balance", "Talk to Customer Service"
3. **Given** the customer sees the menu, **When** the customer selects "Buy Phone" option, **Then** the bot displays "Let's get to know you" message and prompts for KYC information starting with Full Name
4. **Given** the customer is in KYC collection flow, **When** the customer submits Full Name, ID, Address, Phone Number, and 2 Next of Kin (each with Name, ID, Phone), **Then** all fields are validated for correct format (ID format, phone number length)
5. **Given** all KYC data is validated and submitted, **When** the backend scoring logic evaluates the customer, **Then** the customer receives either "Congratulations, you qualify to buy a phone" or "Sorry, you do not qualify at this moment" message
6. **Given** the customer is rejected, **When** the rejection message is sent, **Then** the customer is offered a "Talk to Customer Service" option
7. **Given** the customer made an error in KYC submission, **When** the customer requests "Retry KYC", **Then** the previous submission is cleared and the customer can submit new data

---

### User Story 2 - Phone Selection & Distributor Visit Instructions (Priority: P2)

As a qualified customer, I want to view available phones with repayment plans and receive instructions to visit the distributor, so that I can select a device that fits my budget and know where to collect it.

**Why this priority**: This is the second critical step after qualification. It enables customers to select their preferred phone model and prepares them to visit the distributor for verification and collection. This delivers immediate value by showing customers what they can afford and where to go next.

**Independent Test**: Can be fully tested by using a qualified customer, viewing the phone list with monthly repayment amounts (8-month payment period), selecting a phone, and receiving a message to visit the distributor for collection. Delivers value by enabling phone selection and directing customers to the distributor.

**Acceptance Scenarios**:

1. **Given** a customer has been qualified ("Congratulations, you qualify to buy a phone"), **When** the qualification is complete, **Then** the bot displays the phone list with monthly repayment amounts and repayment period (8 months)
2. **Given** phone options are displayed, **When** the customer selects a phone via numbered reply or keyword, **Then** the selection is confirmed
3. **Given** the phone is selected, **When** the confirmation is sent, **Then** the bot sends a message to go to the distributor to collect the phone with instructions to bring their ID for verification

---

### User Story 3 - Distributor Visit: ID Verification, WhatsApp Confirmation, Payment & Handover (Priority: P2)

As a customer with a phone selection, I want to visit the distributor, have my ID verified, confirm the purchase on WhatsApp, pay the deposit, and collect my phone, so that I can walk away with my device ready to use.

**Why this priority**: This completes the customer acquisition journey through a secure multi-step process: ID verification → system approval → WhatsApp confirmation → payment → handover. It's critical for fraud prevention, customer satisfaction, and operational efficiency as it ensures proper identity verification before payment and collection.

**Independent Test**: Can be fully tested by having a customer with a phone selection arrive at distributor, distributor verifies ID and approves in system, customer receives WhatsApp confirmation message and accepts purchase, customer receives "Pay Deposit" message with USSD link, customer pays via EcoCash/Omari, distributor confirms payment in system, and hands over phone. Customer walks out with phone ready to use. Delivers value by completing the entire transaction securely with proper verification and payment confirmation.

**Acceptance Scenarios**:

1. **Given** a customer with phone selection arrives at distributor, **When** the customer gives their ID to the distributor, **Then** the distributor inputs the ID number into the system for verification
2. **Given** the ID is entered, **When** the system verifies the ID, **Then** the system matches the ID against the customer record and displays the selected phone model
3. **Given** the ID is verified and phone is displayed, **When** the distributor clicks "Approve" in the system, **Then** the approval is recorded and triggers a WhatsApp message to the customer
4. **Given** the distributor has approved, **When** the approval is complete, **Then** the customer receives a WhatsApp confirmation message asking them to accept the phone purchase
5. **Given** the customer receives WhatsApp confirmation, **When** the customer accepts the phone purchase on WhatsApp, **Then** the customer receives a "Pay Deposit" message with payment link
6. **Given** the customer receives the payment link, **When** the customer clicks the link, **Then** they are directed via USSD to EcoCash/Omari payment window
7. **Given** payment is initiated, **When** the payment is completed, **Then** the distributor confirms payment via the system within 30 seconds and the payment status updates
8. **Given** payment is confirmed in the system, **When** the distributor sees payment confirmation, **Then** the distributor hands over the phone to the customer
9. **Given** the phone is handed over, **When** the handover is complete, **Then** the customer walks out with the phone ready to use and the loan account is activated in Apache Fineract

---

### User Story 4 - Repayment Management & Balance Checking (Priority: P3)

As a customer with an active loan, I want to check my loan balance, make repayments, and receive reminders via WhatsApp, so that I can stay on track with my loan and avoid default.

**Why this priority**: This enables ongoing customer engagement and ensures repayment compliance. While important for business sustainability, it's lower priority than customer acquisition (P1-P2) because it only applies to customers who already have loans.

**Independent Test**: Can be fully tested by having a customer with an active loan send "Check Balance" to receive balance and due date, initiate a repayment via WhatsApp payment link, receive confirmation, and verify that reminders are sent 3 days and 1 day before due date. Delivers value by helping customers manage their loans and reducing defaults.

**Acceptance Scenarios**:

1. **Given** a customer has an active loan, **When** the customer sends "Check Balance", **Then** the bot returns outstanding balance, next due date, and payment history pulled from Fineract or PostgreSQL
2. **Given** a customer wants to make a repayment, **When** the customer initiates repayment via WhatsApp, **Then** the bot sends a payment link or USSD code
3. **Given** repayment is made, **When** payment is confirmed, **Then** the payment is logged and the customer receives an updated balance message
4. **Given** a repayment due date is approaching, **When** it's 3 days before the due date, **Then** the bot sends a reminder with amount due, payment link, and due date
5. **Given** a repayment due date is approaching, **When** it's 1 day before the due date, **Then** the bot sends another reminder and the event is logged

---

### User Story 5 - Payment Extensions & Default Management (Priority: P4)

As a customer experiencing hardship, I want to request a payment extension via WhatsApp and receive warnings before asset lock, so that I can avoid penalties and repossession.

**Why this priority**: This is an exception handling feature that supports customer retention and reduces bad debt. It's lower priority because it only applies to customers who are struggling with payments, not the main customer flow.

**Independent Test**: Can be fully tested by having a customer request a payment extension via WhatsApp, verifying the request is logged and routed for review, receiving approval/denial with new terms, and testing that final warnings are sent after missed payments before asset lock. Delivers value by providing flexibility and reducing losses from defaults.

**Acceptance Scenarios**:

1. **Given** a customer is approaching or past their due date, **When** the customer selects "Request Extension" option, **Then** the request is logged and routed to backend for review
2. **Given** an extension request is reviewed, **When** a decision is made, **Then** the customer receives an approval or denial message with new payment terms if approved
3. **Given** a customer misses a payment, **When** the grace period expires, **Then** the bot sends a "Final Warning" message with deadline and consequences
4. **Given** a final warning is sent, **When** the event is logged, **Then** it triggers a backend lock workflow if the payment remains unpaid after the deadline

---

### User Story 6 - Customer Service Escalation (Priority: P4)

As a rejected or confused customer, I want to talk to customer service via WhatsApp, so that I can understand my rejection or get help with my questions.

**Why this priority**: This provides support for edge cases and improves customer satisfaction. It's lower priority because it's a fallback mechanism rather than the primary customer flow.

**Independent Test**: Can be fully tested by having a rejected customer select "Talk to Customer Service" option, verifying they are routed to a live agent or ticketing flow, and confirming the conversation is logged with a reference number. Delivers value by providing human support when automated flows fail or customers need clarification.

**Acceptance Scenarios**:

1. **Given** a customer is rejected after KYC submission, **When** the rejection message is displayed, **Then** the bot offers "Talk to Customer Service" option
2. **Given** the customer selects customer service, **When** the option is chosen, **Then** the customer is routed to a live agent or ticketing system
3. **Given** the customer service conversation begins, **When** interaction starts, **Then** the conversation is logged with a unique reference number for tracking

---

### User Story 7 - Agent Inventory & Handover Management (Priority: P3)

As a distributor agent, I want to verify customer IDs, approve asset collections, view real-time inventory, and track my commissions, so that I can complete secure handovers and monitor my earnings.

**Why this priority**: This enables agent operations which are critical for the distribution model. It's P3 because agents need tools to operate efficiently, but it's not as high priority as the core customer acquisition flow (P1-P2).

**Independent Test**: Can be fully tested by having an agent log into the dashboard or mobile app, verify a customer ID, approve a handover with logging, view current inventory filtered by model/status/location, and access commission tracking with monthly summaries. Delivers value by empowering agents to complete secure transactions and monitor their performance.

**Acceptance Scenarios**:

1. **Given** an agent needs to verify a customer, **When** the agent enters a customer ID into the dashboard or mobile app, **Then** the system confirms the match and displays asset reservation details
2. **Given** customer verification is complete, **When** the agent clicks "Approve" to log the handover, **Then** the handover is recorded with timestamp, agent ID, and customer ID
3. **Given** an agent needs to check inventory, **When** the agent opens the inventory dashboard, **Then** current stock is displayed per location with updates within 30 seconds of sales or deliveries
4. **Given** an agent wants to filter inventory, **When** the agent applies filters, **Then** inventory is shown by model, status, or location
5. **Given** an agent completes a sale, **When** the sale is logged, **Then** the system records the agent ID, timestamp, and calculates commission amount
6. **Given** an agent wants to review earnings, **When** the agent accesses commission tracking, **Then** a monthly summary is displayed via the dashboard

---

### User Story 8 - Agent Handover History & Inventory Alerts (Priority: P4)

As a distributor agent, I want to view customer handover history and receive low inventory alerts, so that I can resolve disputes and request restocking proactively.

**Why this priority**: This supports agent efficiency and inventory management. It's P4 because it's an operational improvement feature rather than a core transaction requirement.

**Independent Test**: Can be fully tested by having an agent search handover logs by customer ID, view timestamp/asset ID/payment status, export the logs, and verify that alerts are sent when inventory falls below threshold with the ability to submit restock requests. Delivers value by improving agent operations and preventing stockouts.

**Acceptance Scenarios**:

1. **Given** an agent needs to verify a past transaction, **When** the agent searches handover history by customer ID, **Then** the dashboard shows all handover logs with timestamp, asset ID, and payment status
2. **Given** handover logs are displayed, **When** the agent needs to export data, **Then** the logs are searchable and exportable
3. **Given** inventory levels are monitored by the system, **When** stock falls below a defined threshold, **Then** the agent receives a WhatsApp or dashboard alert
4. **Given** an agent receives a low inventory alert, **When** the agent wants to restock, **Then** the agent can submit a restock request via the dashboard

---

### User Story 9 - Admin Dashboard & System Monitoring (Priority: P3)

As a system administrator, I want to access a comprehensive dashboard showing system health, user activity, transaction volumes, and key metrics, so that I can monitor platform performance and identify issues proactively.

**Why this priority**: This is essential for operational oversight and proactive issue detection. It's P3 because it's needed for Day 1 operations but doesn't directly impact customer transactions. It enables administrators to ensure system reliability and business performance.

**Independent Test**: Can be fully tested by having an admin log into the dashboard, view real-time system health metrics (API uptime, response times, error rates), see transaction volumes (loans disbursed, payments processed), monitor user activity (active customers, distributor activity), view alerts for system issues, and access detailed logs. Delivers value by providing visibility into platform operations and early warning of issues.

**Acceptance Scenarios**:

1. **Given** an admin logs into the admin portal, **When** the dashboard loads, **Then** the system displays key metrics: total active loans, total customers, payment success rate, average response time, system uptime
2. **Given** the dashboard is displayed, **When** the admin views the system health section, **Then** all microservices show status (Healthy/Degraded/Down) with last health check timestamp
3. **Given** the admin is monitoring transactions, **When** the admin selects a time period (today/week/month), **Then** the system displays transaction volume charts: KYC submissions, qualifications, phone selections, payments, handovers
4. **Given** a system error occurs, **When** the error threshold is exceeded, **Then** an alert is displayed on the dashboard and sent via email/SMS to admins
5. **Given** the admin needs detailed information, **When** the admin clicks on a metric, **Then** the system drills down to show granular data with filtering and export options
6. **Given** the admin reviews logs, **When** the admin accesses the audit log section, **Then** all user actions (admin, distributor, customer) are logged with timestamp, user ID, action type, and IP address

---

### User Story 10 - Distributor & Inventory Management (Priority: P3)

As a system administrator, I want to manage distributor accounts, assign inventory to locations, track stock movements, and reconcile distributor commissions, so that I can ensure proper operations across all distribution points.

**Why this priority**: This is critical for managing the distribution network and ensuring inventory accuracy. It's P3 because it's needed for operational management but doesn't directly block customer transactions. It enables scaling the distribution network.

**Independent Test**: Can be fully tested by having an admin create a new distributor account with location assignment, add inventory stock to that location, transfer stock between locations, deactivate a distributor, view commission reports for all distributors, approve commission payouts, and verify all actions are logged. Delivers value by enabling efficient distributor network management and accurate inventory tracking.

**Acceptance Scenarios**:

1. **Given** an admin needs to onboard a new distributor, **When** the admin clicks "Add Distributor", **Then** a form is displayed for: Name, Email, Phone, Location, Commission Rate, Access Level
2. **Given** distributor details are entered, **When** the admin submits the form, **Then** the system creates the account, generates login credentials, sends welcome email with credentials, and logs the action
3. **Given** a distributor account exists, **When** the admin views the distributor list, **Then** all distributors are displayed with: Name, Location, Status (Active/Inactive), Total Sales, Commission Earned, Last Login
4. **Given** an admin needs to deactivate a distributor, **When** the admin clicks "Deactivate" and confirms, **Then** the distributor's access is revoked, pending transactions are reassigned, and the distributor is notified
5. **Given** new inventory arrives, **When** the admin adds stock, **Then** the form requires: Phone Model, Quantity, Serial Numbers (bulk upload CSV), Location, Supplier Reference, Purchase Cost
6. **Given** stock is added, **When** the submission is complete, **Then** the inventory is updated at the specified location, each device is assigned a unique asset ID, and a stock receipt is generated
7. **Given** an admin needs to transfer stock, **When** the admin selects devices and destination location, **Then** the system validates availability, creates transfer record, updates inventory at both locations, and notifies receiving distributor
8. **Given** an admin reviews commissions, **When** the admin accesses the commission dashboard, **Then** the system displays per-distributor breakdown: Sales Count, Total Sales Value, Commission Rate, Commission Earned, Payment Status (Pending/Paid)
9. **Given** commissions are due, **When** the admin approves payout, **Then** the system marks commissions as paid, records payout date and method, generates payment receipt, and notifies distributor

---

### User Story 11 - Customer Service & Dispute Resolution (Priority: P3)

As a customer service agent, I want to view customer support tickets, access full customer history, manually adjust accounts, and resolve disputes, so that I can provide effective support and maintain customer satisfaction.

**Why this priority**: This is essential for handling customer issues and maintaining service quality. It's P3 because it supports customer retention and satisfaction but doesn't block the core transaction flow. It enables human intervention when automated systems fail or disputes arise.

**Independent Test**: Can be fully tested by having a CS agent log in, view open tickets from customers who selected "Talk to Customer Service", access a customer's full profile (KYC, loan history, payments), manually adjust a payment due date, resolve a payment dispute by reconciling a missing payment, and close the ticket with resolution notes. Delivers value by enabling effective customer support and issue resolution.

**Acceptance Scenarios**:

1. **Given** a CS agent logs into the support portal, **When** the dashboard loads, **Then** the system displays all open tickets with: Reference Number, Customer Name, Issue Type, Priority, Created Date, Status
2. **Given** a ticket is displayed, **When** the CS agent clicks on a ticket, **Then** the full ticket details are shown: Customer WhatsApp conversation history, Issue description, Customer profile link, Resolution options
3. **Given** the CS agent needs customer context, **When** the CS agent clicks "View Customer Profile", **Then** the system displays: KYC details, Qualification status, Selected phone, Loan status, Payment history, All WhatsApp interactions, Previous tickets
4. **Given** a customer was incorrectly rejected, **When** the CS agent reviews the case and decides to override, **Then** the CS agent can click "Override Rejection", add justification, and re-qualify the customer
5. **Given** a customer claims payment was made but not reflected, **When** the CS agent searches payment records, **Then** the system shows all payment attempts with: Transaction ID, Gateway Response, Amount, Timestamp, Reconciliation Status
6. **Given** a payment is found but not reconciled, **When** the CS agent clicks "Manual Reconciliation", **Then** the system prompts for confirmation, updates the loan balance, sends confirmation to customer, and logs the manual adjustment
7. **Given** a customer requests payment extension, **When** the CS agent reviews the request, **Then** the system shows: Current due date, Amount due, Payment history, Default risk score, Recommended action
8. **Given** the CS agent approves an extension, **When** the approval is submitted, **Then** the system updates the due date, recalculates the schedule, sends confirmation to customer via WhatsApp, and logs the approval with reason
9. **Given** a dispute is resolved, **When** the CS agent closes the ticket, **Then** the system requires resolution notes, updates ticket status to "Resolved", sends closure notification to customer, and archives the ticket

---

### User Story 12 - Financial Operations & Reporting (Priority: P4)

As a finance manager, I want to generate financial reports, reconcile payments with Apache Fineract, view loan portfolio performance, and export data for accounting, so that I can maintain accurate financial records and monitor business performance.

**Why this priority**: This is important for financial management and regulatory compliance but doesn't directly impact day-to-day operations. It's P4 because basic reporting can be deferred initially, but it's essential for long-term business sustainability.

**Independent Test**: Can be fully tested by having a finance manager log in, generate a loan portfolio report showing all active loans with outstanding balances, export payment reconciliation data for a date range, view revenue breakdown by product and distributor, and generate a compliance report for RBZ FIU submission. Delivers value by enabling accurate financial management and regulatory compliance.

**Acceptance Scenarios**:

1. **Given** a finance manager accesses the reporting portal, **When** the dashboard loads, **Then** the system displays financial summary: Total Disbursed, Total Collected, Outstanding Balance, Default Rate, Revenue (Interest + Margins)
2. **Given** the finance manager needs a loan portfolio report, **When** the manager selects "Loan Portfolio Report", **Then** the system generates a report showing: Loan ID, Customer Name, Phone Model, Disbursement Date, Loan Amount, Outstanding Balance, Days Past Due, Status
3. **Given** the report is generated, **When** the manager clicks "Export", **Then** the system offers formats: CSV, Excel, PDF with filters for: Date Range, Loan Status, Distributor, Phone Model
4. **Given** the finance manager needs payment reconciliation, **When** the manager selects a date range, **Then** the system displays all payments with: Transaction ID, Customer, Amount, Payment Method, Gateway Fee, Net Amount, Fineract Reconciliation Status
5. **Given** payments are not reconciled, **When** the manager clicks "Reconcile All", **Then** the system matches payments to Fineract transactions, flags mismatches, and generates reconciliation report
6. **Given** the finance manager reviews revenue, **When** the manager accesses the revenue dashboard, **Then** the system shows breakdown by: Interest Income, Asset Margin, Payment Gateway Fees, Net Revenue with charts by month/distributor/product
7. **Given** regulatory reporting is required, **When** the manager selects "RBZ FIU Compliance Report", **Then** the system generates a report with: New customers (KYC records), Loan disbursements, Large transactions (>threshold), Default cases, Customer demographic data
8. **Given** the compliance report is generated, **When** the manager exports it, **Then** the system formats it according to RBZ FIU requirements with all required fields and validation

---

### User Story 13 - Compliance & Risk Management (Priority: P4)

As a risk manager, I want to review flagged KYC applications, monitor default trends, configure risk parameters, trigger asset locks, and audit system activity, so that I can minimize risk and ensure regulatory compliance.

**Why this priority**: This is critical for risk mitigation and compliance but can be partially manual initially. It's P4 because basic risk controls are built into the scoring system, but advanced risk management features can be added progressively.

**Independent Test**: Can be fully tested by having a risk manager log in, review flagged KYC applications where scoring logic flagged anomalies, adjust risk scoring parameters, view default trend analytics, manually trigger an asset lock for a severely delinquent customer, and audit all admin actions for the past month. Delivers value by enabling proactive risk management and compliance oversight.

**Acceptance Scenarios**:

1. **Given** a risk manager accesses the risk dashboard, **When** the dashboard loads, **Then** the system displays: Default Rate (current/trend), Days Past Due Distribution, Asset Lock Status, Flagged KYC Applications, High-Risk Customers
2. **Given** KYC applications are flagged, **When** the risk manager clicks "Review Flagged KYC", **Then** the system shows applications flagged for: Duplicate ID, Invalid Next of Kin, Blacklisted phone number, Suspicious patterns
3. **Given** a flagged KYC is displayed, **When** the risk manager reviews the details, **Then** the system shows: Flagged fields, Reason for flag, Customer submission data, Recommended action (Approve/Reject/Request More Info)
4. **Given** the risk manager decides to reject, **When** the rejection is submitted with reason, **Then** the customer is notified, the application is archived, and the rejection is logged with audit trail
5. **Given** the risk manager needs to adjust risk parameters, **When** the manager accesses "Risk Configuration", **Then** editable parameters are displayed: Minimum qualification score, Next of Kin verification weight, ID validation rules, Default thresholds
6. **Given** parameters are updated, **When** the manager saves changes, **Then** the system validates inputs, applies changes, logs the configuration change with old/new values, and sends notification to admins
7. **Given** the risk manager monitors defaults, **When** the manager views the default dashboard, **Then** the system shows: Customers by days past due (1-30, 31-60, 61-90, 90+), Total at-risk value, Asset lock recommendations
8. **Given** a customer is severely delinquent, **When** the risk manager clicks "Trigger Asset Lock", **Then** the system sends lock command to device, logs the action, updates loan status to "Asset Locked", and sends final notice to customer
9. **Given** the risk manager conducts an audit, **When** the manager accesses audit logs, **Then** the system shows all admin/distributor actions with filters: Date Range, User, Action Type, Entity (Customer/Loan/Inventory) with export capability

---

### Edge Cases

- What happens when a customer provides invalid ID format during KYC submission? (System validates and prompts for re-entry with format example)
- What happens when payment fails or times out? (Customer receives error message with option to retry payment or contact support)
- What happens when a customer loses WhatsApp access mid-application? (System saves progress; customer can resume by messaging from same number)
- What happens when two agents try to approve the same customer handover simultaneously? (System locks the record during first approval; second attempt receives "already processed" message)
- What happens when a customer tries to apply for multiple loans simultaneously? (System detects existing application and notifies customer to complete current application first)
- What happens when asset inventory is depleted for a selected phone model? (System notifies customer of unavailability and offers alternative models)
- What happens when backend scoring service is down during KYC qualification? (System queues the request and notifies customer of delay with estimated processing time)
- What happens when a customer disputes their loan balance? (Customer service option routes to agent who can review transaction history and resolve dispute)
- What happens when an agent account is deactivated but has pending handovers? (Pending handovers are reassigned to active agents in the same location)
- What happens when Apache Fineract API is temporarily unavailable? (System caches customer state and retries operations with exponential backoff)
- What happens when payment gateway webhook fails to deliver? (System polls payment status and reconciles transactions through scheduled jobs)
- What happens when WhatsApp Business API rate limits are reached? (System queues messages and implements priority-based delivery)

## Requirements *(mandatory)*

### Functional Requirements

**Customer Onboarding, Menu Navigation & KYC (WhatsApp Interface)**

- **FR-001**: System MUST send a greeting message with terms and conditions to customers within 5 seconds of initial WhatsApp contact
- **FR-002**: System MUST require customer acceptance of terms (via "Accept" keyword or similar) before displaying the menu
- **FR-002A**: System MUST display a menu with the following options after terms acceptance: "Buy Phone", "Make Payment", "Check Balance", "Talk to Customer Service"
- **FR-002B**: System MUST route customer to appropriate flow based on menu selection
- **FR-002C**: System MUST display "Let's get to know you" message when customer selects "Buy Phone" option
- **FR-003**: System MUST collect the following KYC fields: Full Name, ID Number, Address, Phone Number, and 2 Next of Kin (each with Name, ID Number, and Phone Number)
- **FR-003A**: System MUST ensure KYC collection process complies with Reserve Bank of Zimbabwe (RBZ) Financial Intelligence Unit (FIU) regulations
- **FR-004**: System MUST validate ID number format according to Zimbabwean national ID standards (XX-XXXXXXAXX format: 2 digits, hyphen, 6 digits, letter, 2 digits)
- **FR-005**: System MUST validate phone number and accept both international (+263 7X XXX XXXX) and local (07X XXX XXXX) formats
- **FR-005A**: System MUST flag duplicate applications for review when phone number + ID number combination already exists
- **FR-005B**: System MUST NOT verify Next of Kin information - accept provided information as-is
- **FR-006**: System MUST store all KYC data securely in PostgreSQL or Apache Fineract with encryption at rest
- **FR-006A**: System MUST maintain KYC records and audit trails as required by RBZ FIU regulations for AML compliance
- **FR-007**: System MUST evaluate customer qualification using backend scoring logic after KYC submission
- **FR-007A**: System MUST NOT integrate with credit bureau services for qualification scoring (targeting underbanked customers without formal credit history)
- **FR-007B**: System MUST base qualification scoring on submitted KYC data, Next of Kin verification, and internal risk assessment criteria
- **FR-008**: System MUST return a qualification message ("Congratulations, you qualify to buy a phone" or "Sorry, you do not qualify at this moment") based on scoring results
- **FR-009**: System MUST offer a "Talk to Customer Service" option to rejected customers
- **FR-010**: System MUST route customer service requests to a live agent queue or ticketing system
- **FR-011**: System MUST log all customer service conversations with unique reference numbers
- **FR-012**: System MUST allow customers to retry KYC submission and clear previous data upon retry request

**Phone Selection & Distributor Visit Instructions**

- **FR-013**: System MUST display the phone list with monthly repayment amounts and repayment period (8 months) immediately after qualification
- **FR-013A**: System MUST calculate deposit amount as a fixed percentage of the phone price (configurable, default 20%)
- **FR-013B**: System MUST calculate monthly repayment using formula: [(Phone Price - Deposit) × (1 + Interest Rate)] ÷ 8 months
- **FR-013C**: System MUST apply interest rate between 25-50% (configurable) for loan calculations
- **FR-013D**: System MUST enforce maximum loan amount of $500 (mid-range phones)
- **FR-013E**: System MUST display deposit amount alongside monthly repayment amount for each phone
- **FR-014**: System MUST allow customers to select a phone via numbered reply or keyword
- **FR-015**: System MUST confirm the phone selection to the customer
- **FR-016**: System MUST send a message instructing the customer to go to the distributor to collect the phone
- **FR-017**: System MUST include instructions to bring their ID for verification when visiting the distributor

**Distributor-Based ID Verification, Approval & WhatsApp Confirmation**

- **FR-018**: System MUST allow distributors to input customer ID number for verification
- **FR-019**: System MUST verify the ID number and match it against the customer record
- **FR-020**: System MUST display the selected phone model and customer information to distributors upon ID match
- **FR-021**: System MUST allow distributors to approve the phone in the system
- **FR-022**: System MUST record the approval with timestamp and distributor ID
- **FR-023**: System MUST trigger a WhatsApp confirmation message to the customer when distributor approves
- **FR-024**: System MUST send WhatsApp confirmation message asking customer to accept the phone purchase
- **FR-025**: System MUST allow customer to accept the phone purchase on WhatsApp

**Payment Processing & Handover**

- **FR-026**: System MUST send "Pay Deposit" message to customer after WhatsApp purchase acceptance
- **FR-027**: System MUST include payment link in the "Pay Deposit" message
- **FR-028**: System MUST direct customer via USSD to EcoCash/Omari payment window when they click the payment link
- **FR-029**: System MUST integrate with EcoCash payment gateway for deposit and repayment processing
- **FR-030**: System MUST integrate with Omari payment gateway for deposit and repayment processing
- **FR-031**: System MUST handle payment gateway webhooks for transaction status updates
- **FR-032**: System MUST track payment status and confirm payments within 30 seconds of backend confirmation
- **FR-033**: System MUST update payment status in distributor system after successful payment
- **FR-034**: System MUST allow distributors to confirm payment via the system
- **FR-035**: System MUST allow distributors to hand over the phone to customer after payment confirmation
- **FR-036**: System MUST log all handovers with timestamp, distributor ID, customer ID, asset ID, and deposit amount
- **FR-037**: System MUST reconcile payment transactions with Apache Fineract loan accounts
- **FR-038**: System MUST activate loan account in Apache Fineract with asset ID, handover timestamp, deposit amount, and 8-month repayment schedule upon handover

**Loan Management & Apache Fineract Integration**

- **FR-039**: System MUST create customer records in Apache Fineract upon KYC approval
- **FR-040**: System MUST create loan applications in Apache Fineract when customers select phones
- **FR-041**: System MUST allow customers to check loan balance via "Check Balance" menu option
- **FR-042**: System MUST return outstanding balance, next due date, and payment history when balance is requested
- **FR-043**: System MUST pull loan data from Apache Fineract for balance inquiries
- **FR-044**: System MUST allow customers to initiate repayments via WhatsApp "Make Payment" menu option with payment link or USSD code
- **FR-045**: System MUST log all repayment transactions in Apache Fineract
- **FR-046**: System MUST send repayment confirmation with updated balance after successful payment

**Repayment Reminders & Default Management**

- **FR-047**: System MUST send automatic payment reminders 3 days before due date
- **FR-048**: System MUST send automatic payment reminders 1 day before due date
- **FR-049**: System MUST include amount due, payment link, and due date in all reminders
- **FR-050**: System MUST log all reminder events in the event log
- **FR-051**: System MUST offer a "Request Extension" option to customers approaching or past due dates
- **FR-052**: System MUST log extension requests and route them to backend for approval review
- **FR-053**: System MUST send approval or denial messages with new payment terms if extension is approved
- **FR-054**: System MUST send a "Final Warning" message after missed payment with deadline and consequences
- **FR-054A**: System MUST trigger asset lock workflow 15 days past due date
- **FR-054B**: System MUST reduce grace period by 5 days for subsequent late payments if extension was previously granted
- **FR-054C**: System MUST NOT charge monetary late payment penalties
- **FR-054D**: System MUST mark customers with late payments as ineligible for future loans
- **FR-055**: System MUST send lock command to custom pre-installed lock app on device when asset lock is triggered

**Distributor Operations & Dashboard**

- **FR-056**: System MUST provide distributor dashboard via Next.js frontend for ID verification, payment confirmation, and handover management
- **FR-056A**: System MUST authenticate distributors using JWT with refresh tokens stored in httpOnly cookies
- **FR-056B**: System MUST implement role-based access control for distributor dashboard features
- **FR-056C**: System MUST set session timeout to 2 hours for distributor staff, 30 minutes for customers, 1 hour for admin/CS agents
- **FR-056D**: System MUST maintain WhatsApp bot conversation state in PostgreSQL/Supabase with 24-hour session expiry
- **FR-057**: System MUST allow distributors to input customer ID for verification via dashboard
- **FR-058**: System MUST match customer ID against customer records and display customer details with selected phone
- **FR-059**: System MUST display selected phone model, customer information, and KYC details to distributors upon ID match

**Inventory Management**

- **FR-060**: System MUST display real-time inventory dashboard showing current stock per location
- **FR-060A**: System MUST sync inventory changes instantly via websockets on every transaction
- **FR-061**: System MUST update inventory within 30 seconds of sales or deliveries
- **FR-062**: System MUST allow distributors to filter inventory by model, status, or location
- **FR-063**: System MUST record distributor ID and timestamp for each sale
- **FR-064**: System MUST calculate commission amounts for each distributor sale
- **FR-064A**: System MUST calculate commissions as fixed percentage of device sale price (configurable, default 3-5%)
- **FR-065**: System MUST display monthly commission summaries via distributor dashboard
- **FR-066**: System MUST maintain handover history logs searchable by customer ID
- **FR-067**: System MUST include timestamp, asset ID, and payment status in handover logs
- **FR-068**: System MUST allow distributors to export handover logs
- **FR-069**: System MUST monitor inventory levels against defined thresholds
- **FR-070**: System MUST send WhatsApp or dashboard alerts to distributors when inventory falls below threshold
- **FR-071**: System MUST allow distributors to submit restock requests via dashboard

**Admin Dashboard & System Monitoring**

- **FR-082**: System MUST provide admin portal with comprehensive dashboard for system monitoring
- **FR-082A**: System MUST implement role-based permissions: System Admin (full access), Finance Manager (financial reports + payment reconciliation), Risk Manager (KYC review + risk config + asset locks), CS Agent (tickets + customer profiles + manual adjustments)
- **FR-082B**: System MUST authenticate admin users using JWT with refresh tokens stored in httpOnly cookies
- **FR-083**: System MUST display key metrics on admin dashboard: total active loans, total customers, payment success rate, average response time, system uptime
- **FR-084**: System MUST show all microservices health status (Healthy/Degraded/Down) with last health check timestamp
- **FR-085**: System MUST display transaction volume charts by time period (today/week/month): KYC submissions, qualifications, phone selections, payments, handovers
- **FR-086**: System MUST generate alerts when error thresholds are exceeded and send to admins via email/SMS
- **FR-086A**: System MUST integrate with Twilio SendGrid for email notifications to admins
- **FR-086B**: System MUST integrate with Twilio SMS for SMS notifications to admins
- **FR-087**: System MUST provide drill-down capability from metrics to granular data with filtering and export options
- **FR-088**: System MUST log all user actions (admin, distributor, customer) with timestamp, user ID, action type, and IP address in audit logs
- **FR-089**: System MUST allow admins to search and filter audit logs by date range, user, action type, and entity

**Admin Distributor & Inventory Management**

- **FR-090**: System MUST allow admins to create new distributor accounts with: Name, Email, Phone, Location, Commission Rate, Access Level
- **FR-091**: System MUST generate login credentials for new distributors and send welcome email automatically
- **FR-092**: System MUST display distributor list with: Name, Location, Status (Active/Inactive), Total Sales, Commission Earned, Last Login
- **FR-093**: System MUST allow admins to deactivate distributor accounts, revoke access, and reassign pending transactions
- **FR-093A**: System MUST automatically identify nearest active distributor when reassigning pending transactions from deactivated distributor
- **FR-093B**: System MUST notify affected customers of new distributor location via WhatsApp when their transactions are reassigned
- **FR-094**: System MUST notify distributors when their account is deactivated
- **FR-095**: System MUST allow admins to add inventory stock with: Phone Model, Quantity, Serial Numbers (CSV bulk upload), Location, Supplier Reference, Purchase Cost
- **FR-096**: System MUST assign unique asset ID to each device when stock is added and generate stock receipt
- **FR-097**: System MUST allow admins to transfer stock between locations with validation, transfer record creation, and inventory updates at both locations
- **FR-097A**: System MUST require admin approval for all stock transfers before execution
- **FR-098**: System MUST notify receiving distributor when stock transfer is initiated
- **FR-099**: System MUST display commission dashboard with per-distributor breakdown: Sales Count, Total Sales Value, Commission Rate, Commission Earned, Payment Status (Pending/Paid)
- **FR-100**: System MUST allow admins to approve commission payouts, mark as paid, record payout date/method, generate receipt, and notify distributor

**Customer Service & Dispute Resolution**

- **FR-101**: System MUST provide customer service portal displaying all open tickets with: Reference Number, Customer Name, Issue Type, Priority, Created Date, Status
- **FR-101A**: System MUST assign tickets automatically using round-robin with priority weighting (urgent tickets assigned first)
- **FR-102**: System MUST display full ticket details including: WhatsApp conversation history, issue description, customer profile link, resolution options
- **FR-103**: System MUST allow CS agents to view complete customer profile: KYC details, qualification status, selected phone, loan status, payment history, WhatsApp interactions, previous tickets
- **FR-104**: System MUST allow CS agents to override rejections with justification and re-qualify customers
- **FR-105**: System MUST display all payment attempts with: Transaction ID, Gateway Response, Amount, Timestamp, Reconciliation Status for dispute resolution
- **FR-106**: System MUST allow CS agents to manually reconcile payments, update loan balance, send confirmation to customer, and log adjustment
- **FR-107**: System MUST display payment extension request context: Current due date, amount due, payment history, default risk score, recommended action
- **FR-107A**: System MUST evaluate extension requests based on payment history and default risk score (good history = approve, poor = deny)
- **FR-108**: System MUST allow CS agents to approve/deny extensions, update due dates, recalculate schedules, send WhatsApp confirmation, and log approval with reason
- **FR-109**: System MUST require resolution notes when closing tickets, update status to "Resolved", send closure notification, and archive ticket

**Financial Operations & Reporting**

- **FR-110**: System MUST display financial summary dashboard: Total Disbursed, Total Collected, Outstanding Balance, Default Rate, Revenue (Interest + Margins)
- **FR-111**: System MUST generate loan portfolio report showing: Loan ID, Customer Name, Phone Model, Disbursement Date, Loan Amount, Outstanding Balance, Days Past Due, Status
- **FR-112**: System MUST allow report export in multiple formats: CSV, Excel, PDF with filters for: Date Range, Loan Status, Distributor, Phone Model
- **FR-113**: System MUST display payment reconciliation report with: Transaction ID, Customer, Amount, Payment Method, Gateway Fee, Net Amount, Fineract Reconciliation Status
- **FR-113A**: System MUST create support ticket for finance manager manual review when payment reconciliation mismatch is found
- **FR-114**: System MUST provide "Reconcile All" function that matches payments to Fineract transactions, flags mismatches, and generates reconciliation report
- **FR-115**: System MUST display revenue breakdown by: Interest Income, Asset Margin, Payment Gateway Fees, Net Revenue with charts by month/distributor/product
- **FR-116**: System MUST generate RBZ FIU compliance reports with: New customers (KYC records), Loan disbursements, Large transactions, Default cases, Customer demographics
- **FR-117**: System MUST format compliance reports according to RBZ FIU requirements with all required fields and validation

**Compliance & Risk Management**

- **FR-118**: System MUST display risk dashboard with: Default Rate (current/trend), Days Past Due Distribution, Asset Lock Status, Flagged KYC Applications, High-Risk Customers
- **FR-119**: System MUST flag KYC applications for: Duplicate ID, Invalid Next of Kin, Blacklisted phone number, Suspicious patterns
- **FR-119A**: System MUST auto-flag KYC applications with: Duplicate ID + blacklisted phone + invalid Next of Kin format + suspicious patterns (same address for multiple customers, rapid applications)
- **FR-120**: System MUST display flagged KYC details with: Flagged fields, reason for flag, customer submission data, recommended action (Approve/Reject/Request More Info)
- **FR-121**: System MUST allow risk managers to approve/reject flagged KYC with reason, notify customer, archive application, and log with audit trail
- **FR-122**: System MUST allow risk managers to configure risk parameters: Minimum qualification score, Next of Kin verification weight, ID validation rules, Default thresholds
- **FR-123**: System MUST validate risk parameter changes, apply changes, log configuration with old/new values, and notify admins
- **FR-124**: System MUST display default dashboard showing customers by days past due (1-30, 31-60, 61-90, 90+), total at-risk value, asset lock recommendations
- **FR-125**: System MUST allow risk managers to manually trigger asset lock, send lock command to device, log action, update loan status to "Asset Locked", and send final notice to customer
- **FR-126**: System MUST provide admin audit log access with filters: Date Range, User, Action Type, Entity (Customer/Loan/Inventory) and export capability

**System Integration & Reliability**

- **FR-072**: System MUST implement retry logic with exponential backoff for Apache Fineract API calls
- **FR-072A**: System MUST implement token bucket rate limiting for Apache Fineract API: 100 requests/minute with burst allowance of 20
- **FR-073**: System MUST implement circuit breaker patterns for payment gateway integrations
- **FR-073A**: System MUST block payment attempts and notify customers with estimated recovery time when both EcoCash and Omari gateways are simultaneously unavailable
- **FR-073B**: System MUST monitor payment gateway health status and provide recovery time estimates based on historical uptime data
- **FR-074**: System MUST queue WhatsApp messages when rate limits are reached
- **FR-075**: System MUST implement webhook verification for all incoming payment notifications
- **FR-076**: System MUST maintain event sourcing for all customer state changes
- **FR-077**: System MUST provide health check endpoints for all microservices
- **FR-078**: System MUST implement distributed tracing for cross-service operations
- **FR-079**: System MUST log all API calls with request/response payloads for debugging
- **FR-080**: System MUST retain customer KYC records, loan transaction history, and audit logs for 7 years from loan closure or account termination
- **FR-081**: System MUST implement automated data retention policies with secure archival and deletion procedures compliant with RBZ FIU requirements

**Consignment Inventory Management**

- **FR-127**: System MUST track all inventory as "Lynia Finance owned, consignment at Distributor X"
- **FR-128**: System MUST record each phone with: IMEI, Model, Retail Price, Purchase Date, Consignment Location
- **FR-129**: System MUST prevent inventory deletion without admin approval
- **FR-130**: System MUST track inventory status: Available, Handed Over, Damaged, Lost, Stolen, Returned to Lynia Finance
- **FR-131**: WhatsApp bot MUST show phones available at customer's nearest distributor
- **FR-132**: Phone list MUST display: Model, Price, Monthly Repayment (8 months), Current Stock Count
- **FR-133**: System MUST update stock count in real-time as phones are handed over
- **FR-134**: System MUST show "Limited Stock" if quantity < 5 units at distributor
- **FR-135**: System MUST show "Out of Stock" if quantity = 0 (but allow customer to see other locations)
- **FR-136**: System MUST NOT reserve inventory when customer selects phone via WhatsApp
- **FR-137**: Customer phone selection is stored as "tentative_selection" for reference only
- **FR-138**: System MUST allow multiple customers to select same phone simultaneously
- **FR-139**: WhatsApp bot MUST inform customer: "Please visit distributor to confirm phone availability and complete purchase"
- **FR-140**: System MUST track tentative selections for analytics (popular models, selection vs completion rate)
- **FR-141**: When customer arrives, distributor MUST verify phone availability in real-time system
- **FR-142**: If tentatively selected phone is unavailable, distributor MUST offer alternatives from current stock
- **FR-143**: System MUST allow distributor to show alternative phones with similar price/features
- **FR-144**: Distributor MUST confirm final phone selection in system before proceeding to handover
- **FR-145**: System MUST update customer's loan application with final confirmed phone (IMEI, model, price)
- **FR-146**: Distributor MUST scan/enter phone IMEI to initiate handover
- **FR-147**: System MUST verify: Phone exists in inventory, Phone status = Available, Phone location = Current distributor
- **FR-148**: System MUST mark phone status as "Handed Over" with timestamp, customer_id, distributor_staff_id
- **FR-149**: System MUST deduct 1 from distributor's available stock count immediately
- **FR-150**: System MUST trigger commission calculation event upon handover confirmation
- **FR-151**: System MUST send handover confirmation to customer via WhatsApp: "Phone [Model] IMEI [XXXX] handed over. Warranty: 6 months"

**Commission Calculation & Weekly Payment**

- **FR-152**: System MUST calculate commission upon phone handover confirmation
- **FR-153**: Commission amount = Device Retail Price × Commission Rate (3-5%)
- **FR-154**: Commission rate MUST be configurable per distributor (default: 5%)
- **FR-155**: System MUST create record in distributor_commissions table with status: Pending
- **FR-156**: System MUST include: distributor_id, staff_id, loan_id, phone_imei, retail_price, commission_rate, commission_amount, handover_date
- **FR-157**: System MUST run weekly commission batch job every Monday at 9:00 AM
- **FR-158**: Batch MUST aggregate all "Pending" commissions from previous week (Monday-Sunday)
- **FR-159**: System MUST group commissions by distributor_id
- **FR-160**: System MUST generate commission statement per distributor with: Transaction list, Total phones handed over, Total commission owed, Payment date
- **FR-161**: System MUST change commission status from "Pending" to "Approved"
- **FR-162**: System MUST send commission statement PDF to distributor via email and WhatsApp
- **FR-163**: Admin MUST review weekly commission batch before payment (Monday 9 AM - 5 PM)
- **FR-164**: Admin can: Approve All, Approve Selected, Hold for Review, Dispute
- **FR-165**: Upon admin approval, system MUST process payments via EcoCash mobile money OR bank transfer
- **FR-166**: System MUST mark commission status as "Paid" with payment_date, payment_method, payment_reference
- **FR-167**: System MUST send payment confirmation to distributor: "Commission payment of $XXX processed via [METHOD]. Reference: [REF]"
- **FR-168**: If payment fails, system MUST mark as "Failed" and create CS ticket for manual resolution
- **FR-169**: System MUST retry failed payments automatically next business day (max 3 retries)
- **FR-170**: Distributor MUST be able to view commission history in distributor dashboard
- **FR-171**: Dashboard MUST show: Pending commissions, Paid commissions (last 6 months), Payment dates, Transaction details
- **FR-172**: Distributor MUST be able to download commission statements as PDF
- **FR-173**: Distributor MUST be able to dispute commission amount within 7 days of payment
- **FR-174**: System MUST create CS ticket for commission disputes with expected vs actual amounts
- **FR-175**: Finance manager MUST resolve disputes within 5 business days
- **FR-176**: Admin MUST be able to manually adjust commission (increase/decrease) with reason
- **FR-177**: System MUST log all commission adjustments in audit trail with: admin_id, adjustment_amount, reason, timestamp
- **FR-178**: Adjustments MUST be included in next weekly batch payment
- **FR-179**: System MUST notify distributor of adjustments via WhatsApp: "Commission adjustment: [+/-]$X. Reason: [REASON]"

**Inventory Reconciliation & Shrinkage Management**

- **FR-180**: System MUST require monthly physical inventory reconciliation by distributor (1st-5th of each month)
- **FR-181**: Distributor MUST count all physical phones and enter quantities per model in system
- **FR-182**: System MUST compare physical count vs system count (Available + Reserved status)
- **FR-183**: System MUST calculate discrepancy = System Count - Physical Count
- **FR-184**: System MUST flag discrepancies > 0 for admin review
- **FR-185**: System MUST require distributor to photograph all phone IMEIs during reconciliation
- **FR-186**: For each discrepancy, admin MUST investigate and categorize: Damaged, Lost, Stolen, Customer Has It (system error), Transferred (not recorded)
- **FR-187**: Admin MUST mark inventory item status accordingly and add investigation notes
- **FR-188**: If Damaged: System MUST allow admin to mark as "Write-off" or "Repair Required"
- **FR-189**: If Lost/Stolen: System MUST create incident report with police report upload option
- **FR-190**: If System Error: System MUST correct inventory count without penalizing distributor
- **FR-191**: System MUST charge distributor for Lost/Stolen phones at full retail price
- **FR-192**: Admin MUST approve shrinkage charge before applying to distributor account
- **FR-193**: System MUST deduct shrinkage charge from future commission payments (automatic offset)
- **FR-194**: If commissions insufficient, system MUST generate invoice for distributor to pay
- **FR-195**: System MUST send shrinkage charge notification to distributor with: Phone IMEI, Model, Charge amount, Payment due date
- **FR-196**: Distributor MUST be able to dispute shrinkage charges via admin portal (CS ticket created)

**Commission Immutability**

- **FR-197**: Commission earned on phone handover is FINAL and non-reversible
- **FR-198**: Customer returns, loan defaults, or phone repossessions do NOT affect distributor commission
- **FR-199**: Commission is only earned when physical handover occurs (IMEI scanned, customer receives phone)
- **FR-200**: If loan cancelled before handover, no commission is created
- **FR-201**: Distributor disputes must be raised within 7 days of commission statement receipt

**Payment Gateway Integration & Race Conditions**

- **FR-202**: System MUST use transaction_id as idempotency key to prevent duplicate payment processing
- **FR-203**: System MUST store all payment callbacks in payment_callbacks table with status: Received/Processing/Applied/Duplicate
- **FR-204**: Payment processing MUST use atomic SELECT FOR UPDATE operation on payment record
- **FR-205**: If payment already marked Completed, system MUST return 200 OK and log as duplicate callback
- **FR-206**: WhatsApp bot MUST poll payment status every 5 seconds while customer waiting (max 2 minutes)
- **FR-207**: If payment callback timeout (>2 min), system MUST show "Payment processing, you'll receive confirmation via WhatsApp"
- **FR-208**: Background job MUST check Pending payments >5min old and query gateway API to reconcile
- **FR-209**: System MUST implement exponential backoff retry for failed Fineract API calls: 1min, 5min, 15min, 1hr, 4hr (max 5 retries)
- **FR-210**: After 5 failed retries, system MUST create CS ticket for manual finance team review

**WhatsApp Session Management**

- **FR-211**: System MUST retain expired WhatsApp session data for 7 days
- **FR-212**: When customer messages after session expiry, system MUST retrieve last session context
- **FR-213**: System MUST prompt: "Welcome back! You were completing [STEP]. Would you like to continue? (Yes/No)"
- **FR-214**: If customer chooses Yes, system MUST restore context and continue from last step
- **FR-215**: For critical notifications (loan approved, KYC rejected), system MUST send SMS fallback if WhatsApp message fails
- **FR-216**: System MUST use WhatsApp template messages for notifications (bypass 24hr session window requirement)

**Duplicate Customer Detection**

- **FR-217**: System MUST use National ID Number as primary customer identifier
- **FR-218**: If National ID exists with Active loan, system MUST block new application: "You have an active loan. Complete it first."
- **FR-219**: If National ID exists with Defaulted/Written-off loan, system MUST block application: "Contact customer service"
- **FR-220**: If National ID exists with all loans Completed, system MUST allow new application and link to existing customer_id
- **FR-221**: If customer applies with different phone number, system MUST update customer record and send confirmation to BOTH numbers
- **FR-222**: If customer has 2+ different phone numbers in history, system MUST flag for manual verification (stolen ID risk)

**Asset Lock Grace Period Management**

- **FR-223**: System MUST track customer_payment_history: count of late payments (>7 days after due date) across all loans
- **FR-224**: Grace period formula: 0-1 late incidents = 15 days, 2-3 = 12 days, 4-5 = 10 days, 6+ = 7 days (minimum)
- **FR-225**: System MUST store grace_period_days in loan record when loan created (based on customer history at that time)
- **FR-226**: Device lock MUST trigger when days_overdue >= grace_period_days
- **FR-227**: System MUST display grace period to customer at loan approval: "Your grace period is X days for this loan"

**Next of Kin Verification**

- **FR-228**: After customer provides Next of Kin phone numbers, system MUST send SMS verification: "You've been listed as emergency contact for [Customer Name]. Reply YES to confirm."
- **FR-229**: System MUST store verification status in next_of_kin table: Pending/Verified/Failed
- **FR-230**: System MUST wait 24 hours for Next of Kin SMS responses
- **FR-231**: Loan approval requirement: At least 1 Next of Kin MUST verify (reply YES)
- **FR-232**: If 0 verifications after 24hrs, system MUST request customer provide different contacts
- **FR-233**: After 3 failed verification attempts, system MUST escalate to manual CS review
- **FR-234**: During default recovery, system MUST contact only Verified Next of Kin contacts first

**Distributor Deactivation Workflow**

- **FR-235**: Admin MUST specify deactivation reason: Fraud/Contract End/Performance/Other
- **FR-236**: System MUST check: active loans count, pending commissions sum, inventory count before deactivation
- **FR-237**: Immediate deactivation (fraud): Forfeit all pending commissions, reassign active loans to nearest distributor, require inventory return within 7 days
- **FR-238**: Graceful deactivation (30-day notice): Pay all earned commissions, allow completion of pending handovers, transfer inventory to other distributors
- **FR-239**: System MUST mark distributor status as Deactivated and block dashboard login
- **FR-240**: System MUST update all loan records: reassign distributor_id to new distributor
- **FR-241**: System MUST archive all distributor data (retain for 7 years per RBZ compliance)

**Payment Reconciliation Failure Handling**

- **FR-242**: System MUST use two-phase commit: Phase 1 = Gateway_Confirmed, Phase 2 = Fineract_Confirmed
- **FR-243**: If Fineract API call fails, system MUST store in payment_reconciliations table with status: Failed
- **FR-244**: System MUST retry failed Fineract reconciliations with exponential backoff (5 attempts)
- **FR-245**: After 5 retries, system MUST mark as Manual_Review_Required and create CS ticket
- **FR-246**: System MUST notify customer: "Payment received ($X). Confirmation pending. You'll be notified within 24hrs."
- **FR-247**: Background reconciliation job MUST run every 6 hours: query Fineract transactions, compare with payments table, auto-resolve matches
- **FR-248**: Admin dashboard MUST show list of unreconciled payments (>24hrs old) with one-click manual reconciliation

**WhatsApp Rate Limiting**

- **FR-249**: System MUST implement token bucket rate limiter: 70 messages/second (safe margin below Twilio's 80/sec limit)
- **FR-250**: System MUST prioritize messages: Priority 1 (customer responses, 2s timeout), Priority 2 (payment confirmations, 30s timeout), Priority 3 (reminders, 5min timeout), Priority 4 (marketing, 1hr timeout)
- **FR-251**: System MUST use separate SQS queues per priority level
- **FR-252**: System MUST process Priority 1 queue first, then 2, then 3, then 4
- **FR-253**: For batch notifications (800+ daily reminders), system MUST spread over 15-minute window (e.g., 8:00-8:15 AM)
- **FR-254**: System MUST trigger CloudWatch alarm if Priority 1 queue depth >100 for >2 minutes
- **FR-255**: Dashboard MUST show WhatsApp message throughput (messages/sec, success rate, avg latency)

**ML Model Versioning & Rollback**

- **FR-256**: System MUST store ML models in S3 with metadata in model_versions table: version_id, model_file_path, training_date, accuracy_metrics, status (Draft/Active/Retired)
- **FR-257**: New ML model MUST be deployed as Draft first
- **FR-258**: System MUST A/B test new model: 10% traffic to new model, 90% to current Active model for 2 weeks
- **FR-259**: System MUST monitor: approval rate, predicted default rate, actual default rate (tracked in Fineract)
- **FR-260**: If new model metrics acceptable, system MUST promote to Active (100% traffic)
- **FR-261**: If new model metrics degrade, system MUST retire new model and remain on previous Active model
- **FR-262**: Admin MUST be able to rollback ML model with one click (mark current as Retired, promote previous Active)
- **FR-263**: System MUST log every ML prediction: customer_id, model_version, input_features, prediction, timestamp
- **FR-264**: Finance manager MUST approve ML model deployment before A/B test begins

### Key Entities

- **Customer**: Represents an individual applying for or holding a loan. Key attributes include: Full Name, National ID Number, Address, Phone Number, Qualification Status, Loan Status, Fineract Customer ID. Relationships: has multiple Next of Kin, has one or more Loans, interacts with Distributor Staff for handovers.

- **Next of Kin**: Represents an emergency contact for a customer. Key attributes include: Full Name, National ID Number, Phone Number. Relationships: belongs to one Customer.

- **Loan**: Represents a financing agreement for an asset managed in Apache Fineract. Key attributes include: Fineract Loan ID, Loan Amount, Monthly Repayment Amount, Repayment Period (8 months), Outstanding Balance, Next Due Date, Payment History, Loan Status (Pending, Active, Completed, Defaulted), Deposit Amount (percentage of phone price). Relationships: belongs to one Customer, associated with one Asset, managed in Apache Fineract.

- **Asset**: Represents a physical device being financed. Key attributes include: Asset Type (Phone, Motorbike, Vehicle), Model, Asset ID (serial number or unique identifier), Lock Status, Handover Timestamp, Current Location, Verified by Distributor Staff (boolean). Relationships: belongs to one Loan, assigned to one Customer, handed over by one Distributor Staff member.

- **Payment**: Represents a financial transaction processed through payment gateways. Key attributes include: Payment Amount, Payment Method (EcoCash, Omari), Payment Status, Transaction ID, Gateway Response, Payment Timestamp, Fineract Transaction ID. Relationships: associated with one Loan or Deposit, made by one Customer, reconciled in Apache Fineract.

- **Handover**: Represents the physical transfer of an asset to a customer after payment and verification. Key attributes include: Handover Timestamp, Customer ID Verified, Asset ID, Distributor Staff ID, Location, Verification Method, Deposit Payment ID, Payment Confirmed (boolean). Relationships: completed by one Distributor Staff member, received by one Customer, involves one Asset, linked to one Payment.

- **Inventory**: Represents individual phones owned by Lynia Finance and stored at distributor locations (consignment model). Key attributes include: IMEI (unique identifier), Asset Model, Retail Price, Purchase Date, Ownership (always "Lynia Finance"), Consignment Location ID (distributor), Status (Available, Handed Over, Damaged, Lost, Stolen, Returned), Handed Over Date, Handed Over to Customer ID, Handed Over by Staff ID, Last Updated Timestamp. Relationships: stored at one Distributor Location, managed by Distributor Staff, tracked in PostgreSQL, linked to Asset entity upon handover.

- **Distributor Commission**: Represents commission payments owed to distributors for phone handovers (3-5% of retail price). Key attributes include: Commission ID, Distributor ID, Distributor Staff ID, Loan ID, Phone IMEI, Retail Price, Commission Rate (%), Commission Amount, Handover Date, Status (Pending, Approved, Paid, Failed, Disputed), Payment Date, Payment Method (EcoCash, Bank Transfer), Payment Reference, Created At. Relationships: earned by one Distributor Staff member, paid to one Distributor, linked to one Loan, triggered by one phone handover event.

- **Customer Tentative Selection**: Represents customer's phone choice via WhatsApp (non-binding, informational only). Key attributes include: Selection ID, Customer Phone Number, Customer ID (if qualified), Phone Model, Phone Price, Nearest Distributor ID, Selected At, Expires At (24 hours), Status (Tentative, Confirmed, Changed, Expired), Confirmed Phone IMEI (if customer completes purchase), Confirmed At. Relationships: linked to one Customer (if qualified), references one Distributor Location, may be converted to actual handover (linked to Inventory item by IMEI).

- **Inventory Reconciliation**: Represents monthly physical inventory counts at distributor locations (required 1st-5th of each month). Key attributes include: Reconciliation ID, Distributor ID, Reconciliation Date, System Count (from Inventory table), Physical Count (distributor input), Discrepancy (System - Physical), Discrepancy Reason (Damaged/Lost/Stolen/System Error/Transferred), Photo Evidence URLs, Conducted By Staff ID, Approved By Admin ID, Status (Pending, Under Investigation, Resolved, Disputed), Shrinkage Charge Amount, Created At, Resolved At. Relationships: conducted by one Distributor Staff member, approved by one Admin, linked to one Distributor Location, may generate shrinkage charges offset against commissions.

- **Reminder Event**: Represents automated payment notifications sent via WhatsApp. Key attributes include: Reminder Type (3-day, 1-day, final warning), Sent Timestamp, Customer ID, Loan ID, Due Date, Amount Due, Delivery Status. Relationships: sent to one Customer, associated with one Loan.

- **Customer Service Ticket**: Represents support requests routed from WhatsApp. Key attributes include: Reference Number, Customer ID, Request Type (Rejection, Dispute, General), Status (Open, In Progress, Resolved), Created Timestamp, Assigned Agent, Resolution Notes. Relationships: created by one Customer, assigned to one Customer Service Agent, may reference Loan or Payment for disputes.

- **Payment Gateway Transaction**: Represents external payment system records. Key attributes include: Gateway Name (EcoCash, Omari), External Transaction ID, Webhook Payload, Status (Pending, Confirmed, Failed), Timestamp, Reconciliation Status. Relationships: linked to one Payment, processed by external gateway.

- **Integration Event**: Represents cross-system communication logs. Key attributes include: Event Type (Customer Created, Loan Approved, Payment Received), Source System, Target System, Payload, Status, Timestamp, Retry Count. Relationships: may reference Customer, Loan, Payment, or other entities depending on event type.

- **Admin User**: Represents system administrators with full platform access. Key attributes include: Admin ID, Name, Email, Role (System Admin, Finance Manager, Risk Manager), Access Level, Active Status, Last Login, Created Date. Relationships: creates and manages Distributor accounts, reviews Flagged KYC Applications, generates Reports, configures Risk Parameters.

- **Customer Service Agent**: Represents support staff handling customer tickets. Key attributes include: Agent ID, Name, Email, Active Status, Assigned Tickets Count, Resolution Rate, Last Login. Relationships: assigned multiple Customer Service Tickets, accesses Customer profiles, performs Manual Reconciliations, approves Payment Extensions.

- **Distributor**: Represents physical location/partner managing device distribution. Key attributes include: Distributor ID, Name, Email, Phone, Physical Location, Commission Rate, Active Status, Total Sales, Total Commission Earned, Created Date, Deactivated Date. Relationships: employs multiple Distributor Staff, manages Inventory at Location, receives Stock Transfers, earns Commissions.

- **Distributor Staff**: Represents individual staff member at distributor location. Key attributes include: Staff ID, Name, Email, Distributor ID, Role (Manager, Sales Agent), Access Level, Active Status, Last Login. Relationships: works for one Distributor, completes Handovers, accesses Inventory Dashboard, verifies Customer IDs.

- **Stock Transfer**: Represents inventory movement between locations. Key attributes include: Transfer ID, From Location, To Location, Asset IDs (list), Initiated By (Admin ID), Transfer Date, Received Date, Status (Pending, In Transit, Received, Cancelled). Relationships: initiated by Admin User, moves Inventory between Distributors, updates multiple Asset records.

- **Flagged KYC Application**: Represents suspicious KYC submissions requiring review. Key attributes include: Flag ID, Customer ID, Flag Reason (Duplicate ID, Invalid Next of Kin, Blacklisted Phone, Suspicious Pattern), Flagged Date, Review Status (Pending, Approved, Rejected), Reviewed By (Admin ID), Review Notes, Resolution Date. Relationships: linked to one Customer, reviewed by Risk Manager, may result in rejection or approval override.

- **Risk Parameter Configuration**: Represents system risk scoring settings. Key attributes include: Config ID, Parameter Name (Min Qualification Score, Next of Kin Weight, ID Validation Rules, Default Thresholds), Parameter Value, Last Updated Date, Updated By (Admin ID), Previous Value, Change Reason. Relationships: configured by Risk Manager, affects Customer qualification scoring, logged in Audit Trail.

- **Report**: Represents generated financial and compliance reports. Key attributes include: Report ID, Report Type (Loan Portfolio, Payment Reconciliation, Revenue, RBZ FIU Compliance), Generated Date, Generated By (Admin ID), Date Range, Filters Applied, Export Format (CSV/Excel/PDF), File Path. Relationships: generated by Admin User or Finance Manager, may include Customer, Loan, and Payment data.

- **Audit Log Entry**: Represents system action tracking for compliance. Key attributes include: Log ID, Timestamp, User ID, User Type (Customer, Distributor, Admin, CS Agent), Action Type (Create, Update, Delete, Approve, Reject, Export), Entity Type (Customer, Loan, Inventory, Configuration), Entity ID, IP Address, Changes Made (JSON), Result (Success/Failure). Relationships: references any system entity, created automatically for all actions, retained for 7 years.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Customer Experience**

- **SC-001**: Customers can complete KYC submission and receive qualification response in under 5 minutes via WhatsApp
- **SC-002**: System processes qualification requests with 95% success rate during normal operation
- **SC-003**: Payment confirmation messages are sent within 30 seconds of backend confirmation for 99% of transactions
- **SC-004**: 90% of customers successfully complete their first repayment without requiring customer service intervention
- **SC-005**: Customer satisfaction score for onboarding process reaches 85% or higher based on post-onboarding surveys
- **SC-006**: 95% of qualified customers successfully select an asset and complete deposit payment
- **SC-007**: KYC data validation errors are caught and corrected before backend submission in 98% of cases

**Agent Operations**

- **SC-008**: Asset handover process (ID verification to confirmation) completes in under 2 minutes per customer
- **SC-009**: Agent inventory dashboard updates within 30 seconds of stock changes in 95% of cases
- **SC-010**: Agent commission calculations are accurate to within 1% of actual sales value
- **SC-011**: Agent productivity (handovers per day) increases by 40% compared to manual verification processes

**System Performance & Reliability**

- **SC-012**: System supports 1000 concurrent WhatsApp conversations without performance degradation
- **SC-013**: WhatsApp Bot response time averages under 2 seconds for simple queries (balance check, menu navigation)
- **SC-014**: Apache Fineract integration maintains 99.5% uptime with automatic retry and recovery
- **SC-015**: Payment gateway integration processes 99% of transactions successfully without manual intervention
- **SC-016**: End-to-end loan application (KYC to approval) completes in under 10 minutes for 90% of customers
- **SC-017**: System handles 10,000 daily active users with less than 1% error rate

**Business Outcomes**

- **SC-018**: Reminder messages are delivered 3 days and 1 day before due date with 99% reliability
- **SC-019**: Default rate decreases by 30% compared to baseline due to automated reminders and extension options
- **SC-020**: Customer service escalation requests are logged and assigned reference numbers within 10 seconds
- **SC-021**: Inventory stockouts occur less than 5% of the time due to automated alerts and restock requests
- **SC-022**: 80% of customer inquiries are resolved through WhatsApp self-service without human intervention

## Constitution Alignment Verification

### Core Business Model Alignment
- ✅ Supports asset-backed lending for productive assets (phones initially, expandable to motorbikes and vehicles)
- ✅ Targets underbanked informal sector workers in Zimbabwe
- ✅ Implements remote asset locking capability (FR-040 triggers asset lock workflow)
- ✅ Revenue model through interest on loans and asset margins
- ✅ Risk mitigation through KYC validation, ID verification, and payment monitoring

### Technical Stack Integration
- ✅ **Apache Fineract**: Core loan management system (FR-023 to FR-031, SC-014)
- ✅ **WhatsApp Business API**: Primary customer interface (all customer-facing user stories, FR-001 to FR-012)
- ✅ **Payment Systems Integration**: EcoCash and Omari (FR-019, FR-020, FR-021, FR-022)
- ✅ **Next.js Frontend**: Agent dashboard and back-office (FR-041, User Story 7, 8)
- ✅ **PostgreSQL/Supabase**: Customer data, inventory, KYC records (FR-006, FR-049)
- ✅ **AWS Infrastructure**: Implied through scalability requirements (SC-012, SC-017)

### Architecture Principles Compliance
- ✅ **Microservices First**: Independent services for WhatsApp bot, customer management, loan processing, agent operations, inventory management
- ✅ **API-First Communication**: Integration requirements (FR-061 to FR-068) define API patterns
- ✅ **Event-Driven Architecture**: Event sourcing (FR-065), integration events, webhook handling (FR-021, FR-064)
- ✅ **Library-First Development**: Each service can be developed as standalone library with clear boundaries
- ✅ **Test-Driven Development**: All 8 user stories have detailed acceptance scenarios for test-first approach
- ✅ **Integration Testing Focus**: WhatsApp interactions, payment flows, Apache Fineract integration, gateway webhooks
- ✅ **Observability**: Structured logging (FR-068), distributed tracing (FR-067), health checks (FR-066), audit trails (FR-011, FR-035, FR-046)

### Core Workflows Coverage
- ✅ **Customer Journey**: All 6 steps covered
  1. WhatsApp Onboarding (User Story 1, FR-001 to FR-002)
  2. KYC Collection (User Story 1, FR-003 to FR-006)
  3. Credit Assessment (User Story 1, FR-007 to FR-008)
  4. Device Selection (User Story 2, FR-013 to FR-014)
  5. Payment Processing (User Story 2, FR-015 to FR-022)
  6. Asset Distribution (User Story 3, FR-041 to FR-048)

- ✅ **Agent Operations**: All 5 steps covered
  1. Registration (implied in FR-042, User Story 7)
  2. Inventory Management (User Story 7, 8, FR-049 to FR-060)
  3. Customer Verification (User Story 3, 7, FR-042 to FR-044)
  4. Payment Confirmation (User Story 3, FR-048, payment gateway integration)
  5. Commission Tracking (User Story 7, FR-053 to FR-054)

- ✅ **Risk Management**: All 5 steps covered
  1. Credit Scoring (FR-007)
  2. Fraud Detection (FR-004, FR-005, FR-043, ID verification)
  3. Asset Tracking (FR-048, Asset entity, inventory management)
  4. Payment Monitoring (FR-032 to FR-035, User Story 4, reminder events)
  5. Default Management (User Story 5, FR-036 to FR-040, extension requests, asset lock)

### Compliance Requirements Coverage
- ✅ **Data Protection**:
  - Encryption at rest (FR-006)
  - Access control (agent dashboard access levels, FR-042)
  - Audit logging (FR-011, FR-035, FR-046, FR-068)
  - GDPR alignment through secure data handling

- ✅ **Financial Compliance**:
  - KYC/AML procedures (FR-003, FR-004, FR-005, ID validation)
  - Transaction monitoring (FR-030, FR-035, payment logs)
  - Regulatory reporting capability (handover logs FR-055 to FR-057, payment logs, event sourcing FR-065)
  - License requirements support through audit trails and compliance logging

### System Quality Attributes
- ✅ **Scalability**: Concurrent user support (SC-012, SC-017), microservices architecture
- ✅ **Performance**: Response time targets (SC-013), update speeds (SC-009), process completion times (SC-001, SC-008, SC-016)
- ✅ **Reliability**: Uptime requirements (SC-014), retry logic (FR-061), circuit breakers (FR-062), health checks (FR-066)
- ✅ **Security**: Encryption, webhook verification (FR-064), access control, audit logging
- ✅ **Transparency**: Event logging (FR-065), distributed tracing (FR-067), customer visibility through balance checks and payment history
