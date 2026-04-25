'use server';

import { redirect } from 'next/navigation';
import { setAdminCookie } from '@/lib/admin/auth';

export async function login(formData: FormData) {
  const secret = formData.get('secret');

  if (typeof secret !== 'string' || secret !== process.env.ADMIN_SECRET) {
    redirect('/admin/login?error=1');
  }

  await setAdminCookie();
  redirect('/admin/review');
}
