import {
  UserProfile,
  UserProject,
  Company,
  Contact,
  Application,
  ApplicationEmail,
  JobHuntStats,
  Activity,
  PipelineCounts,
} from '@/types';

// User Profile
export const mockUserProfile: UserProfile = {
  id: '1',
  email: 'alex.chen@gmail.com',
  name: 'Alex Chen',
  image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
  currentStatus: 'recent_grad',
  targetRoles: ['Frontend Developer', 'Full Stack Developer', 'React Developer'],
  experienceLevel: 'entry',
  preferredLocations: ['Remote', 'San Francisco', 'New York'],
  companyStagePreference: ['Seed', 'Series A', 'Series B'],
  skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'Git', 'REST APIs'],
  techStack: ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind CSS'],
  linkedinUrl: 'https://linkedin.com/in/alexchen',
  githubUrl: 'https://github.com/alexchen',
  portfolioUrl: 'https://alexchen.dev',
  preferredTone: 'professional',
  autoFollowUp: true,
  followUpDays: [4, 8, 14],
  gmailConnected: true,
  connectedEmail: 'alex.chen@gmail.com',
  createdAt: '2024-01-01T00:00:00Z',
};

// User Projects
export const mockUserProjects: UserProject[] = [
  {
    id: '1',
    userId: '1',
    name: 'E-commerce Dashboard',
    description: 'Built a real-time analytics dashboard for e-commerce businesses with live sales tracking, inventory management, and customer insights.',
    techStack: ['React', 'TypeScript', 'Chart.js', 'Node.js', 'PostgreSQL'],
    url: 'https://ecommerce-dash.vercel.app',
    githubUrl: 'https://github.com/alexchen/ecommerce-dashboard',
    highlights: [
      'Reduced page load time by 40% using code splitting',
      'Implemented real-time WebSocket updates for live data',
      '500+ daily active users',
    ],
  },
  {
    id: '2',
    userId: '1',
    name: 'AI Chat Application',
    description: 'A ChatGPT-style AI assistant with conversation history, multiple AI models, and voice input support.',
    techStack: ['Next.js', 'OpenAI API', 'Prisma', 'Tailwind CSS'],
    githubUrl: 'https://github.com/alexchen/ai-chat',
    highlights: [
      'Integrated 3 different AI models (GPT-4, Claude, Llama)',
      'Built custom streaming response handler',
      'Featured on Hacker News front page',
    ],
  },
];

