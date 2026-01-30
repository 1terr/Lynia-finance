# Device Condition Assessment

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.6 Device Management Design
**Task ID**: P1-T036
**Priority**: Low
**Estimated Duration**: 4 hours

---

## 1. Overview

Device condition assessment is critical for maintaining inventory quality, setting accurate pricing for refurbished devices, and managing financial risk throughout the device lifecycle. This specification defines standardized procedures for assessing device condition at three key stages:

1. **Initial Intake**: New device inventory received from suppliers
2. **Handover Assessment**: Pre-delivery inspection before customer handover
3. **Return Assessment**: Post-loan inspection for voluntary returns or repossession

The assessment system uses a 4-tier grading scale (Excellent, Good, Fair, Poor) with detailed criteria for physical condition and functional testing.

---

## 2. Device Grading System

### 2.1 Grade Definitions

**Excellent (A)**:
- Device is brand new or like-new
- No visible scratches, dents, or damage
- All functions working perfectly
- Original packaging and accessories included
- Battery health >95%
- Value retention: 90-100% of retail price

**Good (B)**:
- Minor cosmetic wear (light scratches on screen/body)
- All functions working properly
- May have minor scuffs on corners or edges
- Battery health >80%
- Value retention: 70-85% of retail price

**Fair (C)**:
- Moderate cosmetic wear (visible scratches, minor dents)
- All critical functions working (calls, data, camera)
- Some non-critical issues may exist (speaker quality, minor screen discoloration)
- Battery health >60%
- Value retention: 50-65% of retail price

**Poor (D)**:
- Heavy cosmetic damage (cracked screen, significant dents)
- Some functions may not work properly
- Requires repair before resale
- Battery health <60%
- Value retention: 20-40% of retail price (salvage value)

### 2.2 Grade Impact on Operations

| Grade | Initial Inventory | Loan Eligibility | Resale Strategy |
|-------|------------------|------------------|-----------------|
| A (Excellent) | Accept at full cost | Full-price new device loans | Sell as "Like New" at 90-95% retail |
| B (Good) | Accept with 10-15% discount | Standard device loans | Sell as "Refurbished" at 70-80% retail |
| C (Fair) | Accept with 30-40% discount | Require larger deposit (30%) | Sell as "Fair Condition" at 50-60% retail |
| D (Poor) | Reject or salvage only | Not eligible for loans | Parts/repair or sell as-is at 20-30% retail |

---

## 3. Physical Condition Assessment

### 3.1 Inspection Checklist

```typescript
interface PhysicalInspection {
  assessment_id: string;
  device_id: string;
  inspector_id: string;
  inspection_type: 'intake' | 'pre_handover' | 'return';
  inspection_date: Date;

  // Screen Assessment
  screen: {
    condition: 'pristine' | 'minor_scratches' | 'major_scratches' | 'cracked';
    touch_responsive: boolean;
    display_quality: 'perfect' | 'minor_issues' | 'major_issues';
    dead_pixels: number;
    screen_protector: boolean;
    notes?: string;
  };

  // Body Assessment
  body: {
    condition: 'pristine' | 'minor_wear' | 'moderate_wear' | 'heavy_damage';
    dents: number;
    scratches: 'none' | 'light' | 'moderate' | 'heavy';
    paint_chipping: boolean;
    case_included: boolean;
    notes?: string;
  };

  // Buttons & Ports
  buttons_ports: {
    power_button: 'working' | 'stiff' | 'broken';
    volume_buttons: 'working' | 'stiff' | 'broken';
    home_button: 'working' | 'stiff' | 'broken' | 'n/a';
    charging_port: 'working' | 'loose' | 'damaged';
    headphone_jack: 'working' | 'loose' | 'damaged' | 'n/a';
    sim_tray: 'working' | 'stuck' | 'missing';
    notes?: string;
  };

  // Camera Assessment
  camera: {
    rear_camera: 'working' | 'scratched_lens' | 'blurry' | 'broken';
    front_camera: 'working' | 'scratched_lens' | 'blurry' | 'broken';
    flash: 'working' | 'dim' | 'broken';
    notes?: string;
  };

  // Overall Physical Grade
  physical_grade: 'A' | 'B' | 'C' | 'D';
  physical_score: number; // 0-100
}
```

