// User profile for job seekers
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  image?: string;
  
  // Job seeker specific
  currentStatus: 'student' | 'recent_grad' | 'employed' | 'unemployed';
  targetRoles: string[];
  experienceLevel: 'intern' | 'entry' | 'mid' | 'senior';
  preferredLocations: string[];
  companyStagePreference: string[];
  
  // Skills
  skills: string[];
  techStack: string[];
  
  // Links
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  resumeUrl?: string;
  
  // Preferences
  preferredTone: 'professional' | 'casual' | 'enthusiastic';
  autoFollowUp: boolean;
  followUpDays: number[];
  
  // Gmail
  gmailConnected: boolean;
  connectedEmail?: string;
  
  createdAt: string;
}

// User's projects for AI reference
export interface UserProject {
  id: string;
  userId: string;
  name: string;
  description: string;
  techStack: string[];
  url?: string;
  githubUrl?: string;
  highlights: string[];
}

// News item for company
export interface NewsItem {
  title: string;
  source: string;
  date: string;
  url?: string;
}

// Job posting at a company
export interface JobPosting {
  id: string;
  companyId: string;
  title: string;
  location: string;
  type: 'full-time' | 'part-time' | 'intern' | 'contract';
  url?: string;
  postedDate?: string;
  matchScore?: number;
}

// Contact at a company
export interface Contact {
  id: string;
  companyId: string;
  name: string;
  role: string;
  email?: string;
  linkedinUrl?: string;
  emailConfidence: number; // 0-100
  isDecisionMaker: boolean;
  whyContact: string;
}

// Company from discovery
export interface Company {
  id: string;
  name: string;
  website: string;
  logo?: string;
  description: string;
  
  // Funding
  fundingStage: string;
  fundingAmount?: string;
  fundingDate?: string;
  investors?: string[];
  
  // Details
  techStack: string[];
  teamSize: number;
  location: string;
  isRemote: boolean;
  founded?: string;
  
  // Intel
  recentNews?: NewsItem[];
  glassdoorRating?: number;
  cultureNotes?: string[];
  
  // Jobs
  openPositions: JobPosting[];
  contacts: Contact[];
  
  // Computed
  isHiring?: boolean;
}

// Spam issue in email
export interface SpamIssue {
  word: string;
  reason: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

// Application email
export interface ApplicationEmail {
  id: string;
  applicationId: string;
  type: 'initial' | 'followup1' | 'followup2' | 'followup3' | 'custom';
  subject: string;
  body: string;
  
  // Scores
  spamScore: number;
  qualityScore: number;
  warmthScore: number;
  
  // Spam analysis
  spamIssues: SpamIssue[];
  
  // Status
  status: 'draft' | 'scheduled' | 'sent';
  scheduledAt?: string;
  sentAt?: string;
}

// Phase-1 compose helpers (legacy UI components)
export interface Lead {
  name: string;
  email: string;
  companyName?: string;
  role?: string;
  personalTouch?: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  spamScore: number;
  qualityScore: number;
  status: 'draft' | 'scheduled' | 'sent';
}

// Application status
export type ApplicationStatus = 'researching' | 'ready' | 'sent' | 'response' | 'interview' | 'offer' | 'rejected';

// Application tracking
export interface Application {
  id: string;
  userId: string;
  companyId: string;
  contactId: string;
  role: string;
  status: ApplicationStatus;
  
  // Emails
  emails: ApplicationEmail[];
  
  // Timeline
  createdAt: string;
  sentAt?: string;
  responseAt?: string;
  interviewAt?: string;
  
  // Follow-up
  nextFollowUpAt?: string;
  followUpCount: number;
  
  // Notes
  notes?: string;
  
  // Company snapshot (cached)
  company: Company;
  contact: Contact;
}

// Dashboard stats
export interface JobHuntStats {
  applicationsSent: number;
  applicationsThisWeek: number;
  responseRate: number;
  responseTrend: number;
  interviewsScheduled: number;
  pendingFollowUps: number;
}

// Activity types
export type ActivityType = 'email_sent' | 'response_received' | 'interview_scheduled' | 'followup_scheduled' | 'application_created' | 'offer_received';

// Activity feed item
export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  companyName: string;
  timestamp: string;
  isHighlighted: boolean;
}

// Filter options for discover
export interface DiscoverFilters {
  role: string;
  location: string;
  stages: string[];
  techStack: string[];
}

// Pipeline counts for mini kanban
export interface PipelineCounts {
  researching: number;
  ready: number;
  sent: number;
  response: number;
  interview: number;
  offer: number;
}

// Navigation item
export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

// Onboarding step
export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
}

// Email tone options
export type EmailTone = 'professional' | 'casual' | 'enthusiastic';

// Experience level options
export type ExperienceLevel = 'intern' | 'entry' | 'mid' | 'senior';

// Current status options
export type CurrentStatus = 'student' | 'recent_grad' | 'employed' | 'unemployed';

// ============================================
// Campaign Types (New Flow)
// ============================================

// Contact from CSV upload
export interface CampaignContact {
  id: string;
  name: string;
  email: string;
  company?: string;
  role?: string;
  emailStatus: 'pending' | 'draft' | 'done';
  emailSubject?: string;
  emailBody?: string;
}

// Campaign status
export type CampaignStatus = 'draft' | 'composing' | 'ready' | 'sending' | 'sent';

// Campaign
export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  contacts: CampaignContact[];
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

// Campaign step for wizard
export type CampaignStep = 1 | 2 | 3;