// Companies
export const mockCompanies: Company[] = [
  {
    id: '1',
    name: 'TechFlow',
    website: 'https://techflow.io',
    logo: '/logos/techflow.svg',
    description: 'AI-powered analytics platform helping businesses make data-driven decisions in real-time.',
    fundingStage: 'Series A',
    fundingAmount: '$4.2M',
    fundingDate: 'January 2024',
    investors: ['Sequoia Capital', 'Y Combinator'],
    techStack: ['React', 'Node.js', 'PostgreSQL', 'AWS', 'Python'],
    teamSize: 25,
    location: 'San Francisco, CA',
    isRemote: true,
    founded: '2022',
    recentNews: [
      { title: 'TechFlow launches AI analytics v2.0', source: 'TechCrunch', date: '3 days ago' },
      { title: 'TechFlow raises $4.2M Series A', source: 'Forbes', date: '2 weeks ago' },
    ],
    glassdoorRating: 4.5,
    cultureNotes: ['Remote-first culture', 'Async communication', 'Strong engineering focus'],
    openPositions: [
      { id: '1', companyId: '1', title: 'Frontend Developer', location: 'Remote', type: 'full-time', matchScore: 92 },
      { id: '2', companyId: '1', title: 'Full Stack Engineer', location: 'Remote', type: 'full-time', matchScore: 85 },
    ],
    contacts: [],
    isHiring: true,
  },
  {
    id: '2',
    name: 'StartupX',
    website: 'https://startupx.com',
    description: 'Developer tools platform making code reviews 10x faster with AI assistance.',
    fundingStage: 'Seed',
    fundingAmount: '$1.5M',
    fundingDate: 'November 2023',
    investors: ['Andreessen Horowitz'],
    techStack: ['React', 'TypeScript', 'Go', 'Kubernetes'],
    teamSize: 12,
    location: 'New York, NY',
    isRemote: true,
    founded: '2023',
    recentNews: [
      { title: 'StartupX launches AI code review beta', source: 'Product Hunt', date: '1 week ago' },
    ],
    glassdoorRating: 4.8,
    cultureNotes: ['Small team, big impact', 'Move fast culture', 'Weekly demos'],
    openPositions: [
      { id: '3', companyId: '2', title: 'React Developer', location: 'Remote', type: 'full-time', matchScore: 95 },
    ],
    contacts: [],
    isHiring: true,
  },
  {
    id: '3',
    name: 'CloudBase',
    website: 'https://cloudbase.dev',
    description: 'Next-generation database platform with built-in AI querying capabilities.',
    fundingStage: 'Series B',
    fundingAmount: '$18M',
    fundingDate: 'December 2023',
    investors: ['Accel', 'Index Ventures'],
    techStack: ['Rust', 'React', 'PostgreSQL', 'Redis'],
    teamSize: 45,
    location: 'Austin, TX',
    isRemote: true,
    founded: '2021',
    recentNews: [
      { title: 'CloudBase hits 10,000 customers', source: 'Business Insider', date: '5 days ago' },
    ],
    glassdoorRating: 4.3,
    cultureNotes: ['Engineering excellence', 'Open source contributors', 'Flexible hours'],
    openPositions: [
      { id: '4', companyId: '3', title: 'Frontend Engineer', location: 'Remote', type: 'full-time', matchScore: 78 },
      { id: '5', companyId: '3', title: 'Developer Advocate', location: 'Austin, TX', type: 'full-time', matchScore: 65 },
    ],
    contacts: [],
    isHiring: true,
  },
  {
    id: '4',
    name: 'AICompany',
    website: 'https://aicompany.ai',
    description: 'Building the future of AI-powered customer support automation.',
    fundingStage: 'Series A',
    fundingAmount: '$8M',
    fundingDate: 'February 2024',
    investors: ['OpenAI Fund', 'First Round'],
    techStack: ['Python', 'React', 'FastAPI', 'LangChain', 'OpenAI'],
    teamSize: 30,
    location: 'San Francisco, CA',
    isRemote: false,
    founded: '2022',
    recentNews: [
      { title: 'AICompany partners with Zendesk', source: 'TechCrunch', date: '1 day ago' },
    ],
    glassdoorRating: 4.6,
    cultureNotes: ['AI-first company', 'Research encouraged', 'In-office collaboration'],
    openPositions: [
      { id: '6', companyId: '4', title: 'Full Stack Developer', location: 'San Francisco', type: 'full-time', matchScore: 82 },
    ],
    contacts: [],
    isHiring: true,
  },
  {
    id: '5',
    name: 'DevTools Inc',
    website: 'https://devtools.io',
    description: 'Open-source tools that make developers more productive.',
    fundingStage: 'Seed',
    fundingAmount: '$2.5M',
    fundingDate: 'October 2023',
    techStack: ['TypeScript', 'Rust', 'React', 'Electron'],
    teamSize: 8,
    location: 'Remote',
    isRemote: true,
    founded: '2023',
    recentNews: [
      { title: 'DevTools launches VS Code extension', source: 'Dev.to', date: '2 weeks ago' },
    ],
    glassdoorRating: 4.9,
    cultureNotes: ['Open source everything', 'Developer happiness first', 'Global team'],
    openPositions: [
      { id: '7', companyId: '5', title: 'TypeScript Developer', location: 'Remote', type: 'full-time', matchScore: 90 },
    ],
    contacts: [],
    isHiring: true,
  },
  {
    id: '6',
    name: 'FinanceFlow',
    website: 'https://financeflow.com',
    description: 'Modern banking infrastructure for fintech startups.',
    fundingStage: 'Series A',
    fundingAmount: '$12M',
    fundingDate: 'January 2024',
    techStack: ['Java', 'React', 'Kafka', 'PostgreSQL'],
    teamSize: 35,
    location: 'New York, NY',
    isRemote: false,
    founded: '2021',
    glassdoorRating: 4.2,
    openPositions: [
      { id: '8', companyId: '6', title: 'React Developer', location: 'New York', type: 'full-time', matchScore: 75 },
    ],
    contacts: [],
    isHiring: true,
  },
  {
    id: '7',
    name: 'HealthTech Pro',
    website: 'https://healthtechpro.com',
    description: 'HIPAA-compliant telehealth platform for healthcare providers.',
    fundingStage: 'Series B',
    fundingAmount: '$25M',
    fundingDate: 'March 2024',
    techStack: ['React', 'Node.js', 'MongoDB', 'AWS'],
    teamSize: 60,
    location: 'Boston, MA',
    isRemote: true,
    founded: '2020',
    glassdoorRating: 4.1,
    openPositions: [
      { id: '9', companyId: '7', title: 'Senior Frontend Engineer', location: 'Remote', type: 'full-time', matchScore: 70 },
    ],
    contacts: [],
    isHiring: true,
  },
  {
    id: '8',
    name: 'EduLearn',
    website: 'https://edulearn.io',
    description: 'AI-powered personalized learning platform for students.',
    fundingStage: 'Seed',
    fundingAmount: '$3M',
    fundingDate: 'December 2023',
    techStack: ['Next.js', 'Python', 'TensorFlow', 'PostgreSQL'],
    teamSize: 15,
    location: 'Remote',
    isRemote: true,
    founded: '2023',
    glassdoorRating: 4.7,
    openPositions: [
      { id: '10', companyId: '8', title: 'Frontend Developer', location: 'Remote', type: 'full-time', matchScore: 88 },
    ],
    contacts: [],
    isHiring: true,
  },
  {
    id: '9',
    name: 'CryptoVault',
    website: 'https://cryptovault.finance',
    description: 'Institutional-grade cryptocurrency custody solution.',
    fundingStage: 'Series A',
    fundingAmount: '$15M',
    fundingDate: 'November 2023',
    techStack: ['Rust', 'React', 'Solidity', 'Go'],
    teamSize: 40,
    location: 'Miami, FL',
    isRemote: true,
    founded: '2022',
    glassdoorRating: 4.4,
    openPositions: [
      { id: '11', companyId: '9', title: 'Web3 Frontend Developer', location: 'Remote', type: 'full-time', matchScore: 60 },
    ],
    contacts: [],
    isHiring: true,
  },
  {
    id: '10',
    name: 'LogiFlow',
    website: 'https://logiflow.com',
    description: 'Supply chain optimization platform using machine learning.',
    fundingStage: 'Series A',
    fundingAmount: '$7M',
    fundingDate: 'February 2024',
    techStack: ['Python', 'React', 'TensorFlow', 'Docker'],
    teamSize: 28,
    location: 'Chicago, IL',
    isRemote: true,
    founded: '2022',
    glassdoorRating: 4.3,
    openPositions: [
      { id: '12', companyId: '10', title: 'Full Stack Engineer', location: 'Remote', type: 'full-time', matchScore: 80 },
    ],
    contacts: [],
    isHiring: true,
  },
];

