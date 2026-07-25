# Деплой BotPilot на сервер

Приложение на **Next.js**. Данные пользователя хранятся в браузере (localStorage),
поэтому база данных не нужна. Единственное серверное место — маршрут `/api/chat`
(ответы AI-чата). Для реального Claude задайте `ANTHROPIC_API_KEY`; без ключа чат
работает в демо-режиме.

Ниже — два способа. Предполагается сервер на **Ubuntu/Debian**.

---

## Вариант A. Docker (рекомендую — проще всего)

На сервере должен быть установлен Docker.

```bash
# 1. Клонируем репозиторий
git clone https://github.com/joker03r-ai/BotPilot.git botpilot
cd botpilot
git checkout claude/screenshot-analysis-recreation-6yze8d

# 2. Собираем образ
docker build -t botpilot .

# 3. Запускаем (порт 3000; ключ — по желанию)
docker run -d --name botpilot --restart unless-stopped \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-xxxxx \
  botpilot
```

Проверка: `curl http://localhost:3000` → должна отдаться страница.
Обновление после `git pull`: `docker build -t botpilot . && docker rm -f botpilot && docker run ...` (та же команда).

---

## Вариант B. Напрямую через Node + systemd

### 1. Установить Node.js 20+ и собрать

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

git clone https://github.com/joker03r-ai/BotPilot.git botpilot
cd botpilot
git checkout claude/screenshot-analysis-recreation-6yze8d
npm ci
npm run build
```

### 2. Запуск standalone-сервера

Сборка кладёт готовый сервер в `.next/standalone`. Скопируйте статику рядом:

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

Проверка вручную:

```bash
PORT=3000 node .next/standalone/server.js
```

### 3. systemd-сервис (автозапуск)

Создайте `/etc/systemd/system/botpilot.service`:

```ini
[Unit]
Description=BotPilot
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/USER/botpilot
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
# Environment=ANTHROPIC_API_KEY=sk-ant-xxxxx
ExecStart=/usr/bin/node /home/USER/botpilot/.next/standalone/server.js
Restart=always
User=USER

[Install]
WantedBy=multi-user.target
```

(замените `USER` и путь). Затем:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now botpilot
sudo systemctl status botpilot
```

---

## Домен и HTTPS (nginx)

Пример `/etc/nginx/sites-available/botpilot`:

```nginx
server {
    listen 80;
    server_name ваш-домен.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/botpilot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Бесплатный HTTPS
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ваш-домен.ru
```

---

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `ANTHROPIC_API_KEY` | ключ для реальных ответов Claude (без него — демо-mock) |
| `ANTHROPIC_MODEL` | модель по умолчанию (необязательно) |
| `PORT` | порт (по умолчанию 3000) |

Готово — сервис доступен на вашем домене.
