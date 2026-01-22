'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewCampaignPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new upload route
    router.replace('/campaigns/upload');
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to contact upload...</p>
      </div>
    </div>
  );
}