### 3.2 Physical Assessment Scoring

Each component receives a score (0-100), and the overall physical score is the weighted average:

- **Screen**: 40% (most important for user experience)
- **Body**: 25% (cosmetic appeal)
- **Buttons/Ports**: 20% (functional usability)
- **Camera**: 15% (feature importance)

```typescript
function calculatePhysicalScore(inspection: PhysicalInspection): number {
  const screenScore = assessScreenScore(inspection.screen);
  const bodyScore = assessBodyScore(inspection.body);
  const buttonsScore = assessButtonsPortsScore(inspection.buttons_ports);
  const cameraScore = assessCameraScore(inspection.camera);

  return (
    screenScore * 0.40 +
    bodyScore * 0.25 +
    buttonsScore * 0.20 +
    cameraScore * 0.15
  );
}

function assessScreenScore(screen: PhysicalInspection['screen']): number {
  let score = 100;

  // Screen condition impact
  if (screen.condition === 'minor_scratches') score -= 15;
  else if (screen.condition === 'major_scratches') score -= 40;
  else if (screen.condition === 'cracked') score -= 80;

  // Display quality impact
  if (screen.display_quality === 'minor_issues') score -= 10;
  else if (screen.display_quality === 'major_issues') score -= 30;

  // Dead pixels impact
  score -= screen.dead_pixels * 5;

  // Touch responsiveness
  if (!screen.touch_responsive) score -= 50;

  return Math.max(0, score);
}
```

---

## 4. Functional Testing

### 4.1 Functional Test Checklist

```typescript
interface FunctionalTest {
  assessment_id: string;
  device_id: string;
  tester_id: string;
  test_date: Date;

  // Basic Functions
  power_on_off: boolean;
  charging: boolean;

  // Connectivity
  wifi: {
    connects: boolean;
    signal_strength: 'strong' | 'weak' | 'unstable';
    speed_test_mbps?: number;
  };

  cellular: {
    sim_detected: boolean;
    signal_reception: 'strong' | 'weak' | 'unstable';
    calls_working: boolean;
    sms_working: boolean;
    mobile_data_working: boolean;
  };

  bluetooth: {
    working: boolean;
    pairing_successful: boolean;
  };

  // Battery
  battery: {
    charges_fully: boolean;
    health_percentage: number; // iOS: Settings, Android: AccuBattery
    estimated_hours: number; // Estimated usage time
    charging_time_minutes: number; // Time to full charge
  };

  // Sensors & Features
  sensors: {
    gps: boolean;
    accelerometer: boolean;
    proximity_sensor: boolean;
    fingerprint_scanner: boolean | 'n/a';
    face_unlock: boolean | 'n/a';
  };

  // Audio
  audio: {
    earpiece_speaker: 'clear' | 'muffled' | 'broken';
    loudspeaker: 'clear' | 'muffled' | 'broken';
    microphone: 'clear' | 'muffled' | 'broken';
    headphone_audio: 'clear' | 'muffled' | 'broken' | 'n/a';
  };

  // Camera Functions
  camera_test: {
    rear_photo_quality: 'excellent' | 'good' | 'poor';
    front_photo_quality: 'excellent' | 'good' | 'poor';
    video_recording: boolean;
    autofocus: boolean;
  };

  // Overall Functional Grade
  functional_grade: 'A' | 'B' | 'C' | 'D';
  functional_score: number; // 0-100
}
```

### 4.2 Functional Test Scoring

Critical functions must work for device to be loan-eligible:
- Power on/off
- Charging
- Cellular connectivity (calls, SMS, data)
- Battery health >60%

