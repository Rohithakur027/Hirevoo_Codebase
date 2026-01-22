import { google } from 'googleapis';

export class GmailClient {
    public oauth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/auth/gmail/callback'
        );
    }

    generateAuthUrl(userId: string) {
        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
            state: userId,
        });
    }

    async getTokensFromCode(code: string) {
        const { tokens } = await this.oauth2Client.getToken(code);
        return tokens;
    }


    async getUserProfile(accessToken: string) {

        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const gmail = google.gmail({ version: 'v1', auth });

        const { data } = await gmail.users.getProfile({
            userId: 'me',
        });

        return {
            email: data.emailAddress,
            messagesTotal: data.messagesTotal,
            threadsTotal: data.threadsTotal,
            historyId: data.historyId
        };
    }
}

export const gmailClient = new GmailClient();