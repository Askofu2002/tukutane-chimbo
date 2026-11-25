import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ app: "Tukutane Chimbo", status: "degraded", supabase: "missing_environment" }, { status: 503 });
  }

  try {
    const base = url.replace(/\/+$/, "");
    const headers = { apikey: key, Authorization: "Bearer " + key };
    const [auth, rest] = await Promise.all([
      fetch(base + "/auth/v1/health", { headers, cache: "no-store" }),
      fetch(base + "/rest/v1/profiles?select=id&limit=0", { headers, cache: "no-store" })
    ]);
    const restBody = await rest.clone().text();
    const restReachable = rest.ok || (rest.status === 401 && restBody.includes("permission denied for table profiles"));
    const ok = auth.ok && restReachable;
    return NextResponse.json({
      app: "Tukutane Chimbo",
      status: ok ? "ok" : "degraded",
      supabase: {
        auth: auth.ok ? "reachable" : "unavailable",
        database_api: rest.ok ? "reachable" : restReachable ? "reachable_auth_required" : "unavailable"
      }
    }, { status: ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ app: "Tukutane Chimbo", status: "degraded", supabase: "unreachable" }, { status: 503 });
  }
}