```typescript
function calculateFunctionalScore(test: FunctionalTest): number {
  let score = 100;

  // Critical functions (must work)
  if (!test.power_on_off) return 0;
  if (!test.charging) return 0;
  if (!test.cellular.calls_working) score -= 40;
  if (!test.cellular.sms_working) score -= 20;
  if (!test.cellular.mobile_data_working) score -= 20;

  // Battery health
  if (test.battery.health_percentage < 60) score -= 30;
  else if (test.battery.health_percentage < 80) score -= 15;

  // Connectivity
  if (!test.wifi.connects) score -= 10;
  if (test.wifi.signal_strength === 'weak') score -= 5;
  if (!test.bluetooth.working) score -= 5;

  // Audio quality
  if (test.audio.earpiece_speaker !== 'clear') score -= 10;
  if (test.audio.loudspeaker !== 'clear') score -= 10;
  if (test.audio.microphone !== 'clear') score -= 15;

  // Sensors
  if (!test.sensors.gps) score -= 5;
  if (!test.sensors.accelerometer) score -= 5;

  return Math.max(0, score);
}

function isDeviceLoanEligible(test: FunctionalTest): boolean {
  return (
    test.power_on_off &&
    test.charging &&
    test.cellular.calls_working &&
    test.cellular.sms_working &&
    test.cellular.mobile_data_working &&
    test.battery.health_percentage >= 60
  );
}
```

---

## 5. Overall Device Grade Calculation

### 5.1 Combined Grading Formula

The overall device grade combines physical and functional assessments with weighted importance:

- **Functional Score**: 60% (functionality is most critical)
- **Physical Score**: 40% (cosmetics matter for resale)

```typescript
interface DeviceAssessment {
  assessment_id: string;
  device_id: string;
  assessment_type: 'intake' | 'pre_handover' | 'return';
  assessment_date: Date;

  physical_inspection: PhysicalInspection;
  functional_test: FunctionalTest;

  // Combined Scores
  physical_score: number; // 0-100
  functional_score: number; // 0-100
  overall_score: number; // 0-100
  overall_grade: 'A' | 'B' | 'C' | 'D';

  // Financial Impact
  estimated_value_usd: number;
  value_percentage: number; // % of retail price
  loan_eligible: boolean;
  requires_repair: boolean;
  repair_cost_estimate_usd?: number;

  // Documentation
  photos: string[]; // S3 URLs
  assessor_id: string;
  assessor_signature: string;
  notes?: string;
}

function calculateOverallGrade(
  physicalScore: number,
  functionalScore: number
): { overall_score: number; overall_grade: 'A' | 'B' | 'C' | 'D' } {
  const overallScore = (functionalScore * 0.60) + (physicalScore * 0.40);

  let grade: 'A' | 'B' | 'C' | 'D';
  if (overallScore >= 85) grade = 'A';
  else if (overallScore >= 70) grade = 'B';
  else if (overallScore >= 50) grade = 'C';
  else grade = 'D';

  return { overall_score: overallScore, overall_grade: grade };
}

function estimateDeviceValue(
  retailPrice: number,
  overallScore: number,
  grade: string
): number {
  let valuePercentage: number;

  switch (grade) {
    case 'A':
      valuePercentage = 0.90 + (overallScore - 85) / 100; // 90-95%
      break;
    case 'B':
      valuePercentage = 0.70 + (overallScore - 70) / 50; // 70-85%
      break;
    case 'C':
      valuePercentage = 0.50 + (overallScore - 50) / 66.67; // 50-65%
      break;
    case 'D':
      valuePercentage = 0.20 + (overallScore / 250); // 20-40%
      break;
    default:
      valuePercentage = 0.20;
  }

  return retailPrice * Math.min(valuePercentage, 1.0);
}
```

---

## 6. Photo Documentation Requirements

### 6.1 Required Photos

