#!/bin/bash
set -e

# Deploy all Supabase Edge Functions to the given project
# Usage: ./deploy-functions.sh <project-ref>

REF="${1:?Usage: ./deploy-functions.sh <project-ref>}"

echo "Deploying edge functions to project $REF…"

for dir in supabase/functions/*/; do
  fn=$(basename "$dir")
  echo "  → $fn"
  npx supabase functions deploy "$fn" --no-verify-jwt --project-ref "$REF"
done

echo "Done."
