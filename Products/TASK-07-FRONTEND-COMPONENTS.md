# Task 7: Frontend Components (Phase 7)

## Overview

Create the reusable React components for the Products section: product cards, product create/edit forms, device model forms, organization forms, CSV member import modal, and stats overview cards.

## Dependencies

- **Task 6** (Frontend Navigation + Pages) must be completed first

## Key Files

| File | Action |
|------|--------|
| `frontend/admin-portal/src/components/products/product-card.tsx` | **Create** |
| `frontend/admin-portal/src/components/products/product-form.tsx` | **Create** |
| `frontend/admin-portal/src/components/products/device-model-form.tsx` | **Create** |
| `frontend/admin-portal/src/components/products/organization-form.tsx` | **Create** |
| `frontend/admin-portal/src/components/products/member-import-modal.tsx` | **Create** |
| `frontend/admin-portal/src/components/products/product-stats.tsx` | **Create** |

## What to Implement

### 7.1 Product Card (`product-card.tsx`)

Displays a loan product summary:
- Product code and name
- Status badge (Active = green, Inactive = gray, Launching Soon = blue)
- Amount range ($min - $max)
- Interest rate (monthly + annual)
- Deposit percentage (for smartphone products)
- Tenure range (min - max months)
- Requires Device / Requires Org Verification indicators
- Action buttons: Edit, View Details, Manage Device Models (smartphone only)

### 7.2 Product Form (`product-form.tsx`)

Create/edit product modal with category-dependent fields:

**Common fields (both categories):**
- Product Name, Product Code, Status
- Min/Max Amount (USD), Min/Max Tenure (months)
- Interest Rate/Month, Interest Rate/Year (auto-calculate one from the other)
- Max Active Loans, Description

**Smartphone-only fields:**
- Deposit Percentage, Minimum Deposit (USD)
- `requires_device` = true (auto-set)

**Digital-only fields:**
- Disbursement Methods checkboxes (EcoCash, OneMoney, InnBucks)
- `requires_organization_verification` toggle
- Deposit = 0 (auto-set)

**Validation:**
- `min_term_months` < `max_term_months`
- `min_amount_usd` < `max_amount_usd`
- Interest rates > 0
- Product code: `^[A-Z0-9_]{3,50}$`

### 7.3 Device Model Form (`device-model-form.tsx`)

Create/edit device model modal:
- Brand, Model Name, Model Code
- Storage (GB), RAM (GB), Screen Size (inches)
- Retail Price (USD), Wholesale Price (USD)
- Calculated margin display (retail - wholesale, percentage)
- Override fields: Min Deposit %, Max Tenure (with "use product default" hint)

### 7.4 Organization Form (`organization-form.tsx`)

Create/edit organization modal:
- Organization Code, Name, Type (dropdown: government, corporate, cooperative, ngo)
- Verification Method (dropdown: excel_upload, api)
- Trust Level (0-100 slider or input)
- Contact Person, Phone, Email
- API Endpoint (shown only when verification_method = 'api')

### 7.5 Member Import Modal (`member-import-modal.tsx`)

CSV import flow:
1. File input (CSV only)
2. Client-side CSV parsing (using Papa Parse or similar)
3. Preview table showing first 5 rows with masked data
4. Required columns indicator: national_id, phone_number, employee_number, employment_status, department, grade_level, monthly_salary_usd
5. Total row count
6. Import confirmation button
7. Result summary after import (inserted, skipped, errors)

### 7.6 Product Stats (`product-stats.tsx`)

Stats overview cards for the products page:
- Active Products count
- Total Loans under category
- Total Volume (USD)
- Average Interest Rate

---

## Tests

### Test 1: Product Card - Smartphone Product Display

```
Manual verification:
1. Navigate to /products
2. SMRT_FIN_001 card shows:
   - Status: Active (green badge)
   - Amount: $50 - $500
   - Interest: 5%/mo (60%/yr)
   - Deposit: 10%
   - Tenure: 3-12 months
   - "Requires Device: Yes" indicator
```

**Expected:** All product details display correctly with proper formatting.

### Test 2: Product Card - Digital Product Display

```
Manual verification:
1. Switch to "Digital Loans" tab
2. DIGI_LOAN_001 card shows:
   - Status: Active (green badge)
   - Amount: $20 - $500
   - Interest: 3%/mo (36%/yr)
   - Deposit: 0% (or not shown)
   - Tenure: 1-6 months
   - "Requires Org Verification: Yes" indicator
```

**Expected:** Digital product card displays without device-specific fields.

### Test 3: Product Form - Category-Dependent Fields

