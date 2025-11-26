# Machine Learning Model Architecture (Placeholder Design)

**Task ID**: P1-T018
**Phase**: Phase 1 - Design (Implementation Phase 3+)
**Priority**: Medium
**Estimated**: 8 hours
**Dependencies**: P1-T015 (Algorithm), P1-T016 (Features)

**Note**: ML implementation deferred to Phase 3+ (when sufficient training data available). This document provides architectural design for future implementation.

---

## Table of Contents
1. [Overview](#overview)
2. [Model Architecture](#model-architecture)
3. [Training Data Requirements](#training-data-requirements)
4. [Model Evaluation Metrics](#model-evaluation-metrics)
5. [Continuous Learning Plan](#continuous-learning-plan)
6. [Fallback Strategy](#fallback-strategy)
7. [Infrastructure & Deployment](#infrastructure--deployment)

---

## 1. Overview

### Why ML Models (Phase 3+)?

**Current State (Phase 1)**: Rule-based scoring
- ✅ Fast implementation
- ✅ Fully explainable
- ✅ No training data needed
- ❌ Limited approval rate (60-70%)
- ❌ Cannot capture complex patterns

**Future State (Phase 3+)**: ML-enhanced scoring
- ✅ Higher approval rate (75-85%)
- ✅ Better default prediction
- ✅ Adaptive to market changes
- ✅ Platform data integration (InDrive, Bolt)
- ⚠️ Requires 1,000+ loans with 6+ months history

### Phased Rollout Strategy

```
Phase 1 (Months 1-6): 100% Rule-Based
├── Goal: Build loan portfolio
├── Data: 0-200 loans
└── Approval Rate: 60-70%

Phase 2 (Months 7-12): Hybrid (70% Rules + 30% ML)
├── Goal: Validate ML model
├── Data: 200-1,000 loans
├── Model: LightGBM (lightweight)
└── Approval Rate: 70-75%

Phase 3 (Year 2+): ML-First (80% ML + 20% Rules)
├── Goal: Maximize performance
├── Data: 1,000+ loans
├── Model: Advanced ensemble (XGBoost + LightGBM)
└── Approval Rate: 75-85%
```

---

## 2. Model Architecture

### 2.1 Model Selection

**Primary Model**: **LightGBM** (Light Gradient Boosting Machine)

**Why LightGBM?**
- ✅ Fast training (<5 minutes on 10K loans)
- ✅ Low memory footprint (~10MB model file)
- ✅ Handles missing values natively
- ✅ Feature importance built-in
- ✅ Used by African fintechs (M-Kopa, Branch)
- ✅ Better than logistic regression for thin-file customers

**Alternative**: XGBoost (Phase 3+ ensemble)

---

### 2.2 Model Pipeline

```python
# Full ML Pipeline (Phase 3+)

from lightgbm import LGBMClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

# Define pipeline
credit_scoring_pipeline = Pipeline([
    # Step 1: Handle missing values
    ('imputer', SimpleImputer(strategy='median')),

    # Step 2: Scale features (optional for tree-based models)
    # ('scaler', StandardScaler()),

    # Step 3: Train LightGBM classifier
    ('classifier', LGBMClassifier(
        objective='binary',
        metric='auc',
        boosting_type='gbdt',
        num_leaves=31,
        max_depth=6,
        learning_rate=0.05,
        n_estimators=500,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,  # L1 regularization
        reg_lambda=0.1,  # L2 regularization
        random_state=42
    ))
])

# Train model
X_train, X_test, y_train, y_test = train_test_split(
    features_df,
    target_df['default'],
    test_size=0.2,
    stratify=target_df['default'],
    random_state=42
)

credit_scoring_pipeline.fit(X_train, y_train)
```

---

### 2.3 Ensemble Model (Phase 3+ Advanced)

```python
from sklearn.ensemble import VotingClassifier

# Ensemble of multiple models
ensemble_model = VotingClassifier(
    estimators=[
        ('lgbm', LGBMClassifier(**lgbm_params)),
        ('xgb', XGBClassifier(**xgb_params)),
        ('rf', RandomForestClassifier(**rf_params))
    ],
    voting='soft',  # Use probability averaging
    weights=[0.5, 0.3, 0.2]  # LightGBM weighted most
)

ensemble_model.fit(X_train, y_train)
```

---

### 2.4 Feature Engineering

**87 Features** (as defined in P1-T016):

```python
# Feature categories
feature_categories = {
    'kyc': [
        'kyc_face_match_score',
        'kyc_id_verified',
        'kyc_liveness_passed',
        'age',
        'age_squared'
    ],
    'demographics': [
        'is_urban',
        'population_density',
        'distance_from_agent_km',
        'employment_type_encoded'
    ],
    'mobile_money': [
        'mm_avg_monthly_inflow',
        'mm_inflow_to_outflow_ratio',
        'mm_transaction_count_3m',
        'mm_balance_current'
    ],
    'airtime': [  # Phase 3+
        'airtime_consistency_score',
        'airtime_avg_recharge_amount',
        'airtime_peak_recharge_day'
    ],
    'platform': [  # Phase 3+
        'platform_avg_monthly_earnings',
        'platform_driver_rating',
        'platform_active_days_per_week'
    ],
    'loan_features': [
        'loan_amount',
        'installment_to_income_ratio',
        'loan_to_income_ratio',
        'down_payment_pct'
    ],
    'behavioral': [
        'whatsapp_response_time_avg',
        'application_completion_rate',
        'device_browsing_sessions'
    ]
}
```

**Feature Importance** (expected ranking):
1. `installment_to_income_ratio` (affordability)
2. `kyc_face_match_score` (identity confidence)
3. `mm_avg_monthly_inflow` (income proxy)
4. `platform_avg_monthly_earnings` (verified income - Phase 3+)
5. `loan_amount` (risk exposure)

---

## 3. Training Data Requirements

### 3.1 Minimum Data Thresholds

| Phase | Min Loans | Min Defaults | Months History | Model Readiness |
|-------|-----------|--------------|----------------|-----------------|
| Phase 1 | 0-200 | N/A | 0-6 | ❌ Not ready |
| Phase 2 | 200-1,000 | 20-100 | 6-12 | ✅ Baseline model |
| Phase 3 | 1,000+ | 100+ | 12+ | ✅ Production model |

**Rationale**:
- Need sufficient defaults to learn patterns (target: 5-10% default rate)
- Need time for loans to mature (6+ months repayment history)
- Need diverse customer segments

---

### 3.2 Training Dataset Schema

```sql
-- ML training dataset view
CREATE OR REPLACE VIEW ml_training_dataset AS
SELECT
  -- Target variable
  CASE
    WHEN l.status = 'defaulted' THEN 1
    WHEN l.status IN ('paid_off', 'active') THEN 0
    ELSE NULL
  END as default,

  -- KYC Features
  ks.face_match_score as kyc_face_match_score,
  ks.id_verified as kyc_id_verified,
  ks.liveness_passed as kyc_liveness_passed,
  EXTRACT(YEAR FROM AGE(c.birth_date)) as age,

  -- Demographics
  CASE WHEN c.city IN ('Harare', 'Bulawayo', 'Mutare') THEN 1 ELSE 0 END as is_urban,
  c.province,

  -- Mobile Money (if available)
  mm.avg_monthly_inflow_usd as mm_avg_monthly_inflow,
  mm.transaction_count_3m as mm_transaction_count_3m,
  mm.inflow_to_outflow_ratio as mm_inflow_to_outflow_ratio,

  -- Loan Features
  l.principal as loan_amount,
  l.monthly_payment as monthly_installment,
  l.monthly_payment / NULLIF(c.estimated_monthly_income, 0) as installment_to_income_ratio,
  l.principal / NULLIF(c.estimated_monthly_income, 0) as loan_to_income_ratio,
  l.down_payment_percentage as down_payment_pct,

  -- Behavioral
  b.whatsapp_response_time_avg_minutes as whatsapp_response_time_avg,
  b.application_completion_rate,
  b.device_browsing_sessions,

  -- Platform Data (Phase 3+)
  alt.platform_avg_monthly_earnings_usd as platform_avg_monthly_earnings,
  alt.platform_driver_rating,

  -- Metadata
  l.id as loan_id,
  c.id as customer_id,
  l.created_at as loan_date

FROM loans l
JOIN customers c ON l.customer_id = c.id
LEFT JOIN kyc_submissions ks ON c.id = ks.customer_id
LEFT JOIN mobile_money_profiles mm ON c.phone_number = mm.phone_number
LEFT JOIN behavioral_data b ON c.id = b.customer_id
LEFT JOIN alternative_income_sources alt ON c.id = alt.customer_id
WHERE
  l.status IN ('paid_off', 'defaulted')  -- Only completed loans
  AND l.created_at >= NOW() - INTERVAL '18 months'  -- Recent data only
  AND EXTRACT(YEAR FROM AGE(c.birth_date)) BETWEEN 18 AND 65;
```

---

### 3.3 Data Quality Requirements

**Minimum Data Completeness**:
- ✅ 100% complete: KYC features, loan amount, age
- ✅ 80%+ complete: Mobile money data
- ✅ 50%+ complete: Behavioral features
- ⚠️ Optional: Platform data (Phase 3+)

**Handling Missing Data**:
```python
# Imputation strategy
imputation_rules = {
    'mm_avg_monthly_inflow': 'median',  # Use population median
    'mm_transaction_count_3m': 0,  # Assume no MM activity
    'platform_avg_monthly_earnings': 0,  # No platform income
    'whatsapp_response_time_avg': 'median'
}
```

---

## 4. Model Evaluation Metrics

### 4.1 Primary Metrics

**Business Metrics** (what matters to Lynia):
1. **Default Rate**: Target <5% (lower is better)
2. **Approval Rate**: Target 75-85% (higher is better)
3. **Revenue per Customer**: Maximize without increasing defaults

**Model Metrics** (technical performance):
1. **AUC-ROC**: Target >0.75 (discrimination ability)
2. **Precision**: Target >0.70 (correctly predicted defaults)
3. **Recall**: Target >0.60 (catch most defaults)
4. **F1-Score**: Harmonic mean of precision/recall

---

### 4.2 Evaluation Code

```python
from sklearn.metrics import (
    roc_auc_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)

def evaluate_model(model, X_test, y_test):
    # Predict probabilities
    y_pred_proba = model.predict_proba(X_test)[:, 1]

    # Predict classes (default threshold = 0.5, can be tuned)
    y_pred = (y_pred_proba >= 0.5).astype(int)

    # Calculate metrics
    metrics = {
        'auc_roc': roc_auc_score(y_test, y_pred_proba),
        'precision': precision_score(y_test, y_pred),
        'recall': recall_score(y_test, y_pred),
        'f1_score': f1_score(y_test, y_pred)
    }

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)

    print("Model Performance:")
    print(f"AUC-ROC: {metrics['auc_roc']:.4f}")
    print(f"Precision: {metrics['precision']:.4f}")
    print(f"Recall: {metrics['recall']:.4f}")
    print(f"F1-Score: {metrics['f1_score']:.4f}")
    print("\nConfusion Matrix:")
    print(cm)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    return metrics

# Example output:
# Model Performance:
# AUC-ROC: 0.7834
# Precision: 0.7241
# Recall: 0.6453
# F1-Score: 0.6824
```

---

### 4.3 Business Impact Simulation

```python
def simulate_business_impact(model, X_test, y_test, loan_amounts):
    y_pred_proba = model.predict_proba(X_test)[:, 1]

    # Simulate different decision thresholds
    thresholds = [0.3, 0.4, 0.5, 0.6, 0.7]

    results = []
    for threshold in thresholds:
        y_pred = (y_pred_proba >= threshold).astype(int)

        # Calculate business metrics
        approved_mask = y_pred == 0  # Predicted non-defaults
        actual_defaults_mask = y_test == 1

        total_customers = len(y_test)
        approved_count = approved_mask.sum()
        approval_rate = approved_count / total_customers

        # Defaults among approved
        defaults_in_approved = (approved_mask & actual_defaults_mask).sum()
        default_rate_approved = defaults_in_approved / approved_count if approved_count > 0 else 0

        # Revenue simulation (rough estimate)
        avg_loan_amount = np.mean(loan_amounts)
        total_revenue = approved_count * avg_loan_amount * 0.30  # 30% interest
        total_loss = defaults_in_approved * avg_loan_amount * 0.70  # 70% loss on default
        net_profit = total_revenue - total_loss

        results.append({
            'threshold': threshold,
            'approval_rate': approval_rate,
            'default_rate': default_rate_approved,
            'approved_count': approved_count,
            'defaults': defaults_in_approved,
            'net_profit': net_profit
        })

    return pd.DataFrame(results)

# Example output:
#   threshold  approval_rate  default_rate  approved_count  defaults  net_profit
# 0      0.30          0.85          0.08            850        68     $45,230
# 1      0.40          0.78          0.06            780        47     $52,140
# 2      0.50          0.70          0.04            700        28     $54,600  ← Optimal
# 3      0.60          0.58          0.03            580        17     $48,720
# 4      0.70          0.42          0.02            420         8     $35,280
```

---

## 5. Continuous Learning Plan

### 5.1 Model Retraining Schedule

**Phase 2 (Months 7-12)**:
- Retrain: Monthly
- Rationale: Rapid data growth, model needs frequent updates

**Phase 3 (Year 2+)**:
- Retrain: Quarterly
- Rationale: Stable model, slower data growth

**Trigger-Based Retraining** (anytime):
- Performance degradation detected (AUC drops >5%)
- New data sources added (e.g., platform integrations go live)
- Major market changes (economic crisis, policy changes)

---

### 5.2 A/B Testing Framework

```python
# Assign customers to control (rule-based) vs treatment (ML model)
def assign_ab_test_group(customer_id: str) -> str:
    # Use hash for consistent assignment
    hash_val = int(hashlib.md5(customer_id.encode()).hexdigest(), 16)
    return 'control' if hash_val % 2 == 0 else 'treatment'

# Track results by group
ab_test_results = {
    'control': {
        'total_applications': 0,
        'approved': 0,
        'defaults': 0,
        'revenue': 0
    },
    'treatment': {
        'total_applications': 0,
        'approved': 0,
        'defaults': 0,
        'revenue': 0
    }
}

# Statistical significance test (after 1,000+ applications per group)
from scipy.stats import chi2_contingency

def test_ab_significance(control_defaults, control_total, treatment_defaults, treatment_total):
    contingency_table = np.array([
        [control_defaults, control_total - control_defaults],
        [treatment_defaults, treatment_total - treatment_defaults]
    ])

    chi2, p_value, dof, expected = chi2_contingency(contingency_table)

    is_significant = p_value < 0.05

    return {
        'p_value': p_value,
        'is_significant': is_significant,
        'control_default_rate': control_defaults / control_total,
        'treatment_default_rate': treatment_defaults / treatment_total
    }
```

---

### 5.3 Model Monitoring

**Real-Time Monitoring** (alerts):
- Prediction latency >1 second
- Model API errors >1%
- Missing features >20% of requests

**Weekly Monitoring** (dashboards):
- Approval rate trend
- Default rate trend
- Feature drift detection
- Model calibration (predicted vs actual default rates)

---

## 6. Fallback Strategy

### 6.1 Fallback to Rule-Based Scoring

**When to Fallback**:
1. ML model unavailable (API down, deployment failed)
2. Missing critical features (>30% of features missing)
3. Model performance degraded (<0.65 AUC)
4. A/B test shows rule-based performing better

```typescript
async function getCreditDecision(customer: Customer): Promise<CreditDecision> {
  try {
    // Try ML model first (Phase 3+)
    if (process.env.ML_MODEL_ENABLED === 'true') {
      const mlDecision = await callMLModel(customer);

      // Validate ML response
      if (mlDecision.confidence >= 0.7) {
        return mlDecision;
      }
    }
  } catch (error) {
    console.error('ML model failed, falling back to rules:', error);
  }

  // Fallback to rule-based
  return getRuleBasedDecision(customer);
}
```

---

### 6.2 Hybrid Decision Weighting

**Phase 2 Approach** (70% rules + 30% ML):

```typescript
function calculateHybridScore(
  ruleBasedScore: number,
  mlProbability: number
): number {
  // Convert ML probability (0-1) to score (300-850)
  const mlScore = 300 + (1 - mlProbability) * 550;

  // Weighted average
  const hybridScore = (ruleBasedScore * 0.7) + (mlScore * 0.3);

  return Math.round(hybridScore);
}
```

---

## 7. Infrastructure & Deployment

### 7.1 Model Serving Architecture

```
┌─────────────────────────────────────────────────┐
│ WhatsApp Bot / API Request                      │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ Credit Scoring Service (Lambda)                 │
│ - Extract features                              │
│ - Call ML Model API                             │
│ - Apply business rules                          │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ ML Model API (SageMaker Endpoint)              │
│ - LightGBM model                                │
│ - Latency: <100ms                               │
│ - Auto-scaling: 1-10 instances                  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ Response: Probability of Default (0-1)          │
│ Convert to Credit Score (300-850)               │
└─────────────────────────────────────────────────┘
```

---

### 7.2 Model Deployment (AWS SageMaker)

```python
import sagemaker
from sagemaker.sklearn import SKLearnModel

# Package trained model
model_data = 's3://lynia-ml-models/credit-scoring/model-v1.2.tar.gz'

# Deploy to SageMaker endpoint
sklearn_model = SKLearnModel(
    model_data=model_data,
    role='arn:aws:iam::123456789:role/SageMakerRole',
    entry_point='inference.py',
    framework_version='1.0-1',
    py_version='py3'
)

predictor = sklearn_model.deploy(
    instance_type='ml.t2.medium',
    initial_instance_count=1,
    endpoint_name='lynia-credit-scoring-v1'
)

# Auto-scaling configuration
auto_scaling_client.register_scalable_target(
    ServiceNamespace='sagemaker',
    ResourceId=f'endpoint/{endpoint_name}/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    MinCapacity=1,
    MaxCapacity=10
)
```

---

### 7.3 Model Versioning & Rollback

```python
# Model registry (DynamoDB)
model_registry = {
    'v1.0': {
        's3_path': 's3://lynia-ml-models/model-v1.0.tar.gz',
        'training_date': '2025-07-01',
        'auc_roc': 0.7234,
        'status': 'retired'
    },
    'v1.1': {
        's3_path': 's3://lynia-ml-models/model-v1.1.tar.gz',
        'training_date': '2025-10-01',
        'auc_roc': 0.7521,
        'status': 'production'
    },
    'v1.2': {
        's3_path': 's3://lynia-ml-models/model-v1.2.tar.gz',
        'training_date': '2025-11-26',
        'auc_roc': 0.7834,
        'status': 'canary'  # 10% traffic
    }
}

# Gradual rollout
def route_to_model_version(customer_id: str) -> str:
    hash_val = int(hashlib.md5(customer_id.encode()).hexdigest(), 16) % 100

    if hash_val < 10:
        return 'v1.2'  # 10% canary
    else:
        return 'v1.1'  # 90% production
```

---

## Summary

**ML Model Readiness Checklist** (Phase 3+):

Phase 2 (Baseline Model):
- ✅ 200+ completed loans
- ✅ 6+ months repayment history
- ✅ 20+ defaults observed
- ✅ LightGBM model trained
- ✅ AUC >0.70 on test set
- ✅ A/B test framework ready

Phase 3 (Production Model):
- ✅ 1,000+ completed loans
- ✅ 12+ months history
- ✅ 100+ defaults
- ✅ Platform data integrated (InDrive, Bolt)
- ✅ AUC >0.75
- ✅ SageMaker deployment
- ✅ Continuous retraining pipeline

**Fallback**: Rule-based scoring always available (100% coverage)

**Timeline**: Earliest ML model deployment = Month 7 (if data quality sufficient)
