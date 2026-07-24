import { NextResponse } from "next/server";
import { publicBaseUrl } from "@/lib/tgRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // читать WEBHOOK_BASE_URL в рантайме, не на сборке

// Отдаёт публичный HTTPS-адрес приложения (для отображения webhook-URL в
// кабинете). Настраивается переменной WEBHOOK_BASE_URL на сервере.
export async function GET() {
  const base = publicBaseUrl();
  const https = /^https:\/\//i.test(base);
  return NextResponse.json({
    baseUrl: base,
    configured: !!base && https,
    https,
    example: "https://api.домен.ru",
  });
}
