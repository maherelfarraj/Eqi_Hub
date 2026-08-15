export type Role = "rider" | "trainer" | "owner" | "admin";
export type LessonStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type LessonType = "Flatwork" | "Jumping" | "Dressage" | "Groundwork";
export type Discipline = "Flatwork" | "Show jumping" | "Dressage";
export type AnalysisStatus = "uploaded" | "processing" | "analyzed" | "failed";
export type HorseStatus = "active" | "resting" | "retired";
export type MembershipStatus = "trialing" | "active" | "past_due" | "cancelled";
export type InvoiceStatus = "paid" | "open" | "overdue" | "void";
export type CompetencyStage =
  "introduced" | "practising" | "demonstrated" | "achieved";

// ---- Dashboard ----
export interface UpcomingLesson {
  id: string;
  dateTime: string;
  trainerName: string;
  horseName: string | null;
  discipline: LessonType;
  status: LessonStatus;
}
export interface ActiveMembership {
  planName: string;
  status: MembershipStatus;
  renewsAt: string | null;
  lessonsUsed: number;
  lessonsAllowed: number;
  analysesUsed: number;
  analysesAllowed: number;
}
export interface RecentAnalysis {
  id: string;
  title: string;
  horseName: string | null;
  score: number | null;
  status: AnalysisStatus;
  createdAt: string;
}
export interface ProgressTrendPoint {
  date: string;
  score: number;
}
export interface DashboardSummary {
  user: { name: string; role: Role };
  upcomingLessons: UpcomingLesson[];
  activeMembership: ActiveMembership | null;
  recentAnalyses: RecentAnalysis[];
  outstandingBalance: {
    amount: number;
    currency: string;
    invoiceCount: number;
  };
  horsesCount: number;
  progressTrend: ProgressTrendPoint[];
}

// ---- Progress ----
export interface CategoryScore {
  category: string;
  score: number;
}
export interface ProgressMetrics {
  averageScore: number;
  improvementPct: number;
  sessionsCount: number;
  topDiscipline: string | null;
  scoreOverTime: ProgressTrendPoint[];
  categoryScores: CategoryScore[];
}
export interface SessionRow {
  id: string;
  date: string;
  horseName: string | null;
  discipline: Discipline;
  score: number | null;
  status: AnalysisStatus;
}

export interface RiderSyncSnapshot {
  id: string;
  organizationId: string;
  riderId: string;
  safetyWelfareScore: number;
  rhythmControlScore: number;
  balancePositionScore: number;
  partnershipScore: number;
  trainingConsistencyScore: number;
  reflectionFeedbackScore: number;
  overallScore: number;
  evidenceCount: number;
  calculatedAt: string;
}
export interface RiderJourneyTitle {
  code: string;
  ordinal: number;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  minScore: number;
  unlockedAt: string | null;
}
export interface RiderBadgeAward {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  tier: "ivory" | "bronze" | "silver" | "gold" | "burgundy";
  iconName: string;
  awardMessage: string | null;
  approvedAt: string;
}
export interface RiderBadgeDefinition {
  code: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  tier: RiderBadgeAward["tier"];
}
export interface RiderSyncCompetency {
  code: string;
  name: string;
  category: string;
  stage: "not_started" | CompetencyStage;
  evidenceCount: number;
  lastEvidenceAt: string | null;
}
export interface RiderSyncLatestReport {
  id: string;
  summary: string;
  strengths: string[];
  focusAreas: string[];
  homework: string | null;
  nextFocus: string;
  approvedAt: string;
}
export interface RiderSyncDashboard {
  snapshot: RiderSyncSnapshot | null;
  titles: RiderJourneyTitle[];
  badges: RiderBadgeAward[];
  competencies: RiderSyncCompetency[];
  latestReport: RiderSyncLatestReport | null;
}

export type GuardianRelationshipStatus =
  "pending" | "verified" | "review_required" | "revoked";
export type GuardianApprovalType =
  "purchase" | "horse_registration" | "video_ai_consent" | "supervised_jumping";
