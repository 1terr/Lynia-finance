@LoanReAmortizationFeature
Feature: LoanReAmortization

  @TestRailId:C3069 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - re-amortization happy path
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "25 January 2024"
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  |                 | 250.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
      | 3  | 15   | 31 January 2024  |                 | 125.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 125.0 | 0.0        | 0.0  | 375.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 25 January 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  |                 | 188.0           | 187.0         | 0.0      | 0.0  | 0.0       | 187.0 | 0.0   | 0.0        | 0.0  | 187.0       |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 188.0         | 0.0      | 0.0  | 0.0       | 188.0 | 0.0   | 0.0        | 0.0  | 188.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 125.0 | 0.0        | 0.0  | 375.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 25 January 2024  | Re-amortize      | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 0.0          |

  @TestRailId:C3070 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - re-amortization happy path with loan externalId
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "25 January 2024"
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  |                 | 250.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
      | 3  | 15   | 31 January 2024  |                 | 125.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 125.0 | 0.0        | 0.0  | 375.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
    When When Admin creates a Loan re-amortization transaction on current business date by loan external ID
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 25 January 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  |                 | 188.0           | 187.0         | 0.0      | 0.0  | 0.0       | 187.0 | 0.0   | 0.0        | 0.0  | 187.0       |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 188.0         | 0.0      | 0.0  | 0.0       | 188.0 | 0.0   | 0.0        | 0.0  | 188.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 125.0 | 0.0        | 0.0  | 375.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 25 January 2024  | Re-amortize      | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 0.0          |

  @TestRailId:C3071 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - re-amortization undo happy path
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "25 January 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 25 January 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  |                 | 188.0           | 187.0         | 0.0      | 0.0  | 0.0       | 187.0 | 0.0   | 0.0        | 0.0  | 187.0       |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 188.0         | 0.0      | 0.0  | 0.0       | 188.0 | 0.0   | 0.0        | 0.0  | 188.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 125.0 | 0.0        | 0.0  | 375.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        | false    |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        | false    |
      | 25 January 2024  | Re-amortize      | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    |
    When Admin sets the business date to "26 January 2024"
    When When Admin undo Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  |                 | 250.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
      | 3  | 15   | 31 January 2024  |                 | 125.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 125.0 | 0.0        | 0.0  | 375.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        | false    |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        | false    |
      | 25 January 2024  | Re-amortize      | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 0.0          | true     |
    Then Admin checks that delinquency range is: "RANGE_3" and has delinquentDate "2024-01-19"

  @TestRailId:C3072 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - delinquency calculation triggered upon re-amortization transaction
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "24 January 2024"
    When Admin runs inline COB job for Loan
    Then Admin checks that delinquency range is: "RANGE_3" and has delinquentDate "2024-01-19"
    When Admin sets the business date to "25 January 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Admin checks that delinquency range is: "NO_DELINQUENCY" and has delinquentDate ""

  @TestRailId:C3073 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - UC1: re-amortization after charge applied on loan
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "16 January 2024"
    When Admin adds "LOAN_NSF_FEE" due date charge with "16 January 2024" due date and 10 EUR transaction amount
    When Admin sets the business date to "25 January 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  |                 | 375.0           | 0.0           | 0.0      | 0.0  | 10.0      | 10.0  | 0.0   | 0.0        | 0.0  | 10.0        |
      | 3  | 15   | 31 January 2024  |                 | 188.0           | 187.0         | 0.0      | 0.0  | 0.0       | 187.0 | 0.0   | 0.0        | 0.0  | 187.0       |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 188.0         | 0.0      | 0.0  | 0.0       | 188.0 | 0.0   | 0.0        | 0.0  | 188.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 10.0      | 510.0 | 125.0 | 0.0        | 0.0  | 385.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 25 January 2024  | Re-amortize      | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 0.0          |

  @TestRailId:C3074 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - UC2: complete past due principal amount reamortization scenario
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "01 February 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 01 February 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 01 February 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 |                  | 0.0             | 375.0         | 0.0      | 0.0  | 0.0       | 375.0 | 0.0   | 0.0        | 0.0  | 375.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 125.0 | 0.0        | 0.0  | 375.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 01 February 2024 | Re-amortize      | 250.0  | 250.0     | 0.0      | 0.0  | 0.0       | 0.0          |

  @TestRailId:C3075 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - UC3: reverse replay scenario
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "01 February 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 01 February 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 01 February 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 |                  | 0.0             | 375.0         | 0.0      | 0.0  | 0.0       | 375.0 | 0.0   | 0.0        | 0.0  | 375.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 125.0 | 0.0        | 0.0  | 375.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 01 February 2024 | Re-amortize      | 250.0  | 250.0     | 0.0      | 0.0  | 0.0       | 0.0          |
    When Admin sets the business date to "02 February 2024"
    And Customer makes "AUTOPAY" repayment on "15 January 2024" with 125 EUR transaction amount
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 15 January 2024  | 250.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 125.0      | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 01 February 2024 | 250.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 |                  | 0.0             | 250.0         | 0.0      | 0.0  | 0.0       | 250.0 | 0.0   | 0.0        | 0.0  | 250.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 250.0 | 125.0      | 0.0  | 250.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 15 January 2024  | Repayment        | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 250.0        |
      | 01 February 2024 | Re-amortize      | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 0.0          |

  @TestRailId:C3076 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - UC4: N+1 Installment scenario
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "01 February 2024"
    When Admin adds "LOAN_NSF_FEE" due date charge with "27 February 2024" due date and 10 EUR transaction amount
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 5 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 01 February 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 01 February 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 |                  | 0.0             | 375.0         | 0.0      | 0.0  | 0.0       | 375.0 | 0.0   | 0.0        | 0.0  | 375.0       |
      | 5  | 12   | 27 February 2024 |                  | 0.0             | 0.0           | 0.0      | 0.0  | 10.0      | 10.0  | 0.0   | 0.0        | 0.0  | 10.0        |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 10.0      | 510.0 | 125.0 | 0.0        | 0.0  | 385.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 01 February 2024 | Re-amortize      | 250.0  | 250.0     | 0.0      | 0.0  | 0.0       | 0.0          |

  @TestRailId:C3077 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - UC5: re-amortization on same day of installment
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "16 January 2024"
    When Admin adds "LOAN_NSF_FEE" due date charge with "16 January 2024" due date and 10 EUR transaction amount
    When Admin sets the business date to "31 January 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  |                 | 375.0           | 0.0           | 0.0      | 0.0  | 10.0      | 10.0  | 0.0   | 0.0        | 0.0  | 10.0        |
      | 3  | 15   | 31 January 2024  | 31 January 2024 | 375.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 375.0         | 0.0      | 0.0  | 0.0       | 375.0 | 0.0   | 0.0        | 0.0  | 375.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 10.0      | 510.0 | 125.0 | 0.0        | 0.0  | 385.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 31 January 2024  | Re-amortize      | 250.0  | 250.0     | 0.0      | 0.0  | 0.0       | 0.0          |

  @TestRailId:C3078 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - UC6: Parital Paid Scenario
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "17 January 2024"
    And Customer makes "AUTOPAY" repayment on "17 January 2024" with 50 EUR transaction amount
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  |                 | 250.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 50.0  | 0.0        | 50.0 | 75.0        |
      | 3  | 15   | 31 January 2024  |                 | 125.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 0.0   | 0.0        | 0.0  | 125.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 175.0 | 0.0        | 50.0 | 325.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 17 January 2024  | Repayment        | 50.0   | 50.0      | 0.0      | 0.0  | 0.0       | 325.0        |
    When Admin sets the business date to "30 January 2024"
    When When Admin creates a Loan re-amortization transaction on current business date by loan external ID
    Then Loan Repayment schedule has 4 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 500.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 375.0           | 125.0         | 0.0      | 0.0  | 0.0       | 125.0 | 125.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 30 January 2024 | 325.0           | 50.0          | 0.0      | 0.0  | 0.0       | 50.0  | 50.0  | 0.0        | 50.0 | 0.0         |
      | 3  | 15   | 31 January 2024  |                 | 162.0           | 163.0         | 0.0      | 0.0  | 0.0       | 163.0 | 0.0   | 0.0        | 0.0  | 163.0       |
      | 4  | 15   | 15 February 2024 |                 | 0.0             | 162.0         | 0.0      | 0.0  | 0.0       | 162.0 | 0.0   | 0.0        | 0.0  | 162.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 500.0         | 0.0      | 0.0  | 0.0       | 500.0 | 175.0 | 0.0        | 50.0 | 325.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance |
      | 01 January 2024  | Disbursement     | 500.0  | 0.0       | 0.0      | 0.0  | 0.0       | 500.0        |
      | 01 January 2024  | Down Payment     | 125.0  | 125.0     | 0.0      | 0.0  | 0.0       | 375.0        |
      | 17 January 2024  | Repayment        | 50.0   | 50.0      | 0.0      | 0.0  | 0.0       | 325.0        |
      | 30 January 2024  | Re-amortize      | 75.0   | 75.0      | 0.0      | 0.0  | 0.0       | 0.0          |

  @TestRailId:C3089 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction - Event check
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 500            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 45                | DAYS                  | 15             | DAYS                   | 3                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "500" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "500" EUR transaction amount
    When Admin sets the business date to "31 January 2024"
    When Admin runs inline COB job for Loan
    Then LoanDelinquencyRangeChangeBusinessEvent is created
    When Admin sets the business date to "01 February 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then LoanDelinquencyRangeChangeBusinessEvent is created
    Then LoanReAmortizeBusinessEvent is created

  @TestRailId:C3112 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction reverse-replay - UC1: undo old repayment
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 800            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 75                | DAYS                  | 15             | DAYS                   | 5                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "800" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "800" EUR transaction amount
    When Admin sets the business date to "16 January 2024"
    And Customer makes "AUTOPAY" repayment on "16 January 2024" with 120 EUR transaction amount
