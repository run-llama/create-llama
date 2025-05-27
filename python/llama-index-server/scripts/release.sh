#!/bin/bash

# Release script for llama-index-server Python package used by CI
# Checks if the current version is different from PyPI before publishing

set -e  # Exit on any error

# Get current version from pyproject.toml
CURRENT_VERSION=$(grep -E '^version = ' pyproject.toml | sed 's/version = "\(.*\)"/\1/')
echo "Current version: $CURRENT_VERSION"

# Get published version from PyPI
echo "Checking PyPI for existing version..."
PUBLISHED_VERSION=$(curl -s "https://pypi.org/pypi/llama-index-server/json" | jq -r '.info.version' 2>/dev/null || echo "null")

if [ "$PUBLISHED_VERSION" = "null" ]; then
    echo "Package not found on PyPI, assuming first release"
    SHOULD_PUBLISH=true
elif [ "$CURRENT_VERSION" != "$PUBLISHED_VERSION" ]; then
    echo "Published version: $PUBLISHED_VERSION"
    echo "Version has changed, will publish"
    SHOULD_PUBLISH=true
else
    echo "Published version: $PUBLISHED_VERSION"
    echo "Version unchanged, skipping publish"
    SHOULD_PUBLISH=false
fi

if [ "$SHOULD_PUBLISH" = true ]; then
    echo "Publishing Python package version $CURRENT_VERSION"
    uv publish
    echo "Python package published successfully!"
else
    echo "No Python package changes detected, skipping Python release"
fi 