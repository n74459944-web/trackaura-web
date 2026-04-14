import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const revalidate = 14400; // 4 hours

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "changes.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([]);
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("GET /api/changes failed:", err);
    return NextResponse.json(
      { error: "Failed to load changes" },
      { status: 500 },
    );
  }
}