#    --- Re-amortization transaction ---
    When Admin sets the business date to "20 February 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 6 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 16 January 2024  | 480.0           | 120.0         | 0.0      | 0.0  | 0.0       | 120.0 | 120.0 | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 480.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 480.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 5  | 15   | 01 March 2024    |                  | 240.0           | 240.0         | 0.0      | 0.0  | 0.0       | 240.0 | 0.0   | 0.0        | 0.0  | 240.0       |
      | 6  | 15   | 16 March 2024    |                  | 0.0             | 240.0         | 0.0      | 0.0  | 0.0       | 240.0 | 0.0   | 0.0        | 0.0  | 240.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 800.0         | 0.0      | 0.0  | 0.0       | 800.0 | 320.0 | 0.0        | 0.0  | 480.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 16 January 2024  | Repayment        | 120.0  | 120.0     | 0.0      | 0.0  | 0.0       | 480.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 240.0  | 240.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | false    |
#   --- Undo repayment ---
    When Admin sets the business date to "25 February 2024"
    When Customer undo "1"th "Repayment" transaction made on "16 January 2024"
    Then Loan Repayment schedule has 6 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 5  | 15   | 01 March 2024    |                  | 300.0           | 300.0         | 0.0      | 0.0  | 0.0       | 300.0 | 0.0   | 0.0        | 0.0  | 300.0       |
      | 6  | 15   | 16 March 2024    |                  | 0.0             | 300.0         | 0.0      | 0.0  | 0.0       | 300.0 | 0.0   | 0.0        | 0.0  | 300.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 800.0         | 0.0      | 0.0  | 0.0       | 800.0 | 200.0 | 0.0        | 0.0  | 600.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 16 January 2024  | Repayment        | 120.0  | 120.0     | 0.0      | 0.0  | 0.0       | 480.0        | true     | false    |
      | 20 February 2024 | Re-amortize      | 360.0  | 360.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | true     |

  @TestRailId:C3113 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction reverse-replay - UC2: backdated repayment
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 800            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 75                | DAYS                  | 15             | DAYS                   | 5                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "800" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "800" EUR transaction amount
#    --- Re-amortization transaction ---
    When Admin sets the business date to "20 February 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 6 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 5  | 15   | 01 March 2024    |                  | 300.0           | 300.0         | 0.0      | 0.0  | 0.0       | 300.0 | 0.0   | 0.0        | 0.0  | 300.0       |
      | 6  | 15   | 16 March 2024    |                  | 0.0             | 300.0         | 0.0      | 0.0  | 0.0       | 300.0 | 0.0   | 0.0        | 0.0  | 300.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 800.0         | 0.0      | 0.0  | 0.0       | 800.0 | 200.0 | 0.0        | 0.0  | 600.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 360.0  | 360.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | false    |
