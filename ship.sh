#!/bin/bash
set -e

PROD_REF="dnletmkgmxiebcstwkqa"
MSG="${1:-Update}"

# Deploy edge functions to prod
./deploy-functions.sh "$PROD_REF"

# Build, commit, push, deploy to gh-pages
git add .
git commit -m "$MSG"
git push
npm run deploy
