import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { supabase } from "@/lib/supabase/supabase";
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function saveUserToSupabase(user: any, account: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  console.log('[saveUserToSupabase] Saving user:', { email: user.email, name: user.name });

  try {
    const userData = {
      email: user.email,
      name: user.name,
      plan: 'free',
      // Don't overwrite Gmail tokens on regular sign-in
      // These are handled separately via the Gmail connection flow
      updated_at: new Date().toISOString(),
    };

    console.log('[saveUserToSupabase] User data to save:', userData);

    // First check if user already exists
    const existingUser = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(user.email)}&select=id`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    const existingUsers = await existingUser.json();

    let response;
    if (existingUsers && existingUsers.length > 0) {
      // User exists — only update name and updated_at, don't touch gmail columns
      response = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(user.email)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          name: user.name,
          updated_at: new Date().toISOString(),
        })
      });
    } else {
      // New user — insert with defaults
      response = await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(userData)
      });
    }

    const responseText = await response.text();
    console.log('[saveUserToSupabase] Response status:', response.status);
    console.log('[saveUserToSupabase] Response body:', responseText);

    if (!response.ok) {
      console.error('[saveUserToSupabase] Failed to save user to Supabase:', responseText);
    } else {
      console.log('[saveUserToSupabase] Successfully saved user');
    }
  } catch (error) {
    console.error('[saveUserToSupabase] Error saving user to Supabase:', error);
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
      // On initial sign-in, user object is available
      if (user) {
        const { data: dbUser, error } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();

        if (dbUser) {
          token.id = dbUser.id;
        }
      }

      // If token.id is missing but we have an email, fetch the user id
      if (!token.id && token.email) {
        const { data: dbUser, error } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', token.email)
          .single();

        if (dbUser) {
          token.id = dbUser.id;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session?.user && token.id) {
        (session.user as any).id = token.id as string;
      }

      return session;
    },
  },

  debug: false,
};