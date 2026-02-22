#!/bin/bash
set -e

DEV_REF="hnudgomeslwdyycfweok"

# Deploy edge functions to dev project
./deploy-functions.sh "$DEV_REF"

# Start dev server
npm run dev -- --host
