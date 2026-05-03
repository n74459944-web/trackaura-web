// TEMPORARY DKIM VERIFICATION ROUTE — DELETE AFTER USE
// Path: src/app/api/test-email/route.ts
// Hit once: curl https://www.trackaura.com/api/test-email
// Then delete this file.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "alerts@trackaura.com",
        to: "n74459944@gmail.com",
        subject: "DKIM verification test",
        text: "Testing DKIM signing from Resend. Check Show Original in Gmail.",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, data }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