All device assessments must include standardized photos for documentation and dispute resolution:

**Standard Photo Set (8 photos minimum)**:
1. Front view (screen on, home screen visible)
2. Front view (screen off)
3. Back view
4. Left side view
5. Right side view
6. Top view (showing ports)
7. Bottom view (showing ports)
8. Screen closeup (showing any scratches/damage)

**Additional Photos (if applicable)**:
- Any visible damage (scratches, dents, cracks)
- Screen defects (dead pixels, discoloration)
- Port damage (charging port, headphone jack)
- Camera lens condition
- IMEI label photo
- Serial number photo

```typescript
interface PhotoDocumentation {
  assessment_id: string;
  device_id: string;
  photos: {
    photo_id: string;
    photo_type: 'front_on' | 'front_off' | 'back' | 'left_side' | 'right_side' |
                'top' | 'bottom' | 'screen_closeup' | 'damage' | 'imei' | 'serial';
    s3_url: string;
    thumbnail_url: string;
    uploaded_at: Date;
    notes?: string;
  }[];
  photo_count: number;
  all_required_photos_present: boolean;
}

async function uploadAssessmentPhotos(
  assessmentId: string,
  photos: File[]
): Promise<PhotoDocumentation> {
  const uploadedPhotos = [];

  for (const photo of photos) {
    const photoId = uuidv4();
    const s3Key = `assessments/${assessmentId}/${photoId}.jpg`;

    // Upload to S3
    const s3Url = await uploadToS3(photo, s3Key);

    // Generate thumbnail
    const thumbnail = await generateThumbnail(photo, 300, 300);
    const thumbnailKey = `assessments/${assessmentId}/${photoId}_thumb.jpg`;
    const thumbnailUrl = await uploadToS3(thumbnail, thumbnailKey);

    uploadedPhotos.push({
      photo_id: photoId,
      photo_type: detectPhotoType(photo), // AI or manual classification
      s3_url: s3Url,
      thumbnail_url: thumbnailUrl,
      uploaded_at: new Date()
    });
  }

  return {
    assessment_id: assessmentId,
    device_id: await getDeviceIdFromAssessment(assessmentId),
    photos: uploadedPhotos,
    photo_count: uploadedPhotos.length,
    all_required_photos_present: uploadedPhotos.length >= 8
  };
}
```

---

## 7. Assessment Forms & User Interface

### 7.1 Mobile Assessment App (Field Agents)

Field agents use a mobile app for on-site assessments during device collection or customer visits:

```typescript
// React Native Assessment Form Component
interface AssessmentFormProps {
  deviceId: string;
  assessmentType: 'intake' | 'pre_handover' | 'return';
  onComplete: (assessment: DeviceAssessment) => void;
}

const AssessmentForm: React.FC<AssessmentFormProps> = ({
  deviceId,
  assessmentType,
  onComplete
}) => {
  const [physicalInspection, setPhysicalInspection] = useState<PhysicalInspection>();
  const [functionalTest, setFunctionalTest] = useState<FunctionalTest>();
  const [photos, setPhotos] = useState<File[]>([]);
  const [currentStep, setCurrentStep] = useState<'physical' | 'functional' | 'photos' | 'review'>('physical');

  return (
    <ScrollView>
      <ProgressBar step={currentStep} />

      {currentStep === 'physical' && (
        <PhysicalInspectionForm
          deviceId={deviceId}
          onComplete={(inspection) => {
            setPhysicalInspection(inspection);
            setCurrentStep('functional');
          }}
        />
      )}

      {currentStep === 'functional' && (
        <FunctionalTestForm
          deviceId={deviceId}
          onComplete={(test) => {
            setFunctionalTest(test);
            setCurrentStep('photos');
          }}
        />
      )}

      {currentStep === 'photos' && (
        <PhotoCaptureForm
          assessmentId={deviceId}
          requiredPhotos={8}
          onComplete={(uploadedPhotos) => {
            setPhotos(uploadedPhotos);
            setCurrentStep('review');
          }}
        />
      )}

      {currentStep === 'review' && (
        <AssessmentReview
          physical={physicalInspection}
          functional={functionalTest}
          photos={photos}
          onSubmit={() => {
            const assessment = createAssessment(
              deviceId,
              physicalInspection,
              functionalTest,
              photos
            );
            onComplete(assessment);
          }}
        />
      )}
    </ScrollView>
  );
};
```

