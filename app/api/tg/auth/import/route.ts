import { NextRequest, NextResponse } from "next/server";
import { importAccount } from "@/lib/tgImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Импорт аккаунта: string / json / session-файл / tdata(zip).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const res = await importAccount({
    format: String(b.format || "string"),
    apiId: b.apiId ? String(b.apiId) : "",
    apiHash: b.apiHash ? String(b.apiHash) : "",
    text: typeof b.text === "string" ? b.text : "",
    base64: typeof b.base64 === "string" ? b.base64 : "",
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