```
Manual verification:
1. Click "+ Create Product"
2. Select "Smartphone" category
3. Deposit fields visible, disbursement methods hidden
4. Switch to "Digital" category
5. Deposit fields hidden, disbursement methods checkboxes visible
```

**Expected:** Form fields dynamically change based on selected category.

### Test 4: Product Form - Interest Rate Auto-Calculation

```
Manual verification:
1. Open product form
2. Enter Monthly Rate: 5
3. Annual Rate auto-populates: 60
4. Clear and enter Annual Rate: 36
5. Monthly Rate auto-populates: 3
```

**Expected:** Monthly and annual rates auto-calculate from each other.

### Test 5: Product Form - Validation Errors

```
Manual verification:
1. Open product form
2. Set Min Amount to 500, Max Amount to 100
3. Submit
4. Error shown: "Min amount must be less than max amount"
5. Set Min Tenure to 12, Max Tenure to 3
6. Error shown: "Min tenure must be less than max tenure"
```

**Expected:** Form validation prevents invalid ranges with clear error messages.

### Test 6: Product Form - Successful Submission

```
Manual verification:
1. Fill out valid product form
2. Click "Save Product"
3. Modal closes
4. New product appears in product list
5. Success toast notification shown
```

**Expected:** Product creation succeeds and updates the list.

### Test 7: Device Model Form - Margin Calculation

```
Manual verification:
1. Open device model form
2. Enter Retail Price: $199
3. Enter Wholesale Price: $145
4. Margin displays: $54.00 (27.1%)
```

**Expected:** Margin auto-calculates as retail - wholesale with percentage.

### Test 8: Device Model Form - Override Fields

```
Manual verification:
1. Open device model form
2. "Min Deposit %" shows placeholder: "Product default: 10%"
3. "Max Tenure" shows placeholder: "Product default: 12 months"
4. Fields are optional (can be left blank)
```

**Expected:** Override fields show product defaults as hints and are optional.

### Test 9: Organization Form - Type Dropdown

```
Manual verification:
1. Open organization form
2. Type dropdown shows: Government, Corporate, Cooperative, NGO
3. Select "Government"
4. Trust Level defaults to 90 or shows recommendation
```

**Expected:** Organization type dropdown works with all 4 options.

### Test 10: Member Import - CSV Upload and Preview

```
Manual verification:
1. Navigate to organization detail page
2. Click "Import CSV"
3. Select a CSV file with test member data
4. Preview shows first 5 rows with masked phone numbers and national IDs
5. Total row count displayed
```

**Expected:** CSV is parsed client-side and previewed with masked sensitive data.

### Test 11: Member Import - Missing Required Columns

```
Manual verification:
1. Upload CSV missing "national_id" column
2. Error displayed: "Missing required column: national_id"
3. Import button disabled
```

**Expected:** Client-side validation catches missing required columns before upload.

### Test 12: Member Import - Successful Import

```
Manual verification:
1. Upload valid CSV with 5 member rows
2. Click "Import 5 rows"
3. Loading state shown
4. Result: "Inserted: 5, Skipped: 0, Errors: 0"
5. Members list refreshes
```

**Expected:** Import completes successfully with correct summary.

### Test 13: Product Stats - Correct Numbers

```
Manual verification:
1. Navigate to /products
2. Stats cards show correct counts:
   - Active Products count matches visible product cards
   - Total Loans count is reasonable
   - Volume is formatted with $ and commas
```

**Expected:** Stats cards display accurate, well-formatted data.

### Test 14: Money Formatting

```
Manual verification:
1. All monetary values display with:
   - Dollar sign ($)
   - Two decimal places
   - Thousand separators (e.g., $1,234.56)
```

**Expected:** Per CLAUDE.md fintech UI patterns, all money is formatted correctly.

### Test 15: Status Badge Colors

```
Manual verification:
1. Active products show green badge
2. Inactive products show gray badge
3. Launching Soon products show blue badge
```

**Expected:** Status badges use correct colors per CLAUDE.md fintech UI patterns.

### Test 16: Double-Confirm Destructive Actions

```
Manual verification:
1. Click "Delete" on a product
2. Confirmation dialog appears: "Are you sure you want to delete this product?"
3. Confirm deletion
4. Product is soft-deleted
```

**Expected:** Per CLAUDE.md, destructive actions require double confirmation.

### Test 17: Build Verification

```bash
cd frontend/admin-portal && pnpm build
```

**Expected:** Build succeeds. All new components compile without errors or warnings.

---

*Phase: 7 of 9*
*Depends on: Task 6 (Frontend Navigation + Pages)*
*Blocks: Task 9 (Integration Testing)*