### 7.2 Admin Dashboard Assessment View

Admin users can review all assessments and override grades if needed:

```typescript
// Assessment History View
interface AssessmentHistoryProps {
  deviceId: string;
}

const AssessmentHistory: React.FC<AssessmentHistoryProps> = ({ deviceId }) => {
  const { data: assessments } = useQuery(
    ['device-assessments', deviceId],
    () => getDeviceAssessments(deviceId)
  );

  return (
    <div className="assessment-history">
      <h2>Assessment History</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Grade</th>
            <th>Physical Score</th>
            <th>Functional Score</th>
            <th>Value</th>
            <th>Assessor</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assessments?.map(assessment => (
            <tr key={assessment.assessment_id}>
              <td>{formatDate(assessment.assessment_date)}</td>
              <td>{assessment.assessment_type}</td>
              <td>
                <GradeBadge grade={assessment.overall_grade} />
              </td>
              <td>{assessment.physical_score}/100</td>
              <td>{assessment.functional_score}/100</td>
              <td>${assessment.estimated_value_usd}</td>
              <td>{assessment.assessor_id}</td>
              <td>
                <button onClick={() => viewDetails(assessment)}>View</button>
                <button onClick={() => downloadReport(assessment)}>Download</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## 8. Database Schema

### 8.1 Device Assessments Table

```sql
CREATE TABLE device_assessments (
  assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id),
  assessment_type VARCHAR(20) NOT NULL CHECK (assessment_type IN ('intake', 'pre_handover', 'return')),
  assessment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Physical Inspection Data (JSONB for flexibility)
  physical_inspection JSONB NOT NULL,
  physical_score DECIMAL(5,2) NOT NULL CHECK (physical_score >= 0 AND physical_score <= 100),

  -- Functional Test Data (JSONB for flexibility)
  functional_test JSONB NOT NULL,
  functional_score DECIMAL(5,2) NOT NULL CHECK (functional_score >= 0 AND functional_score <= 100),

  -- Overall Assessment
  overall_score DECIMAL(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  overall_grade VARCHAR(1) NOT NULL CHECK (overall_grade IN ('A', 'B', 'C', 'D')),

  -- Financial Impact
  estimated_value_usd DECIMAL(10,2) NOT NULL,
  value_percentage DECIMAL(5,2) NOT NULL,
  loan_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  requires_repair BOOLEAN NOT NULL DEFAULT FALSE,
  repair_cost_estimate_usd DECIMAL(10,2),

  -- Documentation
  assessor_id UUID NOT NULL REFERENCES users(id),
  assessor_signature TEXT,
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_device_assessments_device_id ON device_assessments(device_id);
CREATE INDEX idx_device_assessments_type ON device_assessments(assessment_type);
CREATE INDEX idx_device_assessments_date ON device_assessments(assessment_date DESC);
CREATE INDEX idx_device_assessments_grade ON device_assessments(overall_grade);
```

### 8.2 Assessment Photos Table

```sql
CREATE TABLE assessment_photos (
  photo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES device_assessments(assessment_id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id),

  photo_type VARCHAR(20) NOT NULL CHECK (photo_type IN (
    'front_on', 'front_off', 'back', 'left_side', 'right_side',
    'top', 'bottom', 'screen_closeup', 'damage', 'imei', 'serial'
  )),

  s3_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assessment_photos_assessment_id ON assessment_photos(assessment_id);
CREATE INDEX idx_assessment_photos_device_id ON assessment_photos(device_id);
CREATE INDEX idx_assessment_photos_type ON assessment_photos(photo_type);
```

### 8.3 Device History Tracking

```sql
CREATE TABLE device_condition_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id),
  assessment_id UUID NOT NULL REFERENCES device_assessments(assessment_id),

  event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
    'initial_intake', 'pre_handover', 'returned', 'repossessed', 'refurbished', 'resold'
  )),
  event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  previous_grade VARCHAR(1),
  new_grade VARCHAR(1) NOT NULL CHECK (new_grade IN ('A', 'B', 'C', 'D')),

  previous_value_usd DECIMAL(10,2),
  new_value_usd DECIMAL(10,2) NOT NULL,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_device_history_device_id ON device_condition_history(device_id);
