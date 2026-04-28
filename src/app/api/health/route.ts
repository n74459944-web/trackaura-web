import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic — never cache health checks. Edge cache poisoning is exactly
// what we're trying to detect, so a cached 200 response is the worst outcome.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const HEALTH_TIMEOUT_MS = 5_000;

type HealthStatus = {
  status: 'healthy' | 'unhealthy';
  supabase: 'ok' | 'error' | 'timeout' | 'exception';
  canonical_entities_count?: number;
  error?: string;
  duration_ms: number;
  timestamp: string;
};

export async function GET() {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const supabase = await createClient();

    // Cheap reachability probe: HEAD-equivalent count on canonical_entities.
    // Uses the new idx_canonical_entities_slug index path (table is hot in
    // page cache from chip-page reads). Should round-trip in <100ms when healthy.
    const queryPromise = supabase
      .from('canonical_entities')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('supabase_timeout')),
        HEALTH_TIMEOUT_MS,
      ),
    );

    const result = (await Promise.race([queryPromise, timeoutPromise])) as
      | Awaited<typeof queryPromise>
      | never;

    const { error, count } = result;

    if (error) {
      const body: HealthStatus = {
        status: 'unhealthy',
        supabase: 'error',
        error: error.message,
        duration_ms: Date.now() - start,
        timestamp,
      };
      return NextResponse.json(body, { status: 503 });
    }

    const body: HealthStatus = {
      status: 'healthy',
      supabase: 'ok',
      canonical_entities_count: count ?? undefined,
      duration_ms: Date.now() - start,
      timestamp,
    };
    return NextResponse.json(body, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    const body: HealthStatus = {
      status: 'unhealthy',
      supabase: message === 'supabase_timeout' ? 'timeout' : 'exception',
      error: message,
      duration_ms: Date.now() - start,
      timestamp,
    };
    return NextResponse.json(body, { status: 503 });
  }
}

// HEAD support so UptimeRobot can use the cheaper "HTTP HEAD" check type
// if you want to save bandwidth. Same status semantics, no body.
export async function HEAD() {
  const response = await GET();
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
