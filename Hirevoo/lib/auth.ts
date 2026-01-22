import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { supabase } from "@/lib/supabase/supabase";

async function saveUserToSupabase(user: any, account: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const tokenExpiresAt = account.expires_at
    ? new Date(account.expires_at * 1000).toISOString()
    : null;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/users?on_conflict=email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        email: user.email,
        name: user.name,
        plan: 'free',
        gmail_connected: true,
        gmail_access_token: account.access_token,
        gmail_refresh_token: account.refresh_token,
        gmail_token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
    });

    if (!response.ok) {
      console.error('Failed to save user to Supabase:', await response.text());
    }
  } catch (error) {
    console.error('Error saving user to Supabase:', error);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile"
        }
      }
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await saveUserToSupabase(user, account);
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();

        if (dbUser) {
          token.id = dbUser.id;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session?.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === 'development',
};