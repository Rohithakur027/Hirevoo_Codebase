'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SidebarProvider } from '@/context/SidebarContext';

export default function DashboardLoading() {
  return (
    <SidebarProvider>
      <DashboardLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 sm:h-9 w-52 sm:w-64" />
            <Skeleton className="h-4 sm:h-5 w-72 sm:w-96" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 sm:h-10 w-24 sm:w-28" />
            <Skeleton className="h-9 sm:h-10 w-28 sm:w-36" />
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i, index) => (
            <Card key={i} className={index >= 2 ? 'hidden sm:block' : undefined}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 sm:h-8 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32 sm:w-40" />
              <Skeleton className="h-8 w-16 sm:w-20" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="space-y-2">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-6 w-8" />
                        </div>
                      ))}
                    </div>
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-9 sm:h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Card>
              <CardContent className="p-0">
                {[1, 2, 3, 4, 5].map((i, index) => (
                  <div
                    key={i}
                    className={[
                      'p-3 sm:p-4 border-b last:border-b-0',
                      index >= 3 ? 'hidden sm:block' : '',
                    ].join(' ')}
                  >
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
    </SidebarProvider>
  );
}
