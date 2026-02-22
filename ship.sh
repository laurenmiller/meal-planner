#!/bin/bash
set -e

PROD_REF="dnletmkgmxiebcstwkqa"

# Use .commit-msg buffer if it exists and has content, otherwise fall back to arg or "Update"
COMMIT_MSG_FILE=".commit-msg"
if [ -s "$COMMIT_MSG_FILE" ]; then
  MSG=$(cat "$COMMIT_MSG_FILE")
else
  MSG="${1:-Update}"
fi

# Deploy edge functions to prod
./deploy-functions.sh "$PROD_REF"

# Build, commit, push, deploy to gh-pages
git add .
git commit -m "$MSG"
> "$COMMIT_MSG_FILE"
git push
npm run deploy
