# Feature Specification: WhatsApp Bot for Device Financing

**Feature Branch**: `001-whatsapp-bot-lending`
**Created**: 2025-10-29
**Status**: Draft
**Input**: User description: "WhatsApp Bot for device financing - Customer onboarding, KYC, loan application, asset selection, payment collection, repayment management, and agent operations"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer Onboarding & KYC Submission (Priority: P1)

As a customer, I want to receive a greeting and submit my KYC details via WhatsApp, so that I can be evaluated for loan eligibility and understand if I qualify for device financing.

**Why this priority**: This is the entry point for all customers and the foundation of the lending process. Without KYC collection and qualification, no other feature can function. This delivers immediate value by enabling the first customer interaction.

**Independent Test**: Can be fully tested by sending a WhatsApp message to the bot, receiving the greeting and terms, accepting them, submitting all KYC fields (Name, ID, Address, Phone, 2 Next of Kin with their details), and receiving a qualification response. Delivers value by qualifying or rejecting customers based on scoring logic.

**Acceptance Scenarios**:

1. **Given** a customer initiates contact with the WhatsApp bot, **When** the message is received, **Then** the customer receives a greeting message within 5 seconds with terms and conditions displayed or linked
2. **Given** the customer receives terms and conditions, **When** the customer replies "Accept" or similar keyword, **Then** the bot prompts for KYC information starting with Full Name
3. **Given** the customer is in KYC collection flow, **When** the customer submits Full Name, ID, Address, Phone Number, and 2 Next of Kin (each with Name, ID, Phone), **Then** all fields are validated for correct format (ID format, phone number length)
4. **Given** all KYC data is validated and submitted, **When** the backend scoring logic evaluates the customer, **Then** the customer receives either "Congratulations, you qualify" or "Sorry, you do not qualify" message
5. **Given** the customer is rejected, **When** the rejection message is sent, **Then** the customer is offered a "Talk to Customer Service" option
6. **Given** the customer made an error in KYC submission, **When** the customer requests "Retry KYC", **Then** the previous submission is cleared and the customer can submit new data

---

### User Story 2 - Asset Selection & Deposit Payment (Priority: P2)

As a qualified customer, I want to view available phones with repayment plans and pay a deposit via WhatsApp, so that I can select a device that fits my budget and secure it for collection.

**Why this priority**: This is the second critical step after qualification. It enables customers to select their asset and make payment, which is essential for the business model. Without this, qualified customers cannot proceed to obtain devices.

**Independent Test**: Can be fully tested by using a pre-qualified customer account, viewing the phone catalog with monthly repayment amounts, selecting a phone, receiving a payment link (EcoCash or Omari), completing payment, and receiving confirmation. Delivers value by converting qualified customers into paying customers.

**Acceptance Scenarios**:

1. **Given** a customer has been qualified, **When** the customer requests to view phones, **Then** the bot displays available phone models with monthly repayment amounts and repayment period (e.g., 8 months)
2. **Given** phone options are displayed, **When** the customer selects a phone via numbered reply or keyword, **Then** the selection is confirmed and the customer is prompted for payment method
3. **Given** the customer selects a payment method (EcoCash or Omari), **When** the bot generates the payment link or USSD code, **Then** the payment window opens successfully
4. **Given** payment is initiated, **When** the payment is confirmed by the backend, **Then** the customer receives a "Payment received" message within 30 seconds
5. **Given** payment is confirmed, **When** the confirmation is sent, **Then** the distributor is notified of the payment status and the customer is prompted to proceed to collection

---

### User Story 3 - Asset Collection & Verification (Priority: P2)

As a customer who has paid, I want to verify my identity with the distributor and collect my phone, so that I can walk away with a usable device and start making repayments.

**Why this priority**: This completes the customer acquisition journey and ensures proper handover with verification. It's critical for fraud prevention and customer satisfaction, as it delivers the physical asset to the customer.

**Independent Test**: Can be fully tested by having a distributor agent verify a paid customer's ID in the system, confirm the match, approve the handover, and verify that the customer receives a "Your phone is now active" WhatsApp message. Delivers value by completing the device handover securely.

**Acceptance Scenarios**:

1. **Given** a customer arrives at a distributor location with payment confirmed, **When** the distributor inputs the customer ID into the system, **Then** the system matches the ID and confirms eligibility
2. **Given** the ID is matched, **When** the distributor views the details, **Then** the system displays the reserved asset details and customer information
3. **Given** asset details are confirmed, **When** the distributor clicks "Approve" and logs the handover, **Then** the handover is recorded in the system with timestamp
4. **Given** handover is approved, **When** the system confirms the transaction, **Then** the customer receives a WhatsApp message "Your phone is now active"
5. **Given** handover is complete, **When** the loan record is updated, **Then** it includes the asset ID and handover timestamp

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

