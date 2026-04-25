import { login } from './actions';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-medium mb-6 text-teal-400">
          TrackAura Admin
        </h1>
        <form action={login} className="space-y-4">
          <input
            type="password"
            name="secret"
            placeholder="Admin secret"
            autoFocus
            required
            autoComplete="off"
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            className="w-full px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded text-sm font-medium transition"
          >
            Log in
          </button>
          {error ? (
            <p className="text-sm text-red-400">Invalid secret.</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
