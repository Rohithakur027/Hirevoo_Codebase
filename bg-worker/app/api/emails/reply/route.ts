import { NextRequest, NextResponse } from 'next/server';
import { queueReplySend } from '@/lib/queue/email-queue';

export interface ReplyRequest {
    campaignContactId: string;
    message: string;
    userId: string;
}

export interface ApiResponse {
    success: boolean;
    message?: string;
    jobId?: string;
    queuePosition?: number;
    error?: string;
    code?: string;
}

/**
 * POST /api/emails/reply
 * 
 * Queues an email reply to be sent by the worker.
 */
export async function POST(
    request: NextRequest
): Promise<NextResponse<ApiResponse>> {
    try {
        // 1. Authorization Check (Simple API Key)
        const authHeader = request.headers.get('Authorization');
        const expectedKey = `Bearer ${process.env.BG_WORKER_API_KEY || 'internal-key'}`;

        if (authHeader !== expectedKey) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Unauthorized',
                    code: 'UNAUTHORIZED'
                },
                { status: 401 }
            );
        }

        // 2. Validate Body
        const body: ReplyRequest = await request.json();
        const { campaignContactId, message, userId } = body;

        if (!campaignContactId || !message || !userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST'
                },
                { status: 400 }
            );
        }

        // 3. Queue the Job
        const { jobId, queuePosition } = await queueReplySend(
            campaignContactId,
            message,
            userId
        );

        return NextResponse.json({
            success: true,
            message: 'Reply queued successfully',
            jobId,
            queuePosition
        });

    } catch (error: any) {
        console.error('[API:Reply] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Internal server error',
                code: 'INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
}
