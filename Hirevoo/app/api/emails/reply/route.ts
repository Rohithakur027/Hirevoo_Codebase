import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { bgWorkerApi } from '@/lib/bg-worker-api';

/**
 * POST /api/emails/reply
 *
 * Sends a reply to a campaign contact.
 * Proxies the request to the bg-worker service.
 *
 * Payload:
 * - campaignContactId: string
 * - message: string
 */
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { campaignContactId, message } = body;

        if (!campaignContactId || !message) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Call background worker API to queue the reply
        const result = await bgWorkerApi.sendReply(campaignContactId, message, session.user.id);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[Reply API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Internal server error'
            },
            { status: error.statusCode || 500 }
        );
    }
}