## Requirements *(mandatory)*

### Functional Requirements

**WhatsApp Bot - Customer-Facing**

- **FR-001**: System MUST send a greeting message with terms and conditions to customers within 5 seconds of initial WhatsApp contact
- **FR-002**: System MUST require customer acceptance of terms (via "Accept" keyword or similar) before proceeding to KYC collection
- **FR-003**: System MUST collect the following KYC fields: Full Name, ID Number, Address, Phone Number, and 2 Next of Kin (each with Name, ID Number, and Phone Number)
- **FR-004**: System MUST validate ID number format according to Zimbabwean national ID standards
- **FR-005**: System MUST validate phone number length and format (Zimbabwean mobile numbers)
- **FR-006**: System MUST store all KYC data securely in PostgreSQL or Apache Fineract with encryption at rest
- **FR-007**: System MUST evaluate customer qualification using backend scoring logic after KYC submission
- **FR-008**: System MUST return a qualification message ("Congratulations, you qualify" or "Sorry, you do not qualify") based on scoring results
- **FR-009**: System MUST offer a "Talk to Customer Service" option to rejected customers
- **FR-010**: System MUST route customer service requests to a live agent queue or ticketing system
- **FR-011**: System MUST log all customer service conversations with unique reference numbers
- **FR-012**: System MUST allow customers to retry KYC submission and clear previous data upon retry request
- **FR-013**: System MUST display available phone models with monthly repayment amounts and repayment period to qualified customers
- **FR-014**: System MUST allow customers to select a phone via numbered reply or keyword
- **FR-015**: System MUST generate payment links or USSD codes for EcoCash or Omari based on customer selection
- **FR-016**: System MUST track payment status and confirm payments within 30 seconds of backend confirmation
- **FR-017**: System MUST send "Payment received" confirmation message to customers after successful payment
- **FR-018**: System MUST notify distributors of customer payment status for collection preparation
- **FR-019**: System MUST allow customers to check loan balance via "Check Balance" command
- **FR-020**: System MUST return outstanding balance, next due date, and payment history when balance is requested
- **FR-021**: System MUST pull loan data from Apache Fineract or PostgreSQL for balance inquiries
- **FR-022**: System MUST allow customers to initiate repayments via WhatsApp with payment link or USSD code
- **FR-023**: System MUST log all repayment transactions and update loan balances
- **FR-024**: System MUST send repayment confirmation with updated balance after successful payment
- **FR-025**: System MUST send automatic payment reminders 3 days before due date
- **FR-026**: System MUST send automatic payment reminders 1 day before due date
- **FR-027**: System MUST include amount due, payment link, and due date in all reminders
- **FR-028**: System MUST log all reminder events in the event log
- **FR-029**: System MUST offer a "Request Extension" option to customers approaching or past due dates
- **FR-030**: System MUST log extension requests and route them to backend for approval review
- **FR-031**: System MUST send approval or denial messages with new payment terms if extension is approved
- **FR-032**: System MUST send a "Final Warning" message after missed payment with deadline and consequences
- **FR-033**: System MUST trigger backend asset lock workflow if payment remains unpaid after final warning deadline

**Agent Operations**

- **FR-034**: System MUST allow agents to input customer ID for verification via dashboard or mobile app
- **FR-035**: System MUST match customer ID against payment records and confirm eligibility for asset collection
- **FR-036**: System MUST display reserved asset details (model, asset ID) and customer information to agents upon ID match
- **FR-037**: System MUST allow agents to approve handover with a single "Approve" action
- **FR-038**: System MUST log all handovers with timestamp, agent ID, customer ID, and asset ID
- **FR-039**: System MUST send "Your phone is now active" WhatsApp message to customer upon handover approval
- **FR-040**: System MUST update loan records with asset ID and handover timestamp after approval
- **FR-041**: System MUST display real-time inventory dashboard showing current stock per location
- **FR-042**: System MUST update inventory within 30 seconds of sales or deliveries
- **FR-043**: System MUST allow agents to filter inventory by model, status, or location
- **FR-044**: System MUST record agent ID and timestamp for each sale
- **FR-045**: System MUST calculate commission amounts for each agent sale
- **FR-046**: System MUST display monthly commission summaries via agent dashboard
- **FR-047**: System MUST maintain handover history logs searchable by customer ID
- **FR-048**: System MUST include timestamp, asset ID, and payment status in handover logs
- **FR-049**: System MUST allow agents to export handover logs
- **FR-050**: System MUST monitor inventory levels against defined thresholds
- **FR-051**: System MUST send WhatsApp or dashboard alerts to agents when inventory falls below threshold
- **FR-052**: System MUST allow agents to submit restock requests via dashboard

