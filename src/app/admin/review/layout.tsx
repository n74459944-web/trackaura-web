import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin, clearAdminCookie } from '@/lib/admin/auth';

async function logout() {
  'use server';
  await clearAdminCookie();
  redirect('/admin/login');
}

export default async function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-3 flex items-center justify-between">
        <Link
          href="/admin/review"
          className="text-sm font-medium text-teal-400 hover:text-teal-300"
        >
          TrackAura Admin · Review Queue
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-neutral-400 hover:text-neutral-100 transition"
          >
            Log out
          </button>
        </form>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
