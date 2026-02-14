# T014-T015: Loan Products Management Page

**Status**: COMPLETE
**Type**: Feature / UI Component
**Tests**: `src/__tests__/fineract/fineract-loan-products.test.tsx` (6 tests)
**Component**: `src/components/fineract/loan-products-page.tsx`
**Route**: `/fineract/products`

## Objective

Build a page that displays Fineract loan product configurations for the
three device financing tiers, showing rates, terms, credit score ranges,
and accounting rules.

## Features

### Product Cards (3-column grid)

Each loan product rendered as a card with tier-specific color scheme:

| Tier | Color | Border | Background |
|------|-------|--------|------------|
| Tier 1 (Entry) | Blue | `border-blue-200` | `bg-blue-50` header |
| Tier 2 (Standard) | Green | `border-green-200` | `bg-green-50` header |
| Tier 3 (Premium) | Purple | `border-purple-200` | `bg-purple-50` header |

### Card Sections

**Header**
- Tier badge (colored label)
- Product name (stripped prefix)
- Description text

**Details (4 sections)**

| Section | Icon | Data Shown |
|---------|------|------------|
| Principal Range | CreditCard | Min - max + default |
| Interest Rate | TrendingUp | Monthly rate + annual + type |
| Credit Score | Shield | Min - max score range |
| Term + Down Payment | (grid) | Months + percentage |

**Footer**
- Accounting rule (e.g., "Accrual (periodic)")

### Product Data (3 tiers)

| Field | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| Principal | $50-$200 | $200-$500 | $500-$2,000 |
| Rate | 5%/mo (60% annual) | 4%/mo (48% annual) | 3%/mo (36% annual) |
| Credit Score | 350-499 | 500-649 | 650-850 |
| Term | 6-12 months | 6-12 months | 6-18 months |
| Down Payment | 30% | 20% | 10% |
| Accounting | Accrual (periodic) | Accrual (periodic) | Accrual (periodic) |

## Test Coverage (6 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders all three tiers | "Tier 1", "Tier 2", "Tier 3" visible |
| 2 | Shows interest rates | "5%", "4%", "3%" visible |
| 3 | Shows credit score ranges | "350-499", "500-649", "650-850" |
| 4 | Shows principal ranges | "$50-$200", "$200-$500", "$500-$2,000" |
| 5 | Shows down payment | "30%", "20%", "10%" |
| 6 | Shows accounting rule | 3 "Accrual" labels |

## Design Decisions

1. **Card layout** (not table): Products are few (3) and rich in detail,
   so cards provide better visual hierarchy than a table.
2. **Color coding by tier**: Consistent with the approval/overdue pages
   where tier affects risk treatment.
3. **Read-only view**: Product configuration changes should happen in
   Fineract admin UI directly; this page is for visibility only.
