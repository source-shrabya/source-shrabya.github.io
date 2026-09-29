#!/bin/sh
# Runs the browser tests in headless Chrome and fails if any check fails.
cd "$(dirname "$0")" || exit 1
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
status=0
for t in *.test.html; do
  out=$("$CHROME" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=10000 \
    --dump-dom "file://$PWD/$t" 2>/dev/null | sed -n 's:.*<title>\(.*\)</title>.*:\1:p' | tr '|' '\n' | sed 's/^ *//')
  echo "$t"; echo "$out" | sed 's/^/  /'
  case "$out" in *FAIL*|running|'') status=1 ;; esac
done
exit $status
