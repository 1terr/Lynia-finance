# Fineract CI Test Failures: Root Cause Analysis & Fix Strategy

> **Date:** 2026-02-09
> **Status:** Investigation Complete - Fixes Required
> **Severity:** CRITICAL - Tests are either failing silently or not running at all

---

## Executive Summary

The Fineract test infrastructure in GitHub Actions is **fundamentally broken** due to a
project restructuring that moved Apache Fineract into a `fineract/` subdirectory. The
CI workflows were not fully updated to account for this structural change. As a result:

- **Tests appear to pass in ~2 minutes** when they should take 30-60+ minutes
- **Zero actual test classes are being executed** in most workflows
- **The project cannot be built from `fineract/`** due to Gradle module path mismatches

---

## Root Cause

The repository uses a monorepo layout where the root `build.gradle` and `settings.gradle`
delegate to `fineract/build.gradle` and `fineract/settings.gradle`:

```
Lynia-finance/                      # Repo root
├── build.gradle                    # apply from: 'fineract/build.gradle'
├── settings.gradle                 # apply from: 'fineract/settings.gradle'
├── gradle/wrapper/                 # Gradle wrapper config (ROOT level)
├── scripts/                        # Test split scripts (ROOT level)
│   ├── split-tests.sh
│   └── split-features.sh
└── fineract/                       # Apache Fineract code
    ├── build.gradle                # Full Fineract build config
    ├── settings.gradle             # Module definitions with :fineract: prefix
    ├── gradlew                     # Gradle wrapper script
    ├── modules/                    # All Fineract modules
    └── tests/                      # Integration/OAuth2/2FA tests
```

The `fineract/settings.gradle` defines module paths with a `:fineract:` prefix
(e.g., `:fineract:modules:fineract-core`). This works correctly when Gradle runs
from the **repo root** (where `rootDir` = repo root, and `:fineract:modules:fineract-core`
resolves to `fineract/modules/fineract-core/`).

**All Fineract CI workflows set `working-directory: fineract`**, which means:
- Gradle runs from `fineract/` as its root project directory
- Module path `:fineract:modules:fineract-core` resolves to `fineract/fineract/modules/fineract-core/`
- This path **does not exist**, causing silent failures

---

## Complete List of Failing Issues

### ISSUE 1: Test Shard Scripts Not Found [CRITICAL]

**Affected Workflows:**
- `build-postgresql.yml` (line 107-110)
- `build-mysql.yml` (line 106-109)
- `build-mariadb.yml` (line 106-109)
- `build-e2e-tests.yml` (line 66-73)

**Problem:** Workflows set `working-directory: fineract` and then reference:
```yaml
run: |
  chmod +x scripts/split-tests.sh
  ./scripts/split-tests.sh 5 $SHARD_INDEX
```

The scripts exist at **`/scripts/split-tests.sh`** (repo root), not at
`/fineract/scripts/split-tests.sh`.

**Expected Error:**
```
chmod: cannot access 'scripts/split-tests.sh': No such file or directory
```

**Impact:** The "Generate test class list" step fails, preventing any test classes from
being identified and executed.

---

### ISSUE 2: Gradle Module Path Resolution Failure [CRITICAL]

**Affected Workflows:** ALL 8 Fineract workflows

**Problem:** When `./gradlew` runs from `fineract/`, Gradle uses `fineract/settings.gradle`
where `rootDir = fineract/`. Module includes like `:fineract:modules:fineract-core` resolve
to directory `fineract/fineract/modules/fineract-core/` which does not exist.

**Module Path Mapping (BROKEN):**
```
settings.gradle path              → Resolved directory (from fineract/)
:fineract:modules:fineract-core   → fineract/fineract/modules/fineract-core/  ✗ MISSING
:fineract:modules:fineract-provider → fineract/fineract/modules/fineract-provider/ ✗ MISSING
:fineract:tests:integration-tests  → fineract/fineract/tests/integration-tests/   ✗ MISSING
```

**Module Path Mapping (CORRECT, from repo root):**
```
settings.gradle path              → Resolved directory (from repo root)
:fineract:modules:fineract-core   → fineract/modules/fineract-core/  ✓ EXISTS
:fineract:modules:fineract-provider → fineract/modules/fineract-provider/ ✓ EXISTS
:fineract:tests:integration-tests  → fineract/tests/integration-tests/   ✓ EXISTS
```

**Impact:** Gradle cannot resolve any project modules. Build fails at configuration phase.

---

### ISSUE 3: split-tests.sh Extracts Wrong Module Names [CRITICAL]

**Affected Workflows:** build-postgresql.yml, build-mysql.yml, build-mariadb.yml

