#!/bin/bash

set -e

# Check if ENVIRONMENT=dev
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "Running Development Server"
    pnpm dev
else
    echo "Running Production Server"
    pnpm build
    pnpm start
fi