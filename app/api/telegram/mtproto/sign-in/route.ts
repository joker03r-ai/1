import { NextRequest, NextResponse } from "next/server";
import { makeClient, cleanErr } from "../_util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Шаг 2 входа: подтверждает код (и при необходимости пароль 2FA), возвращает сессию.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const apiId = String(b.apiId || "").trim();
  const apiHash = String(b.apiHash || "").trim();
  const phone = String(b.phone || "").trim();
  const phoneCodeHash = String(b.phoneCodeHash || "").trim();
  const code = String(b.code || "").trim();
  const password = b.password ? String(b.password) : "";
  const session = String(b.session || "");
  if (!apiId || !apiHash || !phone || !phoneCodeHash || !code) {
    return NextResponse.json({ error: "Не хватает данных для входа" }, { status: 400 });
  }

  try {
    const { Api } = await import("telegram");
    const client = await makeClient(apiId, apiHash, session);
    try {
      await client.invoke(
        new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code })
      );
    } catch (e: any) {
      const msg = String(e?.errorMessage || e?.message || "");
      if (msg.includes("SESSION_PASSWORD_NEEDED")) {
        if (!password) {
          const saved = String(client.session.save());
          await client.disconnect();
          return NextResponse.json({ needPassword: true, session: saved });
        }
        const { computeCheck } = await import("telegram/Password");
        const pwd: any = await client.invoke(new Api.account.GetPassword());
        const check = await computeCheck(pwd, password);
        await client.invoke(new Api.auth.CheckPassword({ password: check }));
      } else {
        throw e;
      }
    }
    const me: any = await client.getMe();
    const saved = String(client.session.save());
    await client.disconnect();
    return NextResponse.json({
      ok: true,
      session: saved,
      user: {
        username: me?.username || "",
        name: [me?.firstName, me?.lastName].filter(Boolean).join(" ") || me?.username || "Аккаунт",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: cleanErr(e) }, { status: 400 });
  }
}
