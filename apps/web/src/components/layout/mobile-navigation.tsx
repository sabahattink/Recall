'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import type { NavItem } from '@/config/navigation';
import { cn } from '@/lib/utils';

export function MobileNavigation({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open ? (
        <nav
          id="mobile-navigation"
          aria-label="Mobile"
          className={cn(
            'absolute inset-x-0 top-16 z-40 border-b border-border bg-background px-6 py-4',
          )}
        >
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
