#!/bin/bash

set -e

if [ "$ENVIRONMENT" = "dev" ]; then
    echo "Running Development mode"
    npm run dev
else
    echo "Running Production mode"
    npm start
fi