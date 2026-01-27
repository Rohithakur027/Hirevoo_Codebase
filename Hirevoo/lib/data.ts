export type RecipientStatus = "Sent" | "Opened" | "Replied" | "Pending"

export interface Recipient {
    id: string
    campaignContactId?: string
    name: string
    email: string
    status: RecipientStatus
    sentAt: string
    avatar?: string
    initials?: string
    role?: string
    company?: string
    gmailThreadId?: string
}

export interface Message {
    id: string
    from: "user" | "recipient"
    content: string
    timestamp: string
    status?: "sent" | "delivered" | "read" | "failed"
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