#    --- Backdated repayment ---
    When Admin sets the business date to "25 February 2024"
    And Customer makes "AUTOPAY" repayment on "16 January 2024" with 120 EUR transaction amount
    Then Loan Repayment schedule has 6 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 16 January 2024  | 480.0           | 120.0         | 0.0      | 0.0  | 0.0       | 120.0 | 120.0 | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 480.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 480.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 5  | 15   | 01 March 2024    |                  | 240.0           | 240.0         | 0.0      | 0.0  | 0.0       | 240.0 | 0.0   | 0.0        | 0.0  | 240.0       |
      | 6  | 15   | 16 March 2024    |                  | 0.0             | 240.0         | 0.0      | 0.0  | 0.0       | 240.0 | 0.0   | 0.0        | 0.0  | 240.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 800.0         | 0.0      | 0.0  | 0.0       | 800.0 | 320.0 | 0.0        | 0.0  | 480.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 16 January 2024  | Repayment        | 120.0  | 120.0     | 0.0      | 0.0  | 0.0       | 480.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 240.0  | 240.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | true     |

  @TestRailId:C3114 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction reverse-replay - UC3: backdated disbursement
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 800            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 75                | DAYS                  | 15             | DAYS                   | 5                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "800" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "800" EUR transaction amount
#    --- Re-amortization transaction ---
    When Admin sets the business date to "20 February 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 6 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 5  | 15   | 01 March 2024    |                  | 300.0           | 300.0         | 0.0      | 0.0  | 0.0       | 300.0 | 0.0   | 0.0        | 0.0  | 300.0       |
      | 6  | 15   | 16 March 2024    |                  | 0.0             | 300.0         | 0.0      | 0.0  | 0.0       | 300.0 | 0.0   | 0.0        | 0.0  | 300.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 800.0         | 0.0      | 0.0  | 0.0       | 800.0 | 200.0 | 0.0        | 0.0  | 600.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 360.0  | 360.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | false    |