// Contacts
export const mockContacts: Contact[] = [
  // TechFlow contacts
  {
    id: '1',
    companyId: '1',
    name: 'Priya Sharma',
    role: 'CTO',
    email: 'priya@techflow.io',
    linkedinUrl: 'https://linkedin.com/in/priyasharma',
    emailConfidence: 95,
    isDecisionMaker: true,
    whyContact: 'Decision maker for all engineering hires. Previously engineering lead at Stripe.',
  },
  {
    id: '2',
    companyId: '1',
    name: 'Rahul Verma',
    role: 'Engineering Manager',
    email: 'rahul.v@techflow.io',
    linkedinUrl: 'https://linkedin.com/in/rahulverma',
    emailConfidence: 85,
    isDecisionMaker: true,
    whyContact: 'Manages the frontend team. Good first contact for developer roles.',
  },
  // StartupX contacts
  {
    id: '3',
    companyId: '2',
    name: 'James Wilson',
    role: 'Founder & CEO',
    email: 'james@startupx.com',
    linkedinUrl: 'https://linkedin.com/in/jameswilson',
    emailConfidence: 98,
    isDecisionMaker: true,
    whyContact: 'Small team - founder reviews all engineering candidates directly.',
  },
  {
    id: '4',
    companyId: '2',
    name: 'Sarah Kim',
    role: 'Head of Engineering',
    email: 'sarah.k@startupx.com',
    emailConfidence: 80,
    isDecisionMaker: true,
    whyContact: 'Leads technical interviews and team building.',
  },
  // CloudBase contacts
  {
    id: '5',
    companyId: '3',
    name: 'Michael Torres',
    role: 'VP of Engineering',
    email: 'michael@cloudbase.dev',
    linkedinUrl: 'https://linkedin.com/in/michaeltorres',
    emailConfidence: 92,
    isDecisionMaker: true,
    whyContact: 'Oversees all engineering hiring. Very responsive to cold emails.',
  },
  {
    id: '6',
    companyId: '3',
    name: 'Emily Zhang',
    role: 'Frontend Lead',
    email: 'emily.z@cloudbase.dev',
    emailConfidence: 75,
    isDecisionMaker: false,
    whyContact: 'Leads frontend team. Can advocate for strong candidates.',
  },
  // AICompany contacts
  {
    id: '7',
    companyId: '4',
    name: 'David Park',
    role: 'CTO',
    email: 'david@aicompany.ai',
    linkedinUrl: 'https://linkedin.com/in/davidpark',
    emailConfidence: 90,
    isDecisionMaker: true,
    whyContact: 'Makes final decisions on all technical hires.',
  },
  // DevTools Inc contacts
  {
    id: '8',
    companyId: '5',
    name: 'Lisa Anderson',
    role: 'Co-founder',
    email: 'lisa@devtools.io',
    linkedinUrl: 'https://linkedin.com/in/lisaanderson',
    emailConfidence: 98,
    isDecisionMaker: true,
    whyContact: 'Co-founder handling engineering. Very active on Twitter, engages with developers.',
  },
  // FinanceFlow contacts
  {
    id: '9',
    companyId: '6',
    name: 'Robert Chen',
    role: 'Engineering Director',
    email: 'robert.c@financeflow.com',
    emailConfidence: 88,
    isDecisionMaker: true,
    whyContact: 'Runs the frontend organization. Previously at Goldman Sachs.',
  },
  // HealthTech Pro contacts
  {
    id: '10',
    companyId: '7',
    name: 'Amanda Foster',
    role: 'VP of Engineering',
    email: 'amanda@healthtechpro.com',
    emailConfidence: 85,
    isDecisionMaker: true,
    whyContact: 'Looking to grow the team significantly. Open to entry-level talent.',
  },
];

