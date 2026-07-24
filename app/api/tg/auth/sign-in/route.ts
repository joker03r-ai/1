import { NextRequest, NextResponse } from "next/server";
import { makeClient, cleanErr } from "@/app/api/telegram/mtproto/_util";
import { getPending, updatePending, dropPending, saveAccount } from "@/lib/tgAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Шаг 2 входа: код (+ пароль 2FA), проверка через getMe, зашифрованное
// сохранение сессии на сервере. Возвращаем только accountId и профиль.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const authId = String(b.authId || "");
  const code = String(b.code || "").trim();
  const password = b.password ? String(b.password) : "";
  const p = getPending(authId);
  if (!p) return NextResponse.json({ error: "Сессия входа истекла — начните заново." }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Введите код из Telegram" }, { status: 400 });

  try {
    const { Api } = await import("telegram");
    const client = await makeClient(p.apiId, p.apiHash, p.session);
    try {
      await client.invoke(new Api.auth.SignIn({ phoneNumber: p.phone, phoneCodeHash: p.phoneCodeHash, phoneCode: code }));
    } catch (e: any) {
      const msg = String(e?.errorMessage || e?.message || "");
      if (msg.includes("SESSION_PASSWORD_NEEDED")) {
        if (!password) {
          const saved = String(client.session.save());
          await client.disconnect();
          updatePending(authId, { session: saved });
          return NextResponse.json({ needPassword: true });
        }
        const { computeCheck } = await import("telegram/Password");
        const pwd: any = await client.invoke(new Api.account.GetPassword());
        const check = await computeCheck(pwd, password);
        await client.invoke(new Api.auth.CheckPassword({ password: check }));
      } else {
        throw e;
      }
    }
    const me: any = await client.getMe(); // проверка подключения
    const session = String(client.session.save());
    await client.disconnect();
    const acc = saveAccount({
      apiId: p.apiId, apiHash: p.apiHash, session,
      username: me?.username || "",
      name: [me?.firstName, me?.lastName].filter(Boolean).join(" ") || me?.username || "Аккаунт",
    });
    dropPending(authId);
    return NextResponse.json({ ok: true, accountId: acc.id, user: { id: acc.id, username: acc.username, name: acc.name } });
  } catch (e: any) {
    return NextResponse.json({ error: cleanErr(e) }, { status: 400 });
  }
}