#    --- Backdated disbursement ---
    When Admin sets the business date to "25 February 2024"
    When Admin successfully disburse the loan on "16 January 2024" with "100" EUR transaction amount
    Then Loan Repayment schedule has 7 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 20 February 2024 | 575.0           | 25.0          | 0.0      | 0.0  | 0.0       | 25.0  | 25.0  | 0.0        | 0.0  | 0.0         |
      |    |      | 16 January 2024  |                  | 100.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 3  | 0    | 16 January 2024  | 20 February 2024 | 675.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 31 January 2024  | 20 February 2024 | 675.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 5  | 15   | 15 February 2024 | 20 February 2024 | 675.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 6  | 15   | 01 March 2024    |                  | 337.0           | 338.0         | 0.0      | 0.0  | 0.0       | 338.0 | 0.0   | 0.0        | 0.0  | 338.0       |
      | 7  | 15   | 16 March 2024    |                  | 0.0             | 337.0         | 0.0      | 0.0  | 0.0       | 337.0 | 0.0   | 0.0        | 0.0  | 337.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 900.0         | 0.0      | 0.0  | 0.0       | 900.0 | 225.0 | 0.0        | 0.0  | 675.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 16 January 2024  | Disbursement     | 100.0  | 0.0       | 0.0      | 0.0  | 0.0       | 700.0        | false    | false    |
      | 16 January 2024  | Down Payment     | 25.0   | 25.0      | 0.0      | 0.0  | 0.0       | 675.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 398.0  | 398.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | true     |

  @TestRailId:C3115 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction reverse-replay - UC4: backdated charge
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 800            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 75                | DAYS                  | 15             | DAYS                   | 5                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "800" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "800" EUR transaction amount
    When Admin sets the business date to "16 January 2024"
    And Customer makes "AUTOPAY" repayment on "16 January 2024" with 140 EUR transaction amount
