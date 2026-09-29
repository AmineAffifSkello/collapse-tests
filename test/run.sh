#!/usr/bin/env bash
# Banc headless: rejoue le markup GitHub d'une page /pull/<n>/changes et pilote
# Chrome via CDP. Aucune dependance npm.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
PORT=8765
CDP_PORT=9223
PROFILE="$(mktemp -d)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

cp "$ROOT/content.js" "$HERE/fixture/content.js"
cp "$ROOT/content.css" "$HERE/fixture/content.css"

cleanup() {
  { [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID"; } 2>/dev/null || true
  { [[ -n "${CHROME_PID:-}" ]] && kill "$CHROME_PID"; } 2>/dev/null || true
  sleep 1
  rm -rf "$PROFILE" "$HERE/fixture/content.js" "$HERE/fixture/content.css" 2>/dev/null || true
}
trap cleanup EXIT

(cd "$HERE/fixture" && python3 -m http.server $PORT >/dev/null 2>&1) &
SERVER_PID=$!

"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --remote-debugging-port=$CDP_PORT --user-data-dir="$PROFILE" about:blank >/dev/null 2>&1 &
CHROME_PID=$!

sleep 4
if ! node "$HERE/drive.mjs"; then
  echo
  echo "Chrome n'a pas ouvert son port de debug (certains environnements l'interdisent)."
  echo "Repli manuel, le banc tourne dans n'importe quel navigateur :"
  echo "  cp content.js content.css test/fixture/"
  echo "  (cd test/fixture && python3 -m http.server 8765)"
  echo "  ouvrir http://localhost:8765/acme/widget-service/pull/42/changes/"
  echo "  les resultats s'affichent dans la page et dans window.__RESULTS__"
  exit 1
fi