// Assign contacts to companies
mockCompanies.forEach(company => {
  company.contacts = mockContacts.filter(c => c.companyId === company.id);
});

// Applications
export const mockApplications: Application[] = [
  {
    id: '1',
    userId: '1',
    companyId: '1',
    contactId: '1',
    role: 'Frontend Developer',
    status: 'sent',
    emails: [
      {
        id: '1',
        applicationId: '1',
        type: 'initial',
        subject: 'Frontend Developer - Excited about TechFlow\'s AI analytics',
        body: `Hi Priya,

I saw TechFlow just raised your Series A - congratulations! The AI analytics v2.0 launch caught my attention, especially the real-time data processing approach.

I'm a frontend developer who recently built a real-time analytics dashboard that reduced page load times by 40%. Your tech stack (React, Node, PostgreSQL) matches exactly what I've been working with.

I noticed you're hiring for a Frontend Developer role. I'd love to chat about how my experience building performant data visualization tools could contribute to TechFlow's mission.

Would you be open to a quick 15-minute call this week?

Best,
Alex`,
        spamScore: 12,
        qualityScore: 88,
        warmthScore: 75,
        spamIssues: [],
        status: 'sent',
        sentAt: '2024-01-10T10:00:00Z',
      },
    ],
    createdAt: '2024-01-08T09:00:00Z',
    sentAt: '2024-01-10T10:00:00Z',
    nextFollowUpAt: '2024-01-14T10:00:00Z',
    followUpCount: 0,
    notes: 'Great match - they use React and just raised funding. Priya is active on LinkedIn.',
    company: mockCompanies[0],
    contact: mockContacts[0],
  },
  {
    id: '2',
    userId: '1',
    companyId: '2',
    contactId: '3',
    role: 'React Developer',
    status: 'response',
    emails: [
      {
        id: '2',
        applicationId: '2',
        type: 'initial',
        subject: 'Loved the AI code review demo - interested in joining StartupX',
        body: `Hey James,

Just tried the AI code review beta on Product Hunt - the instant suggestions feature is exactly what I wished existed when I was doing code reviews at my last project.

I built an AI chat application that got featured on Hacker News, so I understand the challenge of making AI feel responsive and helpful.

I see you're looking for a React Developer. Would love to be part of making code reviews 10x faster.

Mind if I send over a few ideas I had while testing the beta?

Alex`,
        spamScore: 8,
        qualityScore: 92,
        warmthScore: 82,
        spamIssues: [],
        status: 'sent',
        sentAt: '2024-01-05T14:00:00Z',
      },
    ],
    createdAt: '2024-01-04T11:00:00Z',
    sentAt: '2024-01-05T14:00:00Z',
    responseAt: '2024-01-07T09:30:00Z',
    followUpCount: 0,
    notes: 'James responded! Wants to schedule a call. This is my top choice.',
    company: mockCompanies[1],
    contact: mockContacts[2],
  },
  {
    id: '3',
    userId: '1',
    companyId: '3',
    contactId: '5',
    role: 'Frontend Engineer',
    status: 'interview',
    emails: [
      {
        id: '3',
        applicationId: '3',
        type: 'initial',
        subject: 'Congrats on 10k customers! Frontend Engineer interested',
        body: `Hi Michael,

Congratulations on hitting 10,000 customers! That's an incredible milestone for a database platform.

I've been following CloudBase since you launched the AI querying feature - it's exactly the kind of developer-focused innovation I want to work on.

My background is in React and TypeScript (your frontend stack), and I've built tools that developers actually enjoy using. My e-commerce dashboard has 500+ daily active users.

Would you have 15 minutes to chat about the Frontend Engineer role?

Best,
Alex`,
        spamScore: 15,
        qualityScore: 85,
        warmthScore: 70,
        spamIssues: [],
        status: 'sent',
        sentAt: '2024-01-02T10:00:00Z',
      },
    ],
    createdAt: '2024-01-01T15:00:00Z',
    sentAt: '2024-01-02T10:00:00Z',
    responseAt: '2024-01-04T11:00:00Z',
    interviewAt: '2024-01-15T14:00:00Z',
    followUpCount: 1,
    notes: 'Interview scheduled for Jan 15! With Emily (Frontend Lead) and Michael.',
    company: mockCompanies[2],
    contact: mockContacts[4],
  },
  {
    id: '4',
    userId: '1',
    companyId: '4',
    contactId: '7',
    role: 'Full Stack Developer',
    status: 'ready',
    emails: [
      {
        id: '4',
        applicationId: '4',
        type: 'initial',
        subject: 'AI Customer Support - Full Stack Developer Application',
        body: `Hi David,

The Zendesk partnership announcement is exciting - bringing AI to customer support at scale is a huge opportunity.

I built an AI chat application that integrates multiple AI models (GPT-4, Claude, Llama) with custom streaming handlers. The architecture challenges you're solving at AICompany are fascinating.

I'd love to learn more about the Full Stack Developer role and how I might contribute.

Available for a call whenever works for you.

Alex`,
        spamScore: 10,
        qualityScore: 80,
        warmthScore: 65,
        spamIssues: [],
        status: 'draft',
      },
    ],
    createdAt: '2024-01-12T10:00:00Z',
    followUpCount: 0,
    notes: 'Draft ready to send. They\'re not fully remote but worth a shot.',
    company: mockCompanies[3],
    contact: mockContacts[6],
  },
  {
    id: '5',
    userId: '1',
    companyId: '5',
    contactId: '8',
    role: 'TypeScript Developer',
    status: 'researching',
    emails: [],
    createdAt: '2024-01-13T09:00:00Z',
    followUpCount: 0,
    notes: 'Love their open source work. Need to draft email referencing their VS Code extension.',
    company: mockCompanies[4],
    contact: mockContacts[7],
  },
  {
    id: '6',
    userId: '1',
    companyId: '8',
    contactId: '10',
    role: 'Frontend Developer',
    status: 'sent',
    emails: [
      {
        id: '5',
        applicationId: '6',
        type: 'initial',
        subject: 'Frontend Developer - Passionate about EdTech',
        body: `Hi Amanda,

As someone who benefited hugely from online learning resources, I'm excited about what EduLearn is building with personalized AI learning.

I'm a frontend developer with experience in Next.js (your stack) and a passion for creating engaging user experiences. My portfolio project got positive feedback specifically for its intuitive interface.

I'd love to contribute to making education more accessible through technology.

Would you have time for a brief chat?

Alex`,
        spamScore: 18,
        qualityScore: 78,
        warmthScore: 72,
        spamIssues: [
          { word: 'passionate', reason: 'Overused in applications', suggestion: 'Show passion through specific examples instead', severity: 'low' }
        ],
        status: 'sent',
        sentAt: '2024-01-11T09:00:00Z',
      },
    ],
    createdAt: '2024-01-10T14:00:00Z',
    sentAt: '2024-01-11T09:00:00Z',
    nextFollowUpAt: '2024-01-15T09:00:00Z',
    followUpCount: 0,
    company: { ...mockCompanies[7], contacts: [mockContacts[9]] },
    contact: mockContacts[9],
  },
];