#    --- Re-amortization transaction ---
    When Admin sets the business date to "20 February 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 6 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 16 January 2024  | 480.0           | 120.0         | 0.0      | 0.0  | 0.0       | 120.0 | 120.0 | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 460.0           | 20.0          | 0.0      | 0.0  | 0.0       | 20.0  | 20.0  | 20.0       | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 460.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 5  | 15   | 01 March 2024    |                  | 230.0           | 230.0         | 0.0      | 0.0  | 0.0       | 230.0 | 0.0   | 0.0        | 0.0  | 230.0       |
      | 6  | 15   | 16 March 2024    |                  | 0.0             | 230.0         | 0.0      | 0.0  | 0.0       | 230.0 | 0.0   | 0.0        | 0.0  | 230.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 800.0         | 0.0      | 0.0  | 0.0       | 800.0 | 340.0 | 20.0       | 0.0  | 460.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 16 January 2024  | Repayment        | 140.0  | 140.0     | 0.0      | 0.0  | 0.0       | 460.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 220.0  | 220.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | false    |
#    --- Backdated charge ---
    When Admin sets the business date to "25 February 2024"
    When Admin adds "LOAN_NSF_FEE" due date charge with "15 January 2024" due date and 20 EUR transaction amount
    Then Loan Repayment schedule has 6 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 16 January 2024  | 480.0           | 120.0         | 0.0      | 0.0  | 20.0      | 140.0 | 140.0 | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 480.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 480.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 5  | 15   | 01 March 2024    |                  | 240.0           | 240.0         | 0.0      | 0.0  | 0.0       | 240.0 | 0.0   | 0.0        | 0.0  | 240.0       |
      | 6  | 15   | 16 March 2024    |                  | 0.0             | 240.0         | 0.0      | 0.0  | 0.0       | 240.0 | 0.0   | 0.0        | 0.0  | 240.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 800.0         | 0.0      | 0.0  | 20.0      | 820.0 | 340.0 | 0.0        | 0.0  | 480.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 16 January 2024  | Repayment        | 140.0  | 120.0     | 0.0      | 0.0  | 20.0      | 480.0        | false    | true     |
      | 20 February 2024 | Re-amortize      | 240.0  | 240.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | true     |

  @TestRailId:C3134 @AdvancedPaymentAllocation
  Scenario: Verify Loan re-amortization transaction reverse-replay - UC5: re-amortization validation should not consider reverted transactions
    When Admin sets the business date to "01 January 2024"
    When Admin creates a client with random data
    When Admin set "LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION" loan product "DEFAULT" transaction type to "NEXT_INSTALLMENT" future installment allocation rule
    When Admin creates a fully customized loan with the following data:
      | LoanProduct                                       | submitted on date | with Principal | ANNUAL interest rate % | interest type | interest calculation period | amortization type  | loanTermFrequency | loanTermFrequencyType | repaymentEvery | repaymentFrequencyType | numberOfRepayments | graceOnPrincipalPayment | graceOnInterestPayment | interest free period | Payment strategy            |
      | LP2_DOWNPAYMENT_AUTO_ADVANCED_PAYMENT_ALLOCATION | 01 January 2024   | 800            | 0                      | FLAT          | SAME_AS_REPAYMENT_PERIOD    | EQUAL_INSTALLMENTS | 75                | DAYS                  | 15             | DAYS                   | 5                  | 0                       | 0                      | 0                    | ADVANCED_PAYMENT_ALLOCATION |
    And Admin successfully approves the loan on "01 January 2024" with "800" amount and expected disbursement date on "01 January 2024"
    When Admin successfully disburse the loan on "01 January 2024" with "800" EUR transaction amount