export interface GuardianRelationshipSummary {
  organizationId: string;
  guardianId: string;
  riderId: string;
  riderName: string;
  relationshipType:
    "parent" | "legal_guardian" | "court_guardian" | "supporter";
  verificationStatus: GuardianRelationshipStatus;
  active: boolean;
  adulthoodReviewOn: string | null;
  accessExpiresAt: string | null;
}
export interface GuardianApprovalRequest {
  id: string;
  approvalType: GuardianApprovalType;
  subjectType: string;
  summary: string;
  status: "pending" | "approved" | "declined" | "withdrawn" | "expired";
  requestedAt: string;
  expiresAt: string | null;
  respondedAt: string | null;
  responseNote: string | null;
}
export interface GuardianPortal {
  relationship: {
    relationshipType: GuardianRelationshipSummary["relationshipType"];
    legalAuthority: boolean;
    verificationStatus: GuardianRelationshipStatus;
    adulthoodReviewOn: string | null;
    accessExpiresAt: string | null;
    permissions: {
      viewFinancials: boolean;
      approvePurchases: boolean;
      approveHorseRegistration: boolean;
      approveVideoAi: boolean;
      approveSupervisedJumping: boolean;
    };
  };
  rider: { id: string; name: string | null };
  riderSync: RiderSyncDashboard;
  lessons: Array<{
    id: string;
    dateTime: string;
    durationMin: number;
    type: LessonType;
    status: LessonStatus;
  }>;
  attendance: { completed: number; scheduled: number };
  horses: Array<{ id: string; name: string; status: HorseStatus }>;
  invoices: Array<{
    id: string;
    number: string;
    issueDate: string;
    dueDate: string | null;
    status: InvoiceStatus;
    currency: string;
    totalCents: number;
  }>;
  approvals: GuardianApprovalRequest[];
  accessHistory: Array<{
    id: string;
    eventType: string;
    occurredAt: string;
  }>;
}

export type ComplianceDocumentType =
  "medical_safety" | "liability_waiver" | "emergency_consent";
export interface ComplianceDocumentStatus {
  templateId: string;
  submissionId: string | null;
  documentType: ComplianceDocumentType;
  version: number;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  contentHash: string;
  consentTextEn: string;
  consentTextAr: string;
  consentHash: string;
  validDays: number;
  status: "missing" | "signed" | "expired" | "superseded" | "rejected";
  medicalReviewStatus:
    "not_required" | "review_required" | "approved" | "rejected" | null;
  validUntil: string | null;
  minorAtSigning: boolean | null;
  signedAt: string | null;
  signerCapacity: "adult_rider" | "legal_guardian" | null;
  receiptKey: string | null;
}
export interface RiderCompliancePortal {
  riderId: string;
  dateOfBirth: string | null;
  lessonReady: boolean;
  renewalReady: boolean;
  documents: ComplianceDocumentStatus[];
}
export interface ComplianceRiderSummary {
  riderId: string;
  riderName: string;
  lessonReady: boolean;
  renewalReady: boolean;
}
export interface ComplianceAdminSummary {
  riders: ComplianceRiderSummary[];
  medicalReviewRequired: number;
}

// ---- Analysis ----
export interface VideoAnalysisListItem {
  id: string;
  title: string;
  horseName: string | null;
  discipline: Discipline;
  status: AnalysisStatus;
  score: number | null;
  createdAt: string;
  thumbnailUrl: string | null;
}
export interface Metric {
  category: string;
  score: number;
}
export interface AIFeedback {
  strengths: string[];
  improvements: string[];
}
export interface TrainerComment {
  author: string;
  text: string;
  created_at: string;
}
export interface VideoAnalysisDetail extends VideoAnalysisListItem {
  videoUrl: string | null;
  metrics: Metric[];
  aiFeedback: AIFeedback;
  trainerComment: TrainerComment | null;
}
export interface UploadVideoInput {
  file: File;
  title: string;
  horseId: string | null;
  discipline: Discipline;
  sessionDate: string;
}