### Key Entities

- **Customer**: Represents an individual applying for or holding a loan. Key attributes include: Full Name, National ID Number, Address, Phone Number, Qualification Status, Loan Status. Relationships: has multiple Next of Kin, has one or more Loans, interacts with Agents.

- **Next of Kin**: Represents an emergency contact for a customer. Key attributes include: Full Name, National ID Number, Phone Number. Relationships: belongs to one Customer.

- **Loan**: Represents a financing agreement for an asset. Key attributes include: Loan Amount, Monthly Repayment Amount, Repayment Period, Outstanding Balance, Next Due Date, Payment History, Loan Status (Active, Completed, Defaulted). Relationships: belongs to one Customer, associated with one Asset.

- **Asset**: Represents a physical device being financed. Key attributes include: Asset Type (Phone, Motorbike, Vehicle), Model, Asset ID (serial number or unique identifier), Lock Status, Handover Timestamp. Relationships: belongs to one Loan, assigned to one Customer, handed over by one Agent.

- **Payment**: Represents a financial transaction. Key attributes include: Payment Amount, Payment Method (EcoCash, Omari), Payment Status, Transaction ID, Payment Timestamp. Relationships: associated with one Loan or Deposit, made by one Customer.

- **Agent**: Represents a distributor staff member. Key attributes include: Agent ID, Name, Location, Commission Rate, Active Status. Relationships: completes multiple Handovers, manages Inventory at a Location, earns Commission from Sales.

- **Handover**: Represents the physical transfer of an asset to a customer. Key attributes include: Handover Timestamp, Customer ID Verified, Asset ID, Agent ID. Relationships: completed by one Agent, received by one Customer, involves one Asset.

- **Inventory**: Represents available stock at distributor locations. Key attributes include: Asset Model, Quantity Available, Location, Threshold Level, Last Updated Timestamp. Relationships: managed by Agents, associated with a Location.

- **Commission**: Represents earnings for agent sales. Key attributes include: Commission Amount, Sale Timestamp, Agent ID, Asset ID, Payment Status. Relationships: earned by one Agent, linked to one Sale/Handover.

- **Reminder Event**: Represents automated payment notifications. Key attributes include: Reminder Type (3-day, 1-day, final warning), Sent Timestamp, Customer ID, Loan ID, Due Date, Amount Due. Relationships: sent to one Customer, associated with one Loan.

- **Customer Service Ticket**: Represents support requests. Key attributes include: Reference Number, Customer ID, Request Type (Rejection, Dispute, General), Status (Open, In Progress, Resolved), Created Timestamp. Relationships: created by one Customer, assigned to an Agent or Support Staff.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Customers can complete KYC submission and receive qualification response in under 5 minutes via WhatsApp
- **SC-002**: System processes qualification requests with 95% success rate during normal operation
- **SC-003**: Payment confirmation messages are sent within 30 seconds of backend confirmation for 99% of transactions
- **SC-004**: Asset handover process (ID verification to confirmation) completes in under 2 minutes per customer
- **SC-005**: 90% of customers successfully complete their first repayment without requiring customer service intervention
- **SC-006**: Reminder messages are delivered 3 days and 1 day before due date with 99% reliability
- **SC-007**: Agent inventory dashboard updates within 30 seconds of stock changes in 95% of cases
- **SC-008**: Customer service escalation requests are logged and assigned reference numbers within 10 seconds
- **SC-009**: System supports 1000 concurrent WhatsApp conversations without performance degradation
- **SC-010**: Agent commission calculations are accurate to within 1% of actual sales value
- **SC-011**: Default rate decreases by 30% compared to baseline due to automated reminders and extension options
- **SC-012**: Customer satisfaction score for onboarding process reaches 85% or higher based on post-onboarding surveys
- **SC-013**: 95% of qualified customers successfully select an asset and complete deposit payment
- **SC-014**: Agent productivity (handovers per day) increases by 40% compared to manual verification processes
- **SC-015**: KYC data validation errors are caught and corrected before backend submission in 98% of cases
