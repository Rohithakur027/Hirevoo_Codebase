import { NextResponse } from 'next/server';
import { getEmailConversation } from '@/lib/data';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get('recipientId');

    if (!recipientId) {
        return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 });
    }

    try {
        // In a real app, this would fetch from a database using the recipientId
        const messages = getEmailConversation(recipientId);

        // Simulating network delay for realism
        await new Promise(resolve => setTimeout(resolve, 500));

        return NextResponse.json({ success: true, messages });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
    }
}
