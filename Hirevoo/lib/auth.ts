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

    const response = await fetch(`${supabaseUrl}/rest/v1/users?on_conflict=email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(userData)
    });

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
      console.log('[JWT Callback] Token email:', token.email);
      console.log('[JWT Callback] User object:', user ? { email: user.email, name: user.name } : 'null');

      // On initial sign-in, user object is available
      if (user) {
        console.log('[JWT Callback] Fetching user by email:', user.email);
        const { data: dbUser, error } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();

        if (error) {
          console.error('[JWT Callback] Error fetching user:', error);
        } else if (dbUser) {
          console.log('[JWT Callback] Found user ID:', dbUser.id);
          token.id = dbUser.id;
        } else {
          console.log('[JWT Callback] No user found for email:', user.email);
        }
      }

      // If token.id is missing but we have an email, fetch the user id
      // This handles cases where the initial sign-in didn't persist the id
      if (!token.id && token.email) {
        console.log('[JWT Callback] Token ID missing, fetching by email:', token.email);
        const { data: dbUser, error } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', token.email)
          .single();

        if (error) {
          console.error('[JWT Callback] Error fetching user on retry:', error);
        } else if (dbUser) {
          console.log('[JWT Callback] Found user ID on retry:', dbUser.id);
          token.id = dbUser.id;
        } else {
          console.log('[JWT Callback] No user found on retry for email:', token.email);
        }
      }

      console.log('[JWT Callback] Final token ID:', token.id);
      return token;
    },

    async session({ session, token }) {
      console.log('[Session Callback] Session user before:', session?.user ? { email: session.user.email, id: (session.user as any).id } : 'null');
      console.log('[Session Callback] Token ID:', token.id);

      if (session?.user && token.id) {
        (session.user as any).id = token.id as string;
        console.log('[Session Callback] Set session user ID:', session.user.id);
      } else {
        console.log('[Session Callback] Not setting user ID - session.user or token.id missing');
      }

      console.log('[Session Callback] Session user after:', session?.user ? { email: session.user.email, id: (session.user as any).id } : 'null');
      return session;
    },
  },

  debug: process.env.NODE_ENV === 'development',
};