**Problem:** The `split-tests.sh` script runs `find` from the working directory and extracts
module paths by stripping the path before `/src/test/java/`:

```bash
module_path="${filepath%%/src/test/java/*}"
module_name=$(echo "$module_path" | sed 's|^\./||; s|/|:|g; s|^|:|')
```

When run from `fineract/`, this produces:
```
:modules:fineract-core          (extracted by script)
:fineract:modules:fineract-core (expected by Gradle when run from root)
```

The extracted module name **never matches** the Gradle project path.

**Impact:** `./gradlew :modules:fineract-core:test --tests SomeTest` fails with
"Project :modules:fineract-core not found."

---

### ISSUE 4: split-features.sh Wrong Feature Directory Path [CRITICAL]

**Affected Workflows:** build-e2e-tests.yml

**Problem:** The `split-features.sh` script (at repo root) hardcodes:
```bash
FEATURES_DIR="fineract-e2e-tests-runner/src/test/resources/features"
```

From the `fineract/` working directory, the actual path is:
```
modules/fineract-e2e-tests-runner/src/test/resources/features
```

**Expected Error:**
```
Error: Features directory not found at fineract-e2e-tests-runner/src/test/resources/features
```

**Impact:** No feature files are found. E2E tests produce empty shards and skip silently.

---

### ISSUE 5: Gradle Wrapper Infrastructure Missing [HIGH]

**Affected Workflows:** ALL workflows with `working-directory: fineract`

**Problem:** The `fineract/gradlew` script expects:
```
fineract/gradle/wrapper/gradle-wrapper.jar
fineract/gradle/wrapper/gradle-wrapper.properties
```

Neither exists. The Gradle wrapper config only exists at the repo root:
```
gradle/wrapper/gradle-wrapper.properties  ✓ EXISTS (Gradle 8.14.3)
fineract/gradle/wrapper/                  ✗ DIRECTORY MISSING
```

**Mitigating Factor:** The `gradle/actions/setup-gradle` GitHub Action may compensate
by installing Gradle globally, but this is fragile and undocumented behavior.

---

### ISSUE 6: Hardcoded Module Paths in Workflow Gradle Commands [HIGH]

**Affected Workflows & Commands:**

| Workflow | Command Used | Correct Path |
|----------|-------------|--------------|
| build-docker.yml | `:fineract-provider:jibDockerBuild` | `:fineract:modules:fineract-provider:jibDockerBuild` |
| build-cucumber.yml | `:fineract-e2e-tests-runner:cucumber` | `:fineract:modules:fineract-e2e-tests-runner:cucumber` |
| build-cucumber.yml | `:fineract-progressive-loan-embeddable-schedule-generator:shadowJar` | `:fineract:modules:fineract-progressive-loan-embeddable-schedule-generator:shadowJar` |
| build-cucumber.yml | `:fineract-progressive-loan-embeddable-schedule-generator:test` | `:fineract:modules:fineract-progressive-loan-embeddable-schedule-generator:test` |
| build-e2e-tests.yml | `:fineract-provider:jibDockerBuild` | `:fineract:modules:fineract-provider:jibDockerBuild` |
| build-e2e-tests.yml | `:fineract-e2e-tests-runner:cucumber` | `:fineract:modules:fineract-e2e-tests-runner:cucumber` |
| smoke-messaging.yml | `:fineract-provider:jibDockerBuild` | `:fineract:modules:fineract-provider:jibDockerBuild` |
| smoke-messaging.yml | `:integration-tests:cleanTest` | `:fineract:tests:integration-tests:cleanTest` |
| smoke-messaging.yml | `:integration-tests:test` | `:fineract:tests:integration-tests:test` |

**Impact:** Gradle cannot find the referenced tasks. Commands fail with "Task not found."

---

### ISSUE 7: Sequential Workflow Missing gradlew and Working Directory [HIGH]

**Affected Workflow:** run-integration-test-sequentially-postgresql.yml

**Problems (3 compounding issues):**
1. **No `working-directory`** set - runs from repo root
2. **No `gradlew` at repo root** - only exists at `fineract/gradlew`
3. **Wrong module paths** - uses `:twofactor-tests:test` instead of `:fineract:tests:twofactor-tests:test`

**Commands with wrong paths:**
```yaml
./gradlew --no-daemon --console=plain cucumber -x :fineract-e2e-tests-runner:cucumber
./gradlew --no-daemon --console=plain test -x :twofactor-tests:test -x :oauth2-test:test
./gradlew --no-daemon --console=plain :twofactor-tests:test -PdbType=postgresql
./gradlew --no-daemon --console=plain :oauth2-tests:test -PdbType=postgresql
```

**Expected Error:**
```
./gradlew: No such file or directory
```

