#!/usr/bin/env bash
#
# Contour Form 1 — local test server
#
# Serves the repo root over http (the HubSpot embed script won't run from
# file://) and opens test/local-test.html, which loads the LOCAL css/form1.css
# and js/form1.js so uncommitted changes are testable immediately.
#
# Usage:
#   ./test/serve.sh start     start server and open the test page
#   ./test/serve.sh stop      stop the server
#   ./test/serve.sh status    show whether the server is running
#   ./test/serve.sh restart   stop then start
#
# Port defaults to 8000; override with e.g. PORT=8080 ./test/serve.sh start

set -euo pipefail

PORT="${PORT:-8000}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE_URL="http://localhost:${PORT}/test/local-test.html"

server_pid() {
  # Only match a listener on our port so we never kill an unrelated process.
  lsof -ti "tcp:${PORT}" -s tcp:LISTEN 2>/dev/null || true
}

start() {
  local pid
  pid="$(server_pid)"
  if [ -n "$pid" ]; then
    echo "Already running on port ${PORT} (pid ${pid})."
  else
    (cd "$REPO_ROOT" && nohup python3 -m http.server "$PORT" >/dev/null 2>&1 &)
    # Wait for the listener to come up before opening the browser.
    for _ in $(seq 1 20); do
      [ -n "$(server_pid)" ] && break
      sleep 0.25
    done
    pid="$(server_pid)"
    if [ -z "$pid" ]; then
      echo "Failed to start server on port ${PORT}." >&2
      exit 1
    fi
    echo "Serving ${REPO_ROOT} on port ${PORT} (pid ${pid})."
  fi
  echo "Test page: ${PAGE_URL}"
  command -v open >/dev/null && open "$PAGE_URL"
}

stop() {
  local pid
  pid="$(server_pid)"
  if [ -z "$pid" ]; then
    echo "Nothing running on port ${PORT}."
  else
    kill $pid
    echo "Stopped server on port ${PORT} (pid ${pid})."
  fi
}

status() {
  local pid
  pid="$(server_pid)"
  if [ -n "$pid" ]; then
    echo "Running on port ${PORT} (pid ${pid}) — ${PAGE_URL}"
  else
    echo "Not running on port ${PORT}."
  fi
}

case "${1:-}" in
  start)   start ;;
  stop)    stop ;;
  status)  status ;;
  restart) stop; start ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}" >&2
    exit 1
    ;;
esac
