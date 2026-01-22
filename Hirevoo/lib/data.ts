export type RecipientStatus = "Sent" | "Opened" | "Replied"

export interface Recipient {
    id: string
    name: string
    email: string
    status: RecipientStatus
    sentAt: string
}

export interface Message {
    id: string
    from: "user" | "recipient"
    content: string
    timestamp: string
}

export interface Campaign {
    id: string
    name: string
    sentCount: number
    openCount: number
    replyCount: number
    status: "active" | "completed" | "draft"
    createdAt: string
}

export interface DailyData {
    date: string
    sends: number
    opens: number
    replies: number
}

export interface RecentActivity {
    id: string
    type: "sent" | "open" | "reply"
    contact: string
    time: string
    isHighIntent?: boolean
    message?: string
}

export const recipients: Recipient[] = [
    {
        id: "1",
        name: "Alice Cooper",
        email: "alice@example.com",
        status: "Sent",
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
        id: "2",
        name: "Bob Smith",
        email: "bob@company.com",
        status: "Opened",
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
    },
    {
        id: "3",
        name: "Charlie Brown",
        email: "charlie@startup.io",
        status: "Replied",
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
        id: "4",
        name: "David Lee",
        email: "david@tech.net",
        status: "Sent",
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
        id: "5",
        name: "Eva Green",
        email: "eva@design.org",
        status: "Opened",
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
]

export const campaignsList: Campaign[] = [
    {
        id: "c1",
        name: "Process Nave Hire Pipework",
        sentCount: 1250,
        openCount: 850,
        replyCount: 3,
        status: "active",
        createdAt: "2026-01-12T09:00:00Z",
    },
    {
        id: "c2",
        name: "Organize and Deliver Compliance Training",
        sentCount: 450,
        openCount: 380,
        replyCount: 0,
        status: "active",
        createdAt: "2026-01-15T14:30:00Z",
    },
    {
        id: "c3",
        name: "Address Employees Leave Request",
        sentCount: 2100,
        openCount: 1900,
        replyCount: 7,
        status: "active",
        createdAt: "2026-01-18T11:20:00Z",
    },
    {
        id: "c4",
        name: "Respond to Employer Sessions Inquiry",
        sentCount: 800,
        openCount: 650,
        replyCount: 2,
        status: "active",
        createdAt: "2026-01-20T09:00:00Z",
    },
    {
        id: "c5",
        name: "Prepare for Upcoming Benefits Fair",
        sentCount: 320,
        openCount: 280,
        replyCount: 0,
        status: "draft",
        createdAt: "2026-01-22T10:00:00Z",
    },
    {
        id: "c6",
        name: "Review Open Positions",
        sentCount: 1500,
        openCount: 1200,
        replyCount: 5,
        status: "active",
        createdAt: "2026-01-23T08:30:00Z",
    },
]

export const globalStats = {
    totalSent: 1540020,
    totalOpens: 92400,
    totalReplies: 330000,
    weeklyGrowth: 12.5,
    followUpRequired: 145,
}

export const recentActivity: RecentActivity[] = [
    {
        id: "a1",
        type: "reply",
        contact: "John Smith",
        time: "2 min ago",
        isHighIntent: true,
        message: "Thank you for reaching out. I would love to discuss this opportunity further...",
    },
    {
        id: "a2",
        type: "reply",
        contact: "Sarah Johnson",
        time: "15 min ago",
        isHighIntent: true,
        message: "I have reviewed the leave policy, and would like to submit my request...",
    },
    {
        id: "a3",
        type: "open",
        contact: "Michael Chen",
        time: "1 hour ago",
        message: "Interested in the Senior Developer position. My experience aligns well...",
    },
    {
        id: "a4",
        type: "reply",
        contact: "Emma Davis",
        time: "2 hours ago",
        isHighIntent: true,
        message: "Could you provide more details about the benefits package?",
    },
    {
        id: "a5",
        type: "open",
        contact: "Robert Wilson",
        time: "3 hours ago",
        message: "Confirming my attendance for the training session next week...",
    },
    {
        id: "a6",
        type: "reply",
        contact: "Lisa Anderson",
        time: "5 hours ago",
        message: "I have 5 years of experience in this field and would be a great fit...",
    },
    {
        id: "a7",
        type: "open",
        contact: "David Martinez",
        time: "6 hours ago",
    },
]

export const dailyData: DailyData[] = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
        date: d.toISOString(),
        sends: Math.floor(Math.random() * 50) + 100,
        opens: Math.floor(Math.random() * 30) + 50,
        replies: Math.floor(Math.random() * 10) + 5,
    }
})

export function getEmailConversation(recipientId: string): Message[] {
    // Mock conversation
    return [
        {
            id: "m1",
            from: "user",
            content: "Hi there, I noticed you were hiring...",
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
        {
            id: "m2",
            from: "recipient",
            content: "Thanks for reaching out! Can you send more info?",
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
        },
        {
            id: "m3",
            from: "user",
            content: "Absolutely! Here is our portfolio...",
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
    ]
}
