'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

// Hirevoo Logo Mark - Same as landing page
const HirevooMark = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M5 5V19M5 12H13"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M13 7L18 12L13 17"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="19.5" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

const navLinks = [
  { name: 'Product', href: '/' },
  { name: 'Features', href: '/#features' },
  { name: 'Pricing', href: '/#pricing' },
  { name: 'Resources', href: '/#resources' },
] as const;

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30">
      <div className="px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-border bg-background/80 px-3 py-2 shadow-sm backdrop-blur">
          {/* Left: Brand */}
          <Link href="/" className="flex items-center gap-2 pl-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-900 dark:bg-white">
              <HirevooMark className="h-5 w-5 text-white dark:text-gray-900" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Hirevoo</span>
          </Link>

          {/* Center: Links */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => {
              const isAnchor = item.href.startsWith('/#');
              const active =
                item.href === '/' ? pathname === '/' : isAnchor ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={[
                    'rounded-full px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    'hover:bg-muted/60',
                  ].join(' ')}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/signup">Request a Demo</Link>
            </Button>
          </div>

          {/* Mobile: keep it simple (brand + sign in) */}
          <div className="md:hidden">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
