/**
 * Email open tracking utilities.
 *
 * The tracking pixel is a 1x1 transparent GIF served by
 * GET /api/track/open/[campaignContactId].
 * When an email client loads the image, it records the first open.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Appends a 1x1 tracking pixel <img> tag to an HTML email body.
 *
 * @param html  - The email HTML string
 * @param campaignContactId - The campaign_contacts.id to track
 * @returns     - HTML with the tracking pixel appended
 */
export function appendTrackingPixel(html: string, campaignContactId: string): string {
    const pixelUrl = `${APP_URL}/api/track/open/${campaignContactId}`;
    const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
    return html + pixelTag;
}
