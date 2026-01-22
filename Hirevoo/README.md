# Hirevoo - AI-Powered Cold Email for Job Seekers

> "Skip the application black hole. Send outreach and follow up consistently."

Hirevoo is a job seeker-focused cold email platform that helps you send outreach to your existing contacts, schedule follow-ups, and track your pipeline.

## 🎯 What Makes This Different

- **Compose + send** - broadcast-style outreach to your contact list
- **Follow-ups built in** - configure a schedule (e.g. follow up after 2 days)
- **Track everything** - Kanban pipeline + application detail timeline
- **Great UX** - fast, modern UI with shadcn/ui + Framer Motion

## 🚀 Features

### Core Pages

1. **Landing Page** (`/`) - Job seeker focused with comparison visual, features, testimonials
2. **Dashboard** (`/dashboard`) - Job hunt metrics, activity feed, pipeline mini-view
3. **Applications** (`/applications`) - Full Kanban board with drag-and-drop
4. **Application Detail** (`/applications/[id]`) - Email timeline, scores, notes
5. **Compose** (`/compose`) - Email editor with spam word highlighting
6. **Profile** (`/profile`) - Skills, projects, portfolio links
7. **Settings** (`/settings`) - Gmail connection, follow-up settings, notifications
8. **Onboarding** (`/onboarding`) - Multi-step wizard for new users

> Note: `/discover` is reserved for Phase 2 and currently shows a placeholder.

### Key Components

- **KanbanBoard** - Drag-and-drop application tracking
- **SpamHighlighter** - Real-time spam word detection with tooltips
- **SpamScoreGauge** - Visual spam score indicator
- **QualityScoreGauge** - Email quality score
- **WarmthMeter** - Thermometer-style warmth indicator
- **PipelineMini** - Horizontal pipeline overview
- **ActivityFeed** - Recent job hunt activity

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **Drag & Drop**: @dnd-kit/core, @dnd-kit/sortable
- **Components**: Radix UI primitives

## 📂 Project Structure

```
app/
├── page.tsx                    # Landing page
├── dashboard/page.tsx          # Job hunt dashboard
├── discover/                   # Phase 2 placeholder routes
│   ├── page.tsx
│   └── [companyId]/page.tsx
├── applications/
│   ├── page.tsx               # Kanban board
│   └── [id]/page.tsx          # Application detail
├── compose/page.tsx           # Email composition
├── profile/page.tsx           # User profile
├── settings/page.tsx          # Settings
└── (auth)/
    ├── login/page.tsx
    ├── signup/page.tsx
    └── onboarding/page.tsx    # Profile setup wizard

components/
├── applications/               # Kanban components
├── compose/                    # Email editor components
├── profile/                    # Profile components
├── dashboard/                  # Dashboard widgets
├── layout/                     # Layout components
└── ui/                         # shadcn/ui components

lib/
├── mock-data.ts               # Comprehensive mock data
├── utils.ts                   # Utility functions
└── spam-words.ts              # Spam word definitions

types/
└── index.ts                   # TypeScript interfaces
```

## 🚦 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 📊 Mock Data Includes

- **Sample contacts + companies** for demo data
- **6 Applications**: Various stages (researching → interview)
- **User Profile**: Sample skills, projects, preferences
- **Activity Feed**: Recent job hunt events

## 🎨 Design System

### Status Colors
- **Researching**: Slate
- **Ready/Sent**: Blue/Indigo
- **Response**: Amber
- **Interview**: Emerald
- **Offer**: Purple

### Score Indicators
- **Spam Score**: 0-100 (lower is better) - Red to Green
- **Quality Score**: 0-100 (higher is better) - Red to Green
- **Warmth Meter**: Cold → Hot thermometer visual

## 📝 Key Principles

1. **Everything is job-seeker focused** - No generic "campaign" language
2. **Use your existing contacts** - upload/paste emails and start sending
3. **Track everything** - Kanban provides visibility
4. **Follow-ups matter** - Make the sequence visible and manageable
5. **Visual feedback** - Scores, gauges, progress indicators everywhere

## 🔮 Future Enhancements

- [ ] Real email sending via Gmail OAuth
- [ ] Company data enrichment via APIs
- [ ] Email tracking (opens, clicks)
- [ ] AI email generation with OpenAI
- [ ] Interview scheduling integration
- [ ] Analytics dashboard

---

Made with ❤️ for job seekers everywhere