// ---- Lessons ----
export interface Lesson {
  id: string;
  riderId: string;
  riderName: string;
  dateTime: string;
  durationMin: number;
  trainerName: string;
  trainerAvatar: string | null;
  horseName: string | null;
  type: LessonType;
  status: LessonStatus;
  notes: string | null;
  feedback: { text: string; homework: string | null } | null;
  analysisId: string | null;
  developmentReport: LessonDevelopmentReport | null;
}
export interface CompetencyDefinition {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
}
export interface CompetencyEvidence {
  competencyId: string;
  competencyName: string;
  stage: CompetencyStage;
  note: string | null;
}
export interface RiderReflection {
  id: string;
  reflection: string | null;
  question: string | null;
  visibleToGuardian: boolean;
  acknowledgedAt: string;
}
export interface LessonDevelopmentReport {
  id: string;
  status: "draft" | "approved";
  objectives: string[];
  summary: string;
  strengths: string[];
  focusAreas: string[];
  horseObservations: string | null;
  interactionObservations: string | null;
  homework: string | null;
  homeworkDueAt: string | null;
  nextFocus: string;
  effortScore: number | null;
  riderConfidenceScore: number | null;
  lessonDifficultyScore: number | null;
  approvedAt: string | null;
  competencies: CompetencyEvidence[];
  reflection: RiderReflection | null;
}
export interface LessonCompetencyInput {
  competencyId: string;
  stage: CompetencyStage;
  evidenceNote?: string;
}
export interface LessonDevelopmentInput {
  lessonId: string;
  objectives: string[];
  summary: string;
  strengths: string[];
  focusAreas: string[];
  horseObservations?: string;
  interactionObservations?: string;
  homework?: string;
  homeworkDueAt?: string;
  nextFocus: string;
  effortScore: number;
  riderConfidenceScore?: number;
  lessonDifficultyScore?: number;
  competencies: LessonCompetencyInput[];
  privateNote?: string;
}
export interface Trainer {
  id: string;
  name: string;
  avatarUrl: string | null;
}
export interface BookLessonInput {
  trainerId: string;
  horseId: string | null;
  type: LessonType;
  dateTime: string;
  durationMin: 30 | 45 | 60;
  notes?: string;
}

// ---- Horses ----
export interface Horse {
  id: string;
  name: string;
  breed: string | null;
  birthYear: number | null;
  color: string | null;
  heightCm: number | null;
  photoUrl: string | null;
  status: HorseStatus;
  riderNames: string[];
}
export interface TrainingLogEntry {
  id: string;
  date: string;
  note: string;
  author: string;
}
export interface HealthRecord {
  id: string;
  date: string;
  type: string;
  summary: string | null;
}
export interface DocumentItem {
  id: string;
  name: string;
  url: string;
}
export interface HorseDetail extends Horse {
  trainingLog: TrainingLogEntry[];
  healthRecords: HealthRecord[];
  documents: DocumentItem[];
  analyses: VideoAnalysisListItem[];
}
export interface UpsertHorseInput {
  id?: string;
  name: string;
  breed?: string;
  birthYear?: number;
  color?: string;
  heightCm?: number;
  status?: HorseStatus;
  photo?: File | null;
}

// ---- Membership ----
export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  features: string[];
  lessonsPerMonth: number;
  analysesPerMonth: number;
  highlighted: boolean;
}
export type CurrentMembership = ActiveMembership;

// ---- Payments ----
export interface PaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}
export interface CheckoutInfo {
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: "month" | "year";
  };
  appliedPromo: { code: string; discountPct: number } | null;
}
export interface NewPaymentMethodInput {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  providerToken: string; // token from Stripe/etc — never raw card data
}

// ---- Billing ----
export interface InvoiceLine {
  id: string;
  label: string;
  qty: number;
  unitPrice: number;
  total: number;
}
export interface Invoice {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string | null;
  description: string | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  pdfUrl: string | null;
}
export interface InvoiceDetail extends Invoice {
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethodLast4: string | null;
}

// ---- Profile ----
export interface Profile {
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  discipline: string | null;
  skillLevel: string | null;
  goals: string | null;
  locale: string;
  joinedAt: string;
}
export interface NotificationPrefs {
  lessonReminders: boolean;
  analysisReady: boolean;
  paymentReceipts: boolean;
  marketing: boolean;
  channel: "email" | "push" | "both";
}

// ---- Shared hook state ----
export interface QueryState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}