**Impact:** Workflow fails immediately. Cannot execute any tests.

---

### ISSUE 8: Module Name Typo in Sequential Workflow [MEDIUM]

**Affected Workflow:** run-integration-test-sequentially-postgresql.yml (line 82)

**Problem:**
```yaml
-x :oauth2-test:test    # WRONG (singular, missing 's')
-x :oauth2-tests:test   # CORRECT (plural)
```

**Impact:** Gradle exclusion doesn't match any project, causing either a warning or failure.

---

### ISSUE 9: MariaDB Workflow Missing -PdbType Flag [MEDIUM]

**Affected Workflow:** build-mariadb.yml (line 137)

**Problem:** PostgreSQL and MySQL workflows pass database type flags:
```yaml
# PostgreSQL: -PdbType=postgresql
# MySQL:      -PdbType=mysql
# MariaDB:    (nothing)  ← MISSING
```

**Impact:** Tests may use the default database type. Since MariaDB IS the default in
upstream Fineract, this may not cause failures but is inconsistent and fragile.

---

### ISSUE 10: Artifact Upload Path Mismatches [LOW]

**Affected Workflow:** run-integration-test-sequentially-postgresql.yml

**Problem:** Artifact paths don't include the `fineract/` prefix:
```yaml
path: |
  build/reports/                    # Should be: fineract/build/reports/
  integration-tests/build/reports/  # Should be: fineract/tests/integration-tests/build/reports/
```

**Impact:** Test reports and logs are not captured as artifacts.

---

## Fix Strategy

### Approach: Run Gradle from Repo Root (Recommended)

The cleanest fix is to **remove `working-directory: fineract`** from all workflows and
run everything from the repo root. This aligns with how the project is actually structured.

### Step-by-Step Fix Plan

#### Phase 1: Foundation Fixes (Must Do First)

**1.1 Add gradlew to repo root**
```bash
cp fineract/gradlew ./gradlew
cp fineract/gradlew.bat ./gradlew.bat
chmod +x ./gradlew
```
The root `gradle/wrapper/gradle-wrapper.properties` already exists. The wrapper JAR will
be downloaded on first run.

**1.2 Remove `working-directory: fineract` from all workflows**

Update these 7 workflow files:
- `.github/workflows/build-postgresql.yml`
- `.github/workflows/build-mysql.yml`
- `.github/workflows/build-mariadb.yml`
- `.github/workflows/build-cucumber.yml`
- `.github/workflows/build-e2e-tests.yml`
- `.github/workflows/build-docker.yml`
- `.github/workflows/smoke-messaging.yml`

Remove the `defaults: run: working-directory: fineract` block from each.

#### Phase 2: Fix Script Paths

**2.1 Update split-tests.sh to run from repo root**

The `find` command needs to search from `fineract/`:
```bash
# Change: find . -type f -path "*/src/test/java/*.java"
# To:     find fineract -type f -path "*/src/test/java/*.java"
```

The module path extraction needs to produce full Gradle paths:
```bash
# From fineract/modules/fineract-core/src/test/java/...
# Extract: :fineract:modules:fineract-core
module_path="${filepath%%/src/test/java/*}"
module_name=$(echo "$module_path" | sed 's|^fineract/||; s|/|:|g; s|^|:fineract:|')
```

**2.2 Update split-features.sh to use correct path**
```bash
# Change: FEATURES_DIR="fineract-e2e-tests-runner/src/test/resources/features"
# To:     FEATURES_DIR="fineract/modules/fineract-e2e-tests-runner/src/test/resources/features"
```

Also update the path stripping logic:
```bash
# Change: rel_path="${file#fineract-e2e-tests-runner/}"
# To:     rel_path="${file#fineract/modules/fineract-e2e-tests-runner/}"
```

#### Phase 3: Fix Gradle Module References in Workflows

**3.1 Update all Gradle task references to use full module paths**

| Old Path | New Path |
|----------|----------|
| `:fineract-provider:jibDockerBuild` | `:fineract:modules:fineract-provider:jibDockerBuild` |
| `:fineract-provider:processResources` | `:fineract:modules:fineract-provider:processResources` |
| `:fineract-e2e-tests-runner:cucumber` | `:fineract:modules:fineract-e2e-tests-runner:cucumber` |
| `:fineract-e2e-tests-runner:test` | `:fineract:modules:fineract-e2e-tests-runner:test` |
| `:fineract-progressive-loan-...:shadowJar` | `:fineract:modules:fineract-progressive-loan-...:shadowJar` |
| `:fineract-progressive-loan-...:test` | `:fineract:modules:fineract-progressive-loan-...:test` |
| `:integration-tests:test` | `:fineract:tests:integration-tests:test` |
| `:integration-tests:cleanTest` | `:fineract:tests:integration-tests:cleanTest` |
| `:twofactor-tests:test` | `:fineract:tests:twofactor-tests:test` |
| `:oauth2-tests:test` | `:fineract:tests:oauth2-tests:test` |