#    --- Re-amortization transaction after 1st installment date ---
    When Admin sets the business date to "20 February 2024"
    When When Admin creates a Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 6 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 5  | 15   | 01 March 2024    |                  | 300.0           | 300.0         | 0.0      | 0.0  | 0.0       | 300.0 | 0.0   | 0.0        | 0.0  | 300.0       |
      | 6  | 15   | 16 March 2024    |                  | 0.0             | 300.0         | 0.0      | 0.0  | 0.0       | 300.0 | 0.0   | 0.0        | 0.0  | 300.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 800.0         | 0.0      | 0.0  | 0.0       | 800.0 | 200.0 | 0.0        | 0.0  | 600.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 360.0  | 360.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | false    |
#    --- Secnd disbursement with autopayment ---
    When Admin sets the business date to "21 February 2024"
    When Admin successfully disburse the loan on "21 February 2024" with "100" EUR transaction amount
    Then Loan Repayment schedule has 7 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      |    |      | 21 February 2024 |                  | 100.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 5  | 0    | 21 February 2024 | 21 February 2024 | 675.0           | 25.0          | 0.0      | 0.0  | 0.0       | 25.0  | 25.0  | 0.0        | 0.0  | 0.0         |
      | 6  | 15   | 01 March 2024    |                  | 337.0           | 338.0         | 0.0      | 0.0  | 0.0       | 338.0 | 0.0   | 0.0        | 0.0  | 338.0       |
      | 7  | 15   | 16 March 2024    |                  | 0.0             | 337.0         | 0.0      | 0.0  | 0.0       | 337.0 | 0.0   | 0.0        | 0.0  | 337.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 900.0         | 0.0      | 0.0  | 0.0       | 900.0 | 225.0 | 0.0        | 0.0  | 675.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 360.0  | 360.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | false    |
      | 21 February 2024 | Disbursement     | 100.0  | 0.0       | 0.0      | 0.0  | 0.0       | 700.0        | false    | false    |
      | 21 February 2024 | Down Payment     | 25.0   | 25.0      | 0.0      | 0.0  | 0.0       | 675.0        | false    | false    |
#    --- Undo autopayment of second disbursement ---
    When Admin sets the business date to "22 February 2024"
    When Customer undo "1"th "Down Payment" transaction made on "21 February 2024"
    Then Loan Repayment schedule has 7 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date        | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                  | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024  | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 3  | 15   | 31 January 2024  | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      | 4  | 15   | 15 February 2024 | 20 February 2024 | 600.0           | 0.0           | 0.0      | 0.0  | 0.0       | 0.0   | 0.0   | 0.0        | 0.0  | 0.0         |
      |    |      | 21 February 2024 |                  | 100.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 5  | 0    | 21 February 2024 |                  | 675.0           | 25.0          | 0.0      | 0.0  | 0.0       | 25.0  | 0.0   | 0.0        | 0.0  | 25.0        |
      | 6  | 15   | 01 March 2024    |                  | 337.0           | 338.0         | 0.0      | 0.0  | 0.0       | 338.0 | 0.0   | 0.0        | 0.0  | 338.0       |
      | 7  | 15   | 16 March 2024    |                  | 0.0             | 337.0         | 0.0      | 0.0  | 0.0       | 337.0 | 0.0   | 0.0        | 0.0  | 337.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 900.0         | 0.0      | 0.0  | 0.0       | 900.0 | 200.0 | 0.0        | 0.0  | 700.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 360.0  | 360.0     | 0.0      | 0.0  | 0.0       | 0.0          | false    | false    |
      | 21 February 2024 | Disbursement     | 100.0  | 0.0       | 0.0      | 0.0  | 0.0       | 700.0        | false    | false    |
      | 21 February 2024 | Down Payment     | 25.0   | 25.0      | 0.0      | 0.0  | 0.0       | 675.0        | true     | false    |