CREATE INDEX idx_device_history_event_date ON device_condition_history(event_date DESC);
```

---

## 9. Integration Points

### 9.1 Integration with Device Handover

Before device handover, perform pre-handover assessment:

```typescript
async function performPreHandoverAssessment(
  deviceId: string,
  loanId: string
): Promise<DeviceAssessment> {
  // Retrieve device from inventory
  const device = await getDevice(deviceId);

  // Perform assessment
  const assessment = await createAssessment({
    device_id: deviceId,
    assessment_type: 'pre_handover',
    physical_inspection: await conductPhysicalInspection(deviceId),
    functional_test: await conductFunctionalTest(deviceId),
  });

  // Check loan eligibility
  if (!assessment.loan_eligible) {
    throw new Error(
      `Device ${deviceId} is not eligible for loan. Grade: ${assessment.overall_grade}, ` +
      `Functional Score: ${assessment.functional_score}/100`
    );
  }

  // Update loan with assessment
  await supabase
    .from('loans')
    .update({
      device_assessment_id: assessment.assessment_id,
      device_condition_grade: assessment.overall_grade
    })
    .eq('id', loanId);

  return assessment;
}
```

### 9.2 Integration with Device Returns

When device is returned, assess condition to calculate refund:

```typescript
async function assessReturnedDevice(
  deviceId: string,
  returnId: string
): Promise<{ assessment: DeviceAssessment; damage_charges: number }> {
  const deviceReturn = await getDeviceReturn(returnId);
  const originalLoan = await getLoan(deviceReturn.loan_id);

  // Get original handover assessment
  const handoverAssessment = await getAssessment(originalLoan.device_assessment_id);

  // Perform return assessment
  const returnAssessment = await createAssessment({
    device_id: deviceId,
    assessment_type: 'return',
    physical_inspection: await conductPhysicalInspection(deviceId),
    functional_test: await conductFunctionalTest(deviceId),
  });

  // Calculate damage charges
  const damageCharges = calculateDamageCharges(
    handoverAssessment,
    returnAssessment
  );

  // Update device return record
  await supabase
    .from('device_returns')
    .update({
      return_assessment_id: returnAssessment.assessment_id,
      return_condition_grade: returnAssessment.overall_grade,
      damage_charges: damageCharges,
      damage_description: generateDamageReport(handoverAssessment, returnAssessment)
    })
    .eq('id', returnId);

  return { assessment: returnAssessment, damage_charges: damageCharges };
}

