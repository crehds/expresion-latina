#!/usr/bin/env bash
# Pings public.keepalive() so the project's Supabase database never
# reaches 7 days without activity. .github/workflows/keepalive.yml runs
# this script as its one step, passing SUPABASE_URL,
# SUPABASE_PUBLISHABLE_KEY and KEEPALIVE_ENABLED through the environment
# -- see supabase/README.md's "Keep-alive ping" section for what each
# combination does.
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-}"
KEEPALIVE_ENABLED="${KEEPALIVE_ENABLED:-}"

# Exactly one secret set is always a misconfiguration -- a partial setup,
# or one secret removed after go-live -- and must fail loudly no matter
# what KEEPALIVE_ENABLED says. It must never be treated the same as
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
  if [ "$KEEPALIVE_ENABLED" = "true" ]; then
    echo "::error::Keep-alive is set to strict mode (the KEEPALIVE_ENABLED repository variable is \"true\") but VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are both unset. Set both repository secrets -- see supabase/README.md."
    exit 1
  fi
  echo "::notice::Keep-alive is dormant: the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY repository secrets are not set yet. There is no Supabase project to ping until both secrets are configured -- see supabase/README.md."
  exit 0
fi

# --retry/--retry-all-errors retry a transient failure, including a
# non-2xx response -- safe because keepalive() is an idempotent upsert,
# so a retried call can never double-book anything. --connect-timeout/
# --max-time bound every single attempt so a hung request can never eat
# the workflow job's own timeout-minutes budget.
curl --fail --silent --show-error --request POST \
  --connect-timeout 10 --max-time 20 --retry 3 --retry-all-errors \
  "$SUPABASE_URL/rest/v1/rpc/keepalive" \
  --header "apikey: $SUPABASE_PUBLISHABLE_KEY"
