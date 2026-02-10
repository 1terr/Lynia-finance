# =============================================================================
# Lynia Finance — Cloudflare Infrastructure (Terraform)
# =============================================================================
# Manages DNS records, SSL/TLS settings, firewall rules, and page rules
# for lyniafinance.com on Cloudflare.
#
# Usage:
#   cd phase-4-integration/domain-setup/terraform
#   terraform init
#   terraform plan
#   terraform apply
#
# Required environment variables:
#   CLOUDFLARE_API_TOKEN  — API token with Zone:Edit, DNS:Edit permissions
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Uncomment to use remote state (recommended for team use)
  # backend "s3" {
  #   bucket  = "lynia-finance-terraform-state"
  #   key     = "cloudflare/terraform.tfstate"
  #   region  = "us-east-1"
  #   encrypt = true
  # }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# =============================================================================
# Variables
# =============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for lyniafinance.com"
  type        = string
}

variable "domain" {
  description = "Root domain name"
  type        = string
  default     = "lyniafinance.com"
}

# AWS targets — set after deploying AWS infrastructure
variable "admin_cloudfront_domain" {
  description = "CloudFront distribution domain for admin portal (e.g., d1234.cloudfront.net)"
  type        = string
  default     = ""
}

variable "distributor_cloudfront_domain" {
  description = "CloudFront distribution domain for distributor dashboard"
  type        = string
  default     = ""
}

variable "api_gateway_domain" {
  description = "API Gateway regional domain (e.g., d-abc123.execute-api.us-east-1.amazonaws.com)"
  type        = string
  default     = ""
}

# ACM certificate validation records
variable "acm_wildcard_validation_name" {
  description = "ACM wildcard cert DNS validation CNAME name"
  type        = string
  default     = ""
}

variable "acm_wildcard_validation_value" {
  description = "ACM wildcard cert DNS validation CNAME value"
  type        = string
  default     = ""
}

variable "acm_api_validation_name" {
  description = "ACM API cert DNS validation CNAME name"
  type        = string
  default     = ""
}

variable "acm_api_validation_value" {
  description = "ACM API cert DNS validation CNAME value"
  type        = string
  default     = ""
}

# =============================================================================
# Data Sources
# =============================================================================

data "cloudflare_zone" "main" {
  zone_id = var.cloudflare_zone_id
}

# =============================================================================
# DNS Records
# =============================================================================

# Admin Portal → CloudFront (DNS only to avoid double-CDN)
resource "cloudflare_record" "admin" {
  count   = var.admin_cloudfront_domain != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "admin"
  content = var.admin_cloudfront_domain
  type    = "CNAME"
  proxied = false  # DNS only — CloudFront handles CDN
  comment = "Admin portal - CloudFront distribution"
}

# Distributor Dashboard → CloudFront (DNS only)
resource "cloudflare_record" "distributor" {
  count   = var.distributor_cloudfront_domain != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "distributor"
  content = var.distributor_cloudfront_domain
  type    = "CNAME"
  proxied = false
  comment = "Distributor dashboard - CloudFront distribution"
}

# API Gateway (DNS only — AWS WAF handles security)
resource "cloudflare_record" "api" {
  count   = var.api_gateway_domain != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = var.api_gateway_domain
  type    = "CNAME"
  proxied = false
  comment = "API Gateway custom domain"
}

# www redirect (proxied for Cloudflare redirect rules)
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = var.domain
  type    = "CNAME"
  proxied = true
  comment = "www redirect to root domain"
}

# ACM Wildcard Certificate Validation
resource "cloudflare_record" "acm_wildcard_validation" {
  count   = var.acm_wildcard_validation_name != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = var.acm_wildcard_validation_name
  content = var.acm_wildcard_validation_value
  type    = "CNAME"
  proxied = false  # Must be DNS only for ACM validation
  comment = "ACM wildcard certificate DNS validation"
}

# ACM API Certificate Validation
resource "cloudflare_record" "acm_api_validation" {
  count   = var.acm_api_validation_name != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = var.acm_api_validation_name
  content = var.acm_api_validation_value
  type    = "CNAME"
  proxied = false
  comment = "ACM API certificate DNS validation"
}

# =============================================================================
# SSL/TLS Settings
# =============================================================================

