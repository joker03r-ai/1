import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/tgAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Список подключённых аккаунтов (без сессий). Клиент хранит только accountId.
export async function GET() {
  return NextResponse.json({ ok: true, accounts: listAccounts() });
}
