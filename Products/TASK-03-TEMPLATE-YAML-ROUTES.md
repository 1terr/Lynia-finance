# Task 3: Template.yaml API Gateway Routes (Phase 3)

## Overview

Add ~16 new API Gateway event sources to the existing `AdminFunction` resource block in `template.yaml` to expose the product, device model, and organization CRUD endpoints.

## Dependencies

- **Task 2** (Backend Product CRUD API) must be completed first

## Key Files

| File | Action |
|------|--------|
| `template.yaml` | **Modify** - Add ~16 API Gateway event sources to AdminFunction (~line 996) |

## What to Implement

### 3.1 Product Routes

Add these event sources to the `AdminFunction` `Events` block:

```yaml
GetProducts:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/products
    Method: GET

GetProductById:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/products/{id}
    Method: GET

CreateProduct:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/products
    Method: POST

UpdateProduct:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/products/{id}
    Method: PATCH

DeleteProduct:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/products/{id}
    Method: DELETE
```

### 3.2 Device Model Routes

```yaml
GetDeviceModels:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/device-models
    Method: GET

GetDeviceModelById:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/device-models/{id}
    Method: GET

CreateDeviceModel:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/device-models
    Method: POST

UpdateDeviceModel:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/device-models/{id}
    Method: PATCH

DeleteDeviceModel:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/device-models/{id}
    Method: DELETE
```

### 3.3 Organization Routes

```yaml
GetOrganizations:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/organizations
    Method: GET

GetOrganizationById:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/organizations/{id}
    Method: GET

CreateOrganization:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/organizations
    Method: POST

UpdateOrganization:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/organizations/{id}
    Method: PATCH

ImportOrgMembers:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/organizations/{id}/import
    Method: POST

GetOrgMembers:
  Type: Api
  Properties:
    RestApiId: !Ref LyniaApi
    Path: /admin/organizations/{id}/members
    Method: GET
```

### 3.4 Important Notes

- Follow the naming pattern established by existing events in the AdminFunction
- All routes go through the existing Cognito authorizer on `LyniaApi`
- No new Lambda functions are needed (Decision 5: extend AdminFunction)
- Run `cfn-lint` with appropriate ignore flags after changes

---

## Tests

### Test 1: SAM Validate

```bash
sam validate
```

**Expected:** Template passes validation (or known cfn-lint warnings only: E3004, W8001).

### Test 2: SAM Build

```bash
sam build --cached --parallel
```

**Expected:** Build succeeds without errors. AdminFunction builds with updated routes.

### Test 3: SAM Local API Start

```bash
sam local start-api --port 3000
```

**Expected:** API starts successfully. All new routes are listed in the startup output.

### Test 4: Route Registration Verification

```bash
# Verify all new routes are accessible (should return auth error, not 404)
curl -s -o /dev/null -w "%{http_code}" localhost:3000/admin/products
curl -s -o /dev/null -w "%{http_code}" localhost:3000/admin/device-models
curl -s -o /dev/null -w "%{http_code}" localhost:3000/admin/organizations
```

**Expected:** All return 401 (unauthorized, not 404). This confirms routes are registered.

### Test 5: cfn-lint Check

```bash
cfn-lint template.yaml -i E3004 W8001
```

**Expected:** No new errors or warnings introduced.

### Test 6: No Resource Name Conflicts

```bash
# Check that no new Lambda names conflict with existing stacks
aws lambda list-functions --query "Functions[?contains(FunctionName, 'admin')].[FunctionName]" --output text
```

**Expected:** No naming conflicts with existing deployed resources.

### Test 7: Cognito Authorizer Applied

Verify that the new routes inherit the Cognito authorizer from `LyniaApi`:

```bash
# Request without Authorization header should get 401
curl -s -o /dev/null -w "%{http_code}" localhost:3000/admin/products
```

**Expected:** Returns 401, confirming auth is required.

---

*Phase: 3 of 9*
*Depends on: Task 2 (Backend Product CRUD API)*
*Blocks: None directly (but required for staging/production deploys)*
