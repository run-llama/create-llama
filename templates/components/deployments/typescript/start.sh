#!/bin/bash

set -e

if [ "$ENVIRONMENT" = "dev" ]; then
    echo "Running Development mode"
    pnpm dev
else
    echo "Running Production mode"
    pnpm start
fi