// Job Hunt Stats
export const mockJobHuntStats: JobHuntStats = {
  applicationsSent: 12,
  applicationsThisWeek: 4,
  responseRate: 25,
  responseTrend: 8.5,
  interviewsScheduled: 2,
  pendingFollowUps: 3,
};

// Pipeline Counts
export const mockPipelineCounts: PipelineCounts = {
  researching: 2,
  ready: 1,
  sent: 3,
  response: 1,
  interview: 1,
  offer: 0,
};

// Activity Feed
export const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'interview_scheduled',
    title: 'Interview Scheduled!',
    description: 'Technical interview with CloudBase on Jan 15',
    companyName: 'CloudBase',
    timestamp: '2024-01-13T10:00:00Z',
    isHighlighted: true,
  },
  {
    id: '2',
    type: 'response_received',
    title: 'New Response!',
    description: 'James from StartupX wants to schedule a call',
    companyName: 'StartupX',
    timestamp: '2024-01-07T09:30:00Z',
    isHighlighted: true,
  },
  {
    id: '3',
    type: 'email_sent',
    title: 'Email Sent',
    description: 'Initial email to EduLearn',
    companyName: 'EduLearn',
    timestamp: '2024-01-11T09:00:00Z',
    isHighlighted: false,
  },
  {
    id: '4',
    type: 'email_sent',
    title: 'Email Sent',
    description: 'Initial email to TechFlow',
    companyName: 'TechFlow',
    timestamp: '2024-01-10T10:00:00Z',
    isHighlighted: false,
  },
  {
    id: '5',
    type: 'followup_scheduled',
    title: 'Follow-up Scheduled',
    description: 'Follow-up #1 for TechFlow scheduled for tomorrow',
    companyName: 'TechFlow',
    timestamp: '2024-01-13T08:00:00Z',
    isHighlighted: false,
  },
  {
    id: '6',
    type: 'application_created',
    title: 'Added to Applications',
    description: 'Started researching DevTools Inc',
    companyName: 'DevTools Inc',
    timestamp: '2024-01-13T09:00:00Z',
    isHighlighted: false,
  },
];

