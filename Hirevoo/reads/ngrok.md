# Ngrok Setup for Google Pub/Sub Development

To test Gmail webhooks locally, you need a public URL that Google can send requests to. We use **Ngrok** for this.

## 1. Where to Install?
**Ngrok is a system-wide tool.** You do NOT need to install it inside `Hirevoo` or `bg-worker`. You install it on your computer (Windows/Mac) once, and it works for everything.

However, you must Point it to the **Hirevoo** app (Next.js).

## 2. Start Ngrok
Since your webhook logic (`app/api/webhooks/gmail/route.ts`) lives in the **Hirevoo** project (running on port 3000), you must tunnel that port.

Run this in any terminal (location doesn't matter):

```bash
ngrok http 3000
```
*Make sure your Next.js app is running (`npm run dev`) first.*

Copy the forwarding URL (e.g., `https://a1b2-c3d4.ngrok-free.app`).

## 3. Domain Verification (Crucial Step)
Google Cloud Pub/Sub **requests that you verify ownership** of the domain receiving the push notifications. Standard `ngrok` domains often get blocked or require verification.

### Method A: Using a Paid/Static Ngrok Domain (Easiest)
If you have a paid Ngrok plan with a custom domain, simply verify that domain in [Google Search Console](https://search.google.com/search-console) once, and you are good forever.

### Method B: Verifying the Ephemeral Domain (Free Tier)
Every time you restart ngrok on the free tier, you get a new URL. You must verify it each time.

1.  **Get the Domain**: Copy your current ngrok URL (e.g., `https://xyz.ngrok-free.app`).
2.  **Google Cloud Console**:
    -   Go to **APIs & Services** > **Domain Verification**.
    -   Click **Add Domain**.
    -   Paste your ngrok URL (`https://xyz.ngrok-free.app`).
3.  **Verify Ownership**:
    -   Google will ask you to verify via **HTML File Upload**.
    -   Download the verification file (e.g., `google12345.html`).
    -   **Quick Fix**: Put this file in your Next.js `public/` folder:
        -   `/public/google12345.html`
    -   Now `https://xyz.ngrok-free.app/google12345.html` should be accessible.
    -   Click **Verify** in Google Console.

## 4. Configure Pub/Sub Subscription
Once the domain is verified:

1.  Go to **Google Cloud Console** > **Pub/Sub** > **Subscriptions**.
2.  Find or Create your subscription (e.g., `gmail-watch-sub`).
3.  **Edit Subscription**:
    -   **Delivery Type**: Push
    -   **Endpoint URL**: `https://xyz.ngrok-free.app/api/webhooks/gmail`
4.  Click **Update**.

## 5. Testing
1.  Send an email to the connected Gmail account.
2.  Check your **Ngrok terminal**: You should see a `POST /api/webhooks/gmail` 200 OK.
3.  Check your **Next.js terminal**: You should see logs like `[Background Job] Starting sync...`.
