#!/usr/bin/env bash
# Pings public.keepalive() so the project's Supabase database never
# reaches 7 days without activity. .github/workflows/keepalive.yml runs
# this script as its one step, passing SUPABASE_URL,
# SUPABASE_PUBLISHABLE_KEY and KEEPALIVE_STRICT through the environment
# -- see supabase/README.md's "Keep-alive ping" section for the outcome
# table (secrets x KEEPALIVE_STRICT -> result).
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-}"
KEEPALIVE_STRICT="${KEEPALIVE_STRICT:-}"

# Validate KEEPALIVE_STRICT first, before looking at the secrets at all:
# a mistyped value (a stray "1", "yes", or leading/trailing space) must
# never be silently swallowed into either mode. KEEPALIVE_STRICT is a
# repository VARIABLE, not a secret, so it is safe to echo back verbatim
# below.
keepalive_strict_lower=$(printf '%s' "$KEEPALIVE_STRICT" | tr '[:upper:]' '[:lower:]')
case "$keepalive_strict_lower" in
  '' | 'false')
    strict=false
    ;;
  'true')
    strict=true
    ;;
  *)
    echo "::error::KEEPALIVE_STRICT must be \"true\", \"false\", or unset/empty (case-insensitive); got \"$KEEPALIVE_STRICT\"."
    exit 1
    ;;
esac

# Exactly one secret set is always a misconfiguration -- a partial setup,
# or one secret removed after go-live -- and must fail loudly no matter
# what KEEPALIVE_STRICT says. It must never be treated the same as
# both-missing (dormant).
if [ -n "$SUPABASE_URL" ] && [ -z "$SUPABASE_PUBLISHABLE_KEY" ]; then
  echo "::error::Keep-alive is misconfigured: VITE_SUPABASE_URL is set but VITE_SUPABASE_PUBLISHABLE_KEY is not. Set both repository secrets, or clear both to go back to dormant -- see supabase/README.md."
  exit 1
fi
if [ -z "$SUPABASE_URL" ] && [ -n "$SUPABASE_PUBLISHABLE_KEY" ]; then
  echo "::error::Keep-alive is misconfigured: VITE_SUPABASE_PUBLISHABLE_KEY is set but VITE_SUPABASE_URL is not. Set both repository secrets, or clear both to go back to dormant -- see supabase/README.md."
  exit 1
fi

if [ -z "$SUPABASE_URL" ] && [ -z "$SUPABASE_PUBLISHABLE_KEY" ]; then
  if [ "$strict" = "true" ]; then
    echo "::error::Keep-alive is set to strict mode (KEEPALIVE_STRICT=true) but VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are both unset. Set both repository secrets -- see supabase/README.md."
    exit 1
  fi
  echo "::notice::Keep-alive is dormant: the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY repository secrets are not set yet. There is no Supabase project to ping until both secrets are configured -- see supabase/README.md."
  exit 0
fi

# --retry/--retry-all-errors retry a transient failure -- safe because
# keepalive() is an idempotent upsert, so a retried call can never
# double-book anything. --connect-timeout/--max-time bound every single
# attempt so a hung request can never eat the workflow job's own
# timeout-minutes budget.
#
# --fail is deliberately dropped: without it, curl does not treat a
# received HTTP status as an error at all, so --retry-all-errors only
# retries transport-level failures (a refused/dropped connection, DNS,
# a timeout) while --retry still retries curl's own transient HTTP codes
# (408, 429, 500, 502, 503, 504). A 401 (wrong key) or 404 (wrong URL) is
# neither, so it fails after exactly one request instead of wasting
# three retries before the run shows red.
#
# The response body goes to a regular temporary file, not /dev/null: before
# each retry curl truncates its --output file so the next attempt does not
# append to the previous body, and on Linux truncating /dev/null fails, which
# made every retry end with curl exit 23 instead of trying again.
body_file=$(mktemp)
trap 'rm -f "$body_file"' EXIT
set +e
http_status=$(curl --silent --show-error --request POST \
  --connect-timeout 10 --max-time 20 --retry 3 --retry-all-errors \
  --output "$body_file" --write-out '%{http_code}' \
  "$SUPABASE_URL/rest/v1/rpc/keepalive" \
  --header "apikey: $SUPABASE_PUBLISHABLE_KEY")
curl_exit=$?
set -e

if [ "$curl_exit" -ne 0 ]; then
  echo "::error::Keep-alive ping failed: the final attempt failed at the transport level (curl exit $curl_exit); see curl's own error above."
  exit "$curl_exit"
fi

case "$http_status" in
  2??)
    echo "Keep-alive ping succeeded (HTTP $http_status)."
    ;;
  *)
    # The response body is never printed: it is remote, untrusted
    # content and could otherwise inject workflow commands into the log.
    echo "::error::Keep-alive ping failed: the Supabase project responded with HTTP $http_status."
    exit 1
    ;;
esac
