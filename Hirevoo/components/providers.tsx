'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { GmailProvider } from '@/components/providers/gmail-provider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <GmailProvider>
        {children}
      </GmailProvider>
    </SessionProvider>
  );
}