function calculateDamageCharges(
  handoverAssessment: DeviceAssessment,
  returnAssessment: DeviceAssessment
): number {
  const handoverValue = handoverAssessment.estimated_value_usd;
  const returnValue = returnAssessment.estimated_value_usd;

  // Charge customer for value decrease beyond normal wear
  const normalDepreciation = handoverValue * 0.10; // 10% normal wear
  const actualDepreciation = handoverValue - returnValue;

  if (actualDepreciation > normalDepreciation) {
    return actualDepreciation - normalDepreciation;
  }

  return 0; // No charges if within normal wear
}
```

### 9.3 Integration with Inventory Management

Update device status and pricing based on assessment:

```typescript
async function updateDeviceFromAssessment(
  assessment: DeviceAssessment
): Promise<void> {
  const device = await getDevice(assessment.device_id);

  // Update device condition and pricing
  await supabase
    .from('devices')
    .update({
      current_grade: assessment.overall_grade,
      current_value_usd: assessment.estimated_value_usd,
      loan_eligible: assessment.loan_eligible,
      requires_refurbishment: assessment.requires_repair,
      last_assessment_date: assessment.assessment_date,
      last_assessment_id: assessment.assessment_id
    })
    .eq('id', assessment.device_id);

  // If device requires repair, mark as unavailable
  if (assessment.requires_repair) {
    await supabase
      .from('devices')
      .update({
        status: 'needs_repair',
        available_stock: 0
      })
      .eq('id', assessment.device_id);
  }

  // Log condition change
  await supabase
    .from('device_condition_history')
    .insert({
      device_id: assessment.device_id,
      assessment_id: assessment.assessment_id,
      event_type: assessment.assessment_type,
      new_grade: assessment.overall_grade,
      new_value_usd: assessment.estimated_value_usd,
      notes: assessment.notes
    });
}
```

---

## 10. Quality Control & Auditing

### 10.1 Assessment Review Process

All assessments undergo random quality audits:

```typescript
interface AssessmentAudit {
  audit_id: string;
  assessment_id: string;
  auditor_id: string;
  audit_date: Date;

  agrees_with_assessment: boolean;
  suggested_grade?: 'A' | 'B' | 'C' | 'D';
  grade_difference?: number; // If disagreement

  audit_notes: string;
  corrective_action_required: boolean;
  corrective_action_taken?: string;
}

async function auditAssessment(
  assessmentId: string,
  auditorId: string
): Promise<AssessmentAudit> {
  const assessment = await getAssessment(assessmentId);

  // Auditor performs independent assessment
  const auditResult = await performIndependentAssessment(assessment.device_id);

  const agreesWith = auditResult.overall_grade === assessment.overall_grade;
  const gradeDifference = Math.abs(
    gradeToNumber(auditResult.overall_grade) -
    gradeToNumber(assessment.overall_grade)
  );

  const audit: AssessmentAudit = {
    audit_id: uuidv4(),
    assessment_id: assessmentId,
    auditor_id: auditorId,
    audit_date: new Date(),
    agrees_with_assessment: agreesWith,
    suggested_grade: agreesWith ? undefined : auditResult.overall_grade,
    grade_difference: agreesWith ? undefined : gradeDifference,
    audit_notes: '',
    corrective_action_required: gradeDifference >= 2 // 2+ grades difference
  };

  // If significant disagreement, flag for review
  if (audit.corrective_action_required) {
    await notifySupervisor(assessment, audit);
  }

  return audit;
}