resource "cloudflare_zone_settings_override" "settings" {
  zone_id = var.cloudflare_zone_id

  settings {
    # SSL/TLS
    ssl                      = "strict"        # Full (Strict)
    always_use_https         = "on"
    min_tls_version          = "1.2"
    tls_1_3                  = "on"
    opportunistic_encryption = "on"
    automatic_https_rewrites = "on"

    # Security
    security_level  = "medium"
    browser_check   = "on"
    challenge_ttl   = 1800                     # 30 minutes

    # HSTS
    security_header {
      enabled            = true
      max_age            = 31536000            # 12 months
      include_subdomains = true
      preload            = true
      nosniff            = true
    }

    # Performance
    minify {
      css  = "on"
      js   = "on"
      html = "on"
    }
    brotli = "on"
  }
}

# =============================================================================
# Page Rules
# =============================================================================

# Redirect www to root
resource "cloudflare_page_rule" "www_redirect" {
  zone_id  = var.cloudflare_zone_id
  target   = "www.${var.domain}/*"
  priority = 1
  status   = "active"

  actions {
    forwarding_url {
      url         = "https://${var.domain}/$1"
      status_code = 301
    }
  }
}

# API - bypass cache
resource "cloudflare_page_rule" "api_no_cache" {
  zone_id  = var.cloudflare_zone_id
  target   = "api.${var.domain}/*"
  priority = 2
  status   = "active"

  actions {
    cache_level = "bypass"
  }
}

# =============================================================================
# Firewall Rules
# =============================================================================

# Block requests without User-Agent
resource "cloudflare_filter" "no_user_agent" {
  zone_id     = var.cloudflare_zone_id
  description = "Requests without User-Agent header"
  expression  = "(len(http.user_agent) eq 0)"
}

resource "cloudflare_firewall_rule" "block_no_user_agent" {
  zone_id     = var.cloudflare_zone_id
  description = "Block requests without User-Agent"
  filter_id   = cloudflare_filter.no_user_agent.id
  action      = "block"
  priority    = 1
}

# Challenge non-African traffic on sensitive endpoints
resource "cloudflare_filter" "geo_sensitive" {
  zone_id     = var.cloudflare_zone_id
  description = "Non-African traffic on sensitive endpoints"
  expression  = "(not ip.geoip.country in {\"ZW\" \"ZA\" \"BW\" \"MZ\" \"MW\" \"US\" \"GB\"}) and (http.request.uri.path contains \"/kyc\" or http.request.uri.path contains \"/loans/apply\")"
}

resource "cloudflare_firewall_rule" "challenge_geo_sensitive" {
  zone_id     = var.cloudflare_zone_id
  description = "Challenge non-African sensitive endpoint requests"
  filter_id   = cloudflare_filter.geo_sensitive.id
  action      = "managed_challenge"
  priority    = 2
}

# =============================================================================
# Rate Limiting
# =============================================================================

# Auth endpoint rate limiting
resource "cloudflare_rate_limit" "auth_rate_limit" {
  zone_id   = var.cloudflare_zone_id
  threshold = 20
  period    = 60
  description = "Rate limit auth endpoints: 20 req/min"

  match {
    request {
      url_pattern = "*.${var.domain}/*/auth*"
      schemes     = ["HTTPS"]
      methods     = ["_ALL_"]
    }
  }

  action {
    mode    = "ban"
    timeout = 600
  }
}

# General API rate limiting
resource "cloudflare_rate_limit" "api_rate_limit" {
  zone_id   = var.cloudflare_zone_id
  threshold = 100
  period    = 60
  description = "Rate limit general API: 100 req/min"

  match {
    request {
      url_pattern = "api.${var.domain}/*"
      schemes     = ["HTTPS"]
      methods     = ["_ALL_"]
    }
  }

  action {
    mode    = "ban"
    timeout = 300
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "zone_status" {
  description = "Cloudflare zone status"
  value       = data.cloudflare_zone.main.status
}

output "admin_portal_url" {
  description = "Admin portal URL"
  value       = var.admin_cloudfront_domain != "" ? "https://admin.${var.domain}" : "Not configured"
}

output "distributor_dashboard_url" {
  description = "Distributor dashboard URL"
  value       = var.distributor_cloudfront_domain != "" ? "https://distributor.${var.domain}" : "Not configured"
}

output "api_url" {
  description = "API URL"
  value       = var.api_gateway_domain != "" ? "https://api.${var.domain}" : "Not configured"
}

output "dns_records_summary" {
  description = "DNS records created"
  value = {
    admin       = var.admin_cloudfront_domain != "" ? "admin.${var.domain} → ${var.admin_cloudfront_domain}" : "Pending"
    distributor = var.distributor_cloudfront_domain != "" ? "distributor.${var.domain} → ${var.distributor_cloudfront_domain}" : "Pending"
    api         = var.api_gateway_domain != "" ? "api.${var.domain} → ${var.api_gateway_domain}" : "Pending"
    www         = "www.${var.domain} → ${var.domain} (301 redirect)"
  }
}