#    --- Undo re-amortization ---
    When Admin sets the business date to "23 February 2024"
    When When Admin undo Loan re-amortization transaction on current business date
    Then Loan Repayment schedule has 7 periods, with the following data for periods:
      | Nr | Days | Date             | Paid date       | Balance of loan | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      |    |      | 01 January 2024  |                 | 800.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 1  | 0    | 01 January 2024  | 01 January 2024 | 600.0           | 200.0         | 0.0      | 0.0  | 0.0       | 200.0 | 200.0 | 0.0        | 0.0  | 0.0         |
      | 2  | 15   | 16 January 2024  |                 | 480.0           | 120.0         | 0.0      | 0.0  | 0.0       | 120.0 | 0.0   | 0.0        | 0.0  | 120.0       |
      | 3  | 15   | 31 January 2024  |                 | 360.0           | 120.0         | 0.0      | 0.0  | 0.0       | 120.0 | 0.0   | 0.0        | 0.0  | 120.0       |
      | 4  | 15   | 15 February 2024 |                 | 240.0           | 120.0         | 0.0      | 0.0  | 0.0       | 120.0 | 0.0   | 0.0        | 0.0  | 120.0       |
      |    |      | 21 February 2024 |                 | 100.0           |               |          | 0.0  |           | 0.0   | 0.0   |            |      |             |
      | 5  | 0    | 21 February 2024 |                 | 315.0           | 25.0          | 0.0      | 0.0  | 0.0       | 25.0  | 0.0   | 0.0        | 0.0  | 25.0        |
      | 6  | 15   | 01 March 2024    |                 | 157.0           | 158.0         | 0.0      | 0.0  | 0.0       | 158.0 | 0.0   | 0.0        | 0.0  | 158.0       |
      | 7  | 15   | 16 March 2024    |                 | 0.0             | 157.0         | 0.0      | 0.0  | 0.0       | 157.0 | 0.0   | 0.0        | 0.0  | 157.0       |
    Then Loan Repayment schedule has the following data in Total row:
      | Principal due | Interest | Fees | Penalties | Due   | Paid  | In advance | Late | Outstanding |
      | 900.0         | 0.0      | 0.0  | 0.0       | 900.0 | 200.0 | 0.0        | 0.0  | 700.0       |
    Then Loan Transactions tab has the following data:
      | Transaction date | Transaction Type | Amount | Principal | Interest | Fees | Penalties | Loan Balance | Reverted | Replayed |
      | 01 January 2024  | Disbursement     | 800.0  | 0.0       | 0.0      | 0.0  | 0.0       | 800.0        | false    | false    |
      | 01 January 2024  | Down Payment     | 200.0  | 200.0     | 0.0      | 0.0  | 0.0       | 600.0        | false    | false    |
      | 20 February 2024 | Re-amortize      | 360.0  | 360.0     | 0.0      | 0.0  | 0.0       | 0.0          | true     | false    |
      | 21 February 2024 | Disbursement     | 100.0  | 0.0       | 0.0      | 0.0  | 0.0       | 700.0        | false    | false    |
      | 21 February 2024 | Down Payment     | 25.0   | 25.0      | 0.0      | 0.0  | 0.0       | 675.0        | true     | false    |

