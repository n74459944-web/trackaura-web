import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'trackaura_admin';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Admin auth for /admin/review. Per ARCHITECTURE §12 "Admin review UI auth.
 * Shared secret URL initially."
 *
 * A cookie named trackaura_admin holds the shared secret value. On every
 * admin request the cookie value is compared against process.env.ADMIN_SECRET.
 * No database, no accounts, no user management — that's all deferred.
 *
 * When ADMIN_SECRET is missing from the environment, isAdmin() returns false
 * and the UI becomes unreachable. Fail closed.
 */

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return cookie?.value === secret;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect('/admin/login');
  }
}

export async function setAdminCookie(): Promise<void> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET not configured');

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
