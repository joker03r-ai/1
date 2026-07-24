# Приём сообщений Telegram (webhook)

Пока в кабинете горит **«Webhook не настроен»**, входящие сообщения (в том
числе `/start`) работать не будут. Причина почти всегда одна: webhook пытается
указывать на `http://IP:3000`, а Telegram принимает **только HTTPS** на портах
443/80/88/8443. Нужен домен с валидным SSL.

## Шаги

1. **Домен + SSL.** Направьте, например, `api.домен.ru` (A-запись) на сервер.
   - Nginx: `sudo certbot --nginx -d api.домен.ru`
   - Caddy: сертификат выпускается автоматически.

2. **Reverse-proxy 443 → localhost:3000.** Возьмите готовый конфиг:
   - `deploy/nginx-telegram.conf` (Nginx)
   - `deploy/Caddyfile` (Caddy)

3. **Переменная окружения приложения.** В `.env` (или переменных контейнера):
   ```
   WEBHOOK_BASE_URL=https://api.домен.ru
   ```
   Именно из неё строится публичный адрес webhook. Origin браузера
   (`http://IP:3000`) больше не используется.

4. **Регистрация webhook.** Откройте бота в кабинете → **Диагностика** →
   вставьте токен → **«Проверить подключение»**. Приложение вызовет
   `setWebhook` с адресом `https://api.домен.ru/api/telegram/webhook/{botId}`
   и `secret_token`, затем прочитает `getWebhookInfo`.

5. **Проверка приёма.** Напишите боту `/start`, затем любое текстовое
   сообщение. В блоке **«Состояние webhook»** появятся установленный URL,
   `pending_update_count`, `last_error_message` и время последнего входящего.

## Когда проверка считается успешной

Кнопка «Проверить подключение» **не** объявляет успех по факту отправки
сообщения. Зелёными должны стать все звенья:

- токен действителен (`getMe`);
- webhook установлен (`setWebhook` вернул `ok`);
- `getWebhookInfo` без `last_error_message` и URL совпадает;
- фактически получено входящее сообщение (после `/start`).

## Безопасность webhook-маршрута

- Маршрут `POST /api/telegram/webhook/{botId}` — **без авторизации приложения,
  без CSRF-проверок и без редиректов**. Отвечает `200 OK` немедленно.
- Единственная проверка — секрет Telegram: приложение сверяет заголовок
  `X-Telegram-Bot-Api-Secret-Token` со значением `secret_token`, переданным
  в `setWebhook`. Несовпадение → `401`, обновление игнорируется.
- В Nginx заголовок пробрасывается директивой
  `proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;`
  (в Caddy `reverse_proxy` пробрасывает заголовки сам).

## Ручная регистрация (для отладки)

```bash
# Установить webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://api.домен.ru/api/telegram/webhook/<botId>" \
  -d "secret_token=<любой_секрет>"

# Проверить состояние
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```
