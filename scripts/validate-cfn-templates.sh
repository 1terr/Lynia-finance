#!/usr/bin/env bash
# ============================================================================
# Lynia Finance - CloudFormation Template Validator
# ============================================================================
# Validates all CloudFormation templates in the repository.
# Can run in two modes:
#   1. Local validation: YAML syntax + basic structure checks (no AWS needed)
#   2. AWS validation: Full CloudFormation validate-template API (needs creds)
#
# Usage:
#   ./scripts/validate-cfn-templates.sh              # Local + AWS validation
#   ./scripts/validate-cfn-templates.sh --local-only  # Local validation only
#   ./scripts/validate-cfn-templates.sh --verbose      # Show template details
#
# Exit codes:
#   0 - All templates valid
#   1 - One or more templates invalid
# ============================================================================

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

LOCAL_ONLY=false
VERBOSE=false
REGION="us-east-1"
PASSED=0
FAILED=0
WARNINGS=0

for arg in "$@"; do
  case $arg in
    --local-only) LOCAL_ONLY=true ;;
    --verbose) VERBOSE=true ;;
    --help)
      echo "Usage: $0 [--local-only] [--verbose]"
      exit 0
      ;;
  esac
done

pass()    { echo -e "${GREEN}  [PASS]${NC} $1"; PASSED=$((PASSED + 1)); }
fail()    { echo -e "${RED}  [FAIL]${NC} $1"; FAILED=$((FAILED + 1)); }
warn()    { echo -e "${YELLOW}  [WARN]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
info()    { echo -e "${BLUE}  [INFO]${NC} $1"; }

# Collect all infrastructure YAML files
TEMPLATES=()
while IFS= read -r -d '' file; do
  TEMPLATES+=("$file")
done < <(find "$PROJECT_ROOT/infrastructure" -name "*.yaml" -print0 | sort -z)

# Also include the root SAM template
if [ -f "$PROJECT_ROOT/template.yaml" ]; then
  TEMPLATES+=("$PROJECT_ROOT/template.yaml")
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CloudFormation Template Validation"
echo "  Found ${#TEMPLATES[@]} templates"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Local Validation: YAML syntax + CloudFormation structure
# ============================================================================
echo -e "${BLUE}--- Local Validation (YAML syntax + structure) ---${NC}"
echo ""

for template in "${TEMPLATES[@]}"; do
  rel_path="${template#$PROJECT_ROOT/}"
  file_size=$(wc -c < "$template")

  # Check YAML syntax with python (supports CloudFormation intrinsic functions)
  yaml_error=$(python3 -c "
import yaml, sys

# Register CloudFormation intrinsic function tags so PyYAML can parse them
cfn_tags = [
    'Ref', 'Sub', 'GetAtt', 'Join', 'Select', 'Split', 'FindInMap',
    'GetAZs', 'Base64', 'Cidr', 'ImportValue', 'Transform', 'ToJsonString',
    'If', 'Not', 'Equals', 'And', 'Or', 'Condition',
]
for tag in cfn_tags:
    yaml.add_multi_constructor(f'!{tag}', lambda loader, suffix, node: None, Loader=yaml.SafeLoader)

# Also handle short-form tags that appear as scalars, sequences, or mappings
class CfnLoader(yaml.SafeLoader):
    pass

def cfn_constructor(loader, tag_suffix, node):
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    elif isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    elif isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node)
    return None

CfnLoader.add_multi_constructor('!', cfn_constructor)

try:
    with open('$template', 'r') as f:
        docs = list(yaml.load_all(f, Loader=CfnLoader))
    if not docs or docs[0] is None:
        print('ERROR: Empty YAML document')
        sys.exit(1)
    doc = docs[0]
    # Check for AWSTemplateFormatVersion or Transform (SAM)
    has_version = 'AWSTemplateFormatVersion' in doc
    has_transform = 'Transform' in doc
    has_resources = 'Resources' in doc
    if not has_version and not has_transform:
        print('WARNING: Missing AWSTemplateFormatVersion or Transform')
    if not has_resources:
        print('WARNING: Missing Resources section')
    # Count resources
    resource_count = len(doc.get('Resources', {}))
    param_count = len(doc.get('Parameters', {}))
    output_count = len(doc.get('Outputs', {}))
    desc = doc.get('Description', 'No description')
    print(f'OK|{resource_count}|{param_count}|{output_count}|{desc}')
except yaml.YAMLError as e:
    print(f'ERROR: {e}')
    sys.exit(1)
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
" 2>&1)

  if [[ "$yaml_error" == OK* ]]; then
    IFS='|' read -r status resources params outputs description <<< "$yaml_error"
    pass "$rel_path (${file_size}B, ${resources} resources, ${params} params, ${outputs} outputs)"
    if [ "$VERBOSE" = true ] && [ -n "$description" ]; then
      info "  Description: $description"
    fi
  elif [[ "$yaml_error" == WARNING* ]]; then
    warn "$rel_path: $yaml_error"
  else
    fail "$rel_path: $yaml_error"
  fi
done

# ============================================================================
# AWS CloudFormation API Validation (if credentials available)
# ============================================================================
if [ "$LOCAL_ONLY" = false ]; then
  echo ""
  echo -e "${BLUE}--- AWS CloudFormation API Validation ---${NC}"
  echo ""

  # Check if AWS credentials are available
  if aws sts get-caller-identity &>/dev/null; then
    for template in "${TEMPLATES[@]}"; do
      rel_path="${template#$PROJECT_ROOT/}"
      file_size=$(wc -c < "$template")

      if [ "$file_size" -gt 51200 ]; then
        warn "$rel_path: Too large for --template-body (${file_size}B > 51200B). Upload to S3 first."
        continue
      fi

      cfn_output=$(aws cloudformation validate-template \
        --template-body "file://${template}" \
        --region "$REGION" \
        --query "Description" \
        --output text 2>&1)

      if [ $? -eq 0 ]; then
        pass "$rel_path (CFN API valid)"
      else
        fail "$rel_path: $cfn_output"
      fi
    done
  else
    warn "AWS credentials not available. Skipping CloudFormation API validation."
    info "Run with --local-only to suppress this warning, or configure AWS credentials."
  fi
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${RED}Failed:${NC}   $FAILED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAILED" -gt 0 ]; then
  echo -e "\n${RED}VALIDATION FAILED${NC}"
  exit 1
else
  echo -e "\n${GREEN}ALL TEMPLATES VALID${NC}"
  exit 0
fi
