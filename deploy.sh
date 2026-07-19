#!/usr/bin/env bash
# Однокомандный деплой Smartbot AI на Ubuntu/Debian через Docker.
#
# Использование (на сервере):
#   curl -fsSL https://raw.githubusercontent.com/joker03r-ai/1/claude/screenshot-analysis-recreation-6yze8d/deploy.sh | bash
# либо, если репозиторий уже склонирован:
#   ANTHROPIC_API_KEY=sk-ant-xxx ./deploy.sh
#
# Переменные окружения (необязательно):
#   ANTHROPIC_API_KEY  — ключ для реальных ответов Claude (без него — демо-режим)
#   PORT               — внешний порт (по умолчанию 3000)
#   BRANCH             — ветка (по умолчанию claude/screenshot-analysis-recreation-6yze8d)

set -euo pipefail

REPO="https://github.com/joker03r-ai/1.git"
BRANCH="${BRANCH:-claude/screenshot-analysis-recreation-6yze8d}"
DIR="${DIR:-smartbot}"
PORT="${PORT:-3000}"
NAME="smartbot"

echo "==> Проверяю Docker…"
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Docker не найден, устанавливаю…"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker || true
fi

echo "==> Получаю код (ветка $BRANCH)…"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" checkout "$BRANCH"
  git -C "$DIR" pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

echo "==> Собираю Docker-образ…"
docker build -t "$NAME" .

echo "==> Перезапускаю контейнер…"
docker rm -f "$NAME" 2>/dev/null || true

ENV_ARGS=()
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  ENV_ARGS+=( -e "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" )
  echo "==> ANTHROPIC_API_KEY задан — реальный Claude включён."
else
  echo "==> ANTHROPIC_API_KEY не задан — чат в демо-режиме."
fi

docker run -d --name "$NAME" --restart unless-stopped \
  -p "$PORT:3000" \
  "${ENV_ARGS[@]}" \
  "$NAME"

echo ""
echo "==> Готово! Проверка:"
sleep 2
curl -sS -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:$PORT" || true
echo "==> Сервис доступен на порту $PORT. Логи: docker logs -f $NAME"