// Spam words list
export const spamWords: Record<string, { reason: string; suggestion: string; severity: 'high' | 'medium' | 'low' }> = {
  'free': { reason: 'Overused in spam, triggers filters', suggestion: 'Remove or use "complimentary"', severity: 'high' },
  'guarantee': { reason: 'Strong promises raise red flags', suggestion: 'Use "confident" or remove', severity: 'high' },
  'limited time': { reason: 'Creates artificial urgency', suggestion: 'Be specific about timelines', severity: 'medium' },
  'act now': { reason: 'Pressure tactic flagged by filters', suggestion: 'Use "when you have time"', severity: 'high' },
  'exclusive': { reason: 'Often used for false scarcity', suggestion: 'Be specific about what makes it special', severity: 'medium' },
  'click here': { reason: 'Vague CTA is spam indicator', suggestion: 'Use descriptive link text', severity: 'medium' },
  'amazing opportunity': { reason: 'Sounds like MLM/scam', suggestion: 'Be specific about the role', severity: 'high' },
  'passionate': { reason: 'Overused, shows rather than tells', suggestion: 'Show passion through specific examples', severity: 'low' },
  'synergy': { reason: 'Corporate buzzword, feels impersonal', suggestion: 'Use concrete language', severity: 'low' },
  'rockstar': { reason: 'Overused startup cliché', suggestion: 'Describe specific skills instead', severity: 'low' },
  'ninja': { reason: 'Overused and unprofessional', suggestion: 'Use proper job titles', severity: 'low' },
  'guru': { reason: 'Overused and vague', suggestion: 'Describe specific expertise', severity: 'low' },
};

// Available roles for filtering
export const availableRoles = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'React Developer',
  'Node.js Developer',
  'Python Developer',
  'DevOps Engineer',
  'Data Engineer',
  'ML Engineer',
  'Mobile Developer',
  'iOS Developer',
  'Android Developer',
];

// Available locations
export const availableLocations = [
  'Remote',
  'San Francisco, CA',
  'New York, NY',
  'Austin, TX',
  'Seattle, WA',
  'Boston, MA',
  'Los Angeles, CA',
  'Chicago, IL',
  'Denver, CO',
  'Miami, FL',
];

// Company stages
export const companyStages = ['Seed', 'Series A', 'Series B', 'Series C+'];

// Tech stack options
export const techStackOptions = [
  'React', 'Vue', 'Angular', 'Next.js', 'TypeScript', 'JavaScript',
  'Node.js', 'Python', 'Go', 'Rust', 'Java', 'Ruby',
  'PostgreSQL', 'MongoDB', 'Redis', 'MySQL',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes',
  'GraphQL', 'REST', 'gRPC',
];
