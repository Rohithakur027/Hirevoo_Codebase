import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUTCTimeISO } from '@/lib/date-helpers';

// 1x1 transparent GIF (43 bytes)
const TRACKING_PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Fire-and-forget: update DB, but always return the pixel immediately.
    // Only record the FIRST open (WHERE opened_at IS NULL).
    if (id) {
        try {
            await supabase
                .from('campaign_contacts')
                .update({
                    opened_at: getUTCTimeISO(),
                    status: 'opened',
                    updated_at: getUTCTimeISO(),
                })
                .eq('id', id)
                .is('opened_at', null);
        } catch (err) {
            // Never fail the pixel response — silent logging only
            console.error('[TrackOpen] DB update failed:', err);
        }
    }

    return new Response(TRACKING_PIXEL, {
        status: 200,
        headers: {
            'Content-Type': 'image/gif',
            'Content-Length': String(TRACKING_PIXEL.length),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });
}
