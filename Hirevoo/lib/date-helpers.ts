export function formatSentAt(isoString: string): string {
    const date = new Date(isoString)
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })
}

export function getHoursSince(isoString: string): number {
    const sentDate = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - sentDate.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60))
}

export function formatDate(isoString: string): string {
    const date = new Date(isoString)
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

export function formatChartDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    })
}

export function formatShortDate(isoString: string): string {
    const date = new Date(isoString)
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })
}
