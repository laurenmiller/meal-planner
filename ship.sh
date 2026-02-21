#!/bin/bash
set -e

MSG="${1:-Update}"

git add .
git commit -m "$MSG"
git push
npm run deploy
