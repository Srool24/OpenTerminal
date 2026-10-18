#!/usr/bin/env bash
# Starts OpenTerminal (if it isn't already running) and opens it in the browser.
cd "$(dirname "$(readlink -f "$0")")" || exit 1
URL="http://localhost:3000"

up() { curl -s -o /dev/null -m 2 "$URL"; }

if ! up; then
  if ss -ltn | grep -q ':3000 '; then
    notify-send "OpenTerminal" "פורט 3000 תפוס על ידי תוכנה אחרת (למשל open-webui). עצור אותה ונסה שוב." 2>/dev/null
    exit 1
  fi
  nohup npm run dev > /tmp/openterminal.log 2>&1 &
  for _ in $(seq 1 60); do up && break; sleep 1; done
fi
xdg-open "$URL" >/dev/null 2>&1