function gradeToNumber(grade: string): number {
  const mapping: { [key: string]: number } = { 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
  return mapping[grade] || 0;
}
```

### 10.2 Assessor Performance Tracking

Track assessor accuracy and consistency:

```typescript
interface AssessorMetrics {
  assessor_id: string;
  period_start: Date;
  period_end: Date;

  total_assessments: number;
  assessments_audited: number;
  audit_agreement_rate: number; // % of audits that agreed

  avg_physical_score: number;
  avg_functional_score: number;
  avg_overall_score: number;

  grade_distribution: {
    A: number;
    B: number;
    C: number;
    D: number;
  };

  avg_assessment_time_minutes: number;
  photo_quality_score: number; // 0-100 based on photo completeness/clarity
}

async function calculateAssessorMetrics(
  assessorId: string,
  startDate: Date,
  endDate: Date
): Promise<AssessorMetrics> {
  const assessments = await getAssessmentsByAssessor(assessorId, startDate, endDate);
  const audits = await getAuditsForAssessments(assessments.map(a => a.assessment_id));

  return {
    assessor_id: assessorId,
    period_start: startDate,
    period_end: endDate,
    total_assessments: assessments.length,
    assessments_audited: audits.length,
    audit_agreement_rate: audits.filter(a => a.agrees_with_assessment).length / audits.length,
    avg_physical_score: average(assessments.map(a => a.physical_score)),
    avg_functional_score: average(assessments.map(a => a.functional_score)),
    avg_overall_score: average(assessments.map(a => a.overall_score)),
    grade_distribution: calculateGradeDistribution(assessments),
    avg_assessment_time_minutes: calculateAvgAssessmentTime(assessments),
    photo_quality_score: calculatePhotoQualityScore(assessments)
  };
}
```

---

## 11. Reporting & Analytics

### 11.1 Device Condition Reports

```typescript
interface DeviceConditionReport {
  report_date: Date;
  total_devices: number;

  grade_breakdown: {
    grade: string;
    count: number;
    percentage: number;
    total_value_usd: number;
  }[];

  avg_device_age_months: number;
  avg_condition_score: number;

  devices_requiring_repair: number;
  estimated_repair_costs_usd: number;

  loan_eligible_devices: number;
  total_loanable_value_usd: number;
}

async function generateDeviceConditionReport(): Promise<DeviceConditionReport> {
  const { data: devices } = await supabase
    .from('devices')
    .select('*, device_assessments(*)')
    .order('last_assessment_date', { ascending: false });

  const gradeBreakdown = ['A', 'B', 'C', 'D'].map(grade => {
    const devicesInGrade = devices.filter(d => d.current_grade === grade);
    return {
      grade,
      count: devicesInGrade.length,
      percentage: (devicesInGrade.length / devices.length) * 100,
      total_value_usd: devicesInGrade.reduce((sum, d) => sum + d.current_value_usd, 0)
    };
  });

  return {
    report_date: new Date(),
    total_devices: devices.length,
    grade_breakdown: gradeBreakdown,
    avg_device_age_months: calculateAvgAge(devices),
    avg_condition_score: average(devices.map(d => d.device_assessments[0]?.overall_score || 0)),
    devices_requiring_repair: devices.filter(d => d.requires_refurbishment).length,
    estimated_repair_costs_usd: devices
      .filter(d => d.requires_refurbishment)
      .reduce((sum, d) => sum + (d.repair_cost_estimate || 0), 0),
    loan_eligible_devices: devices.filter(d => d.loan_eligible).length,
    total_loanable_value_usd: devices
      .filter(d => d.loan_eligible)
      .reduce((sum, d) => sum + d.current_value_usd, 0)
  };
}
```

---

## 12. Summary

This device condition assessment specification provides a comprehensive framework for evaluating device condition at all stages of the device lifecycle. Key features include:

**Standardized Grading**: 4-tier system (A/B/C/D) with clear criteria and objective scoring
**Comprehensive Inspections**: Physical and functional assessments with weighted scoring
**Photo Documentation**: Required photo sets for all assessments with cloud storage
**Financial Integration**: Automated value estimation and damage charge calculation
**Quality Control**: Random audits and assessor performance tracking
**Mobile-First**: React Native assessment app for field agents
**Integration Ready**: Seamless integration with handover, returns, and inventory systems

**Implementation Priority**: Low (can use simpler manual assessments initially)
**Implementation Complexity**: Medium (requires mobile app and photo infrastructure)
**Business Impact**: High (protects against fraud, ensures quality, enables accurate pricing)

**Related Tasks**:
- P1-T032: Device Catalog Design
- P1-T033: Device Lock/Unlock Integration
- P1-T034: Device Handover Process
- P1-T035: Device Return/Repossession Flow

**Next Steps**:
1. Develop mobile assessment app for field agents
2. Set up AWS S3 infrastructure for photo storage
3. Create admin dashboard for assessment review
4. Implement automated audit selection algorithm
5. Train field agents on assessment procedures