**3.2 Fix database init Gradle tasks**

Update database creation commands:
```yaml
# PostgreSQL:
./gradlew --no-daemon -q createPGDB -PdbName=fineract_tenants
# MySQL:
./gradlew --no-daemon -q createMySQLDB -PdbName=fineract_tenants
# MariaDB:
./gradlew --no-daemon -q createDB -PdbName=fineract_tenants
```
These custom tasks are defined in `fineract/build.gradle` and should work from the
root since the root build.gradle delegates to it.

**3.3 Update docker-compose paths**

Docker compose files are in `fineract/`:
```yaml
# Change:
docker compose -f docker-compose-postgresql-test-activemq.yml up -d
# To:
docker compose -f fineract/docker-compose-postgresql-test-activemq.yml up -d
```

**3.4 Update progressive-loan JAR path**

In build-cucumber.yml:
```yaml
# Change:
EMBEDDABLE_JAR_FILE=$(ls fineract-progressive-loan-.../build/libs/*-all.jar)
# To:
EMBEDDABLE_JAR_FILE=$(ls fineract/modules/fineract-progressive-loan-.../build/libs/*-all.jar)
```

#### Phase 4: Fix Sequential Workflow

**4.1 Fix run-integration-test-sequentially-postgresql.yml**
- Do NOT add `working-directory` (it already runs from root - correct approach)
- Add `gradlew` to repo root (covered in Phase 1)
- Fix all module path references (covered in Phase 3)
- Fix typo: `:oauth2-test:test` → `:oauth2-tests:test`

#### Phase 5: Fix MariaDB Database Type

**5.1 Add -PdbType to MariaDB workflow**
```yaml
# Add -PdbType=mariadb to the Gradle test command in build-mariadb.yml
./gradlew "$module:test" $test_args -PdbType=mariadb -x checkstyleJmh ...
```

#### Phase 6: Fix Artifact Upload Paths

**6.1 Prefix artifact paths with `fineract/`**

Update all `upload-artifact` steps to use paths relative to repo root:
```yaml
path: |
  fineract/**/build/reports/
  fineract/**/build/cargo/
```

---

## Affected Workflows Summary

| Workflow | Issues | Priority |
|----------|--------|----------|
| build-postgresql.yml | #1, #2, #3, #5 | CRITICAL |
| build-mysql.yml | #1, #2, #3, #5 | CRITICAL |
| build-mariadb.yml | #1, #2, #3, #5, #9 | CRITICAL |
| build-e2e-tests.yml | #1, #2, #4, #5, #6 | CRITICAL |
| build-cucumber.yml | #2, #5, #6 | HIGH |
| build-docker.yml | #2, #5, #6 | HIGH |
| smoke-messaging.yml | #2, #5, #6 | HIGH |
| run-integration-test-sequentially-postgresql.yml | #6, #7, #8, #10 | HIGH |

---

## Validation Plan

After implementing fixes:

1. **Trigger each workflow** by pushing a change to a `fineract/**` file
2. **Verify run durations** - PostgreSQL/MySQL/MariaDB tests should take 30-60+ minutes
3. **Check test counts** - Each shard should report running 50-200+ test classes
4. **Verify artifacts** - Test reports and server logs should be uploaded
5. **Monitor E2E tests** - Should take 20-40+ minutes per shard with actual feature execution
6. **Run sequential workflow** manually via `workflow_dispatch` to validate

---

## Files That Need Changes

```
# Repo root (new/modified)
./gradlew                                    # NEW: Copy from fineract/gradlew
./gradlew.bat                                # NEW: Copy from fineract/gradlew.bat

# Scripts (modified)
scripts/split-tests.sh                       # Fix find path and module extraction
scripts/split-features.sh                    # Fix FEATURES_DIR path

# Workflows (modified - 8 files)
.github/workflows/build-postgresql.yml       # Remove working-directory, fix paths
.github/workflows/build-mysql.yml            # Remove working-directory, fix paths
.github/workflows/build-mariadb.yml          # Remove working-directory, fix paths, add -PdbType
.github/workflows/build-cucumber.yml         # Remove working-directory, fix module paths
.github/workflows/build-e2e-tests.yml        # Remove working-directory, fix paths
.github/workflows/build-docker.yml           # Remove working-directory, fix paths
.github/workflows/smoke-messaging.yml        # Remove working-directory, fix paths
.github/workflows/run-integration-test-sequentially-postgresql.yml  # Fix module paths, typo
```
