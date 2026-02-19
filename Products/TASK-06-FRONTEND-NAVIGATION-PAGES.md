# Task 6: Frontend Navigation + Pages (Phase 6)

## Overview

Add "Products" navigation item to the sidebar and create the page routes for the Products section: overview, product detail, device models, organizations list, and organization detail.

## Dependencies

- **Task 5** (Frontend Types + API Client) must be completed first

## Key Files

| File | Action |
|------|--------|
| `frontend/admin-portal/src/components/layout/sidebar.tsx` | **Modify** - Add Products nav item |
| `frontend/admin-portal/src/app/(dashboard)/products/page.tsx` | **Create** - Products overview (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/_client.tsx` | **Create** - Products overview (client) |
| `frontend/admin-portal/src/app/(dashboard)/products/[id]/page.tsx` | **Create** - Product detail (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/[id]/_client.tsx` | **Create** - Product detail (client) |
| `frontend/admin-portal/src/app/(dashboard)/products/device-models/page.tsx` | **Create** - Device catalog (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/device-models/_client.tsx` | **Create** - Device catalog (client) |
| `frontend/admin-portal/src/app/(dashboard)/products/organizations/page.tsx` | **Create** - Org list (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/organizations/_client.tsx` | **Create** - Org list (client) |
| `frontend/admin-portal/src/app/(dashboard)/products/organizations/[id]/page.tsx` | **Create** - Org detail (server) |
| `frontend/admin-portal/src/app/(dashboard)/products/organizations/[id]/_client.tsx` | **Create** - Org detail (client) |

## What to Implement

### 6.1 Sidebar Navigation

Add "Products" to the sidebar between "Loans" and "Devices":

```
Dashboard
Customers
KYC Review
Loans
Products    <-- NEW (Package icon)
Devices
Payments
Reports
Analytics
Settings
```

### 6.2 Products Overview Page (`/products`)

- Tabbed interface: "Smartphone Loans" | "Digital Loans"
- Stats cards: Active Products, Total Loans, Volume
- Product cards for each product with status, rates, and action buttons
- "Create Product" button in header

### 6.3 Product Detail Page (`/products/[id]`)

- Full product configuration view
- Edit form (reuses product-form component from Task 7)
- Associated loans list (summary only)

### 6.4 Device Models Page (`/products/device-models`)

- DataTable with columns: Brand, Model, Storage, Retail Price, Wholesale Price, Stock, Status
- Brand filter dropdown
- Search bar
- "Add Device Model" button
- Pagination

### 6.5 Organizations Page (`/products/organizations`)

- DataTable with columns: Name, Type, Trust Level, Members, Last Import
- "Add Organization" button
- Click row to navigate to detail page

### 6.6 Organization Detail Page (`/products/organizations/[id]`)

- Organization info header (name, type, trust level, verification method)
- "Edit" and "Import CSV" action buttons
- Members DataTable with columns: Emp #, Phone (masked), Department, Grade, Status
- Pagination for members list

---

## Tests

### Test 1: Sidebar Navigation Visible

```
Manual verification:
1. Open admin portal at localhost:3000
2. Check sidebar has "Products" item between "Loans" and "Devices"
3. Products item has a Package icon
```

**Expected:** "Products" nav item is visible in the correct position with icon.

### Test 2: Sidebar Navigation Click

```
Manual verification:
1. Click "Products" in sidebar
2. URL changes to /products
3. Products overview page loads
```

**Expected:** Navigation works. URL updates. Page renders without errors.

### Test 3: Products Overview - Tab Switching

```
Manual verification:
1. Navigate to /products
2. "Smartphone Loans" tab is active by default
3. Click "Digital Loans" tab
4. Content switches to show digital loan products
```

**Expected:** Tab switching works. Correct products shown for each tab.

### Test 4: Products Overview - Stats Cards

```
Manual verification:
1. Navigate to /products
2. Stats cards show Active Products count, Total Loans, Volume
3. Numbers are formatted correctly ($ with commas)
```

**Expected:** Stats cards display with correct formatting.

### Test 5: Create Product Button

```
Manual verification:
1. Navigate to /products
2. Click "+ Create Product" button
3. Product creation modal/form opens
```

**Expected:** Create button is visible and opens the product form.

### Test 6: Device Models Page Load

```
Manual verification:
1. Navigate to /products/device-models
2. DataTable loads with device model data
3. Brand filter dropdown works
4. Search filters models by name
```

**Expected:** Device models page renders with functional filters and search.

### Test 7: Organizations Page Load

```
Manual verification:
1. Navigate to /products/organizations
2. DataTable loads with organization data
3. Click row navigates to /products/organizations/{id}
```

**Expected:** Organizations page renders with clickable rows.

### Test 8: Organization Detail - Members List

```
Manual verification:
1. Navigate to /products/organizations/{id}
2. Organization header shows name, type, trust level
3. Members DataTable loads with masked phone numbers
4. Pagination works for member list
```

**Expected:** Organization detail page shows info and paginated members with masked phone numbers.

### Test 9: Responsive Design - Tablet

```
Manual verification:
1. Resize browser to tablet width (768px)
2. All product pages render correctly
3. DataTables are scrollable horizontally
4. No content overflow
```

**Expected:** All pages are responsive and usable on tablet-sized screens.

### Test 10: Page Loading States

```
Manual verification:
1. Navigate to /products
2. Skeleton loaders appear while data loads
3. Content replaces skeletons when loaded
```

**Expected:** Loading skeletons are shown (not blank pages) while data fetches.

### Test 11: Build Verification

```bash
cd frontend/admin-portal && pnpm build
```

**Expected:** Build succeeds. All new pages compile without errors.

### Test 12: Route 404 Handling

```
Manual verification:
1. Navigate to /products/nonexistent-id
2. Page shows appropriate "Product not found" message or 404
```

**Expected:** Invalid product IDs show a proper error message, not a crash.

---

*Phase: 6 of 9*
*Depends on: Task 5 (Frontend Types + API Client)*
*Blocks: Task 7 (Frontend Components)*
