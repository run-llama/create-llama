#!/bin/bash

# Release script for llama-index-server Python package used by CI
# Only publishes if PYTHON_RELEASE_VERSION environment variable is set

set -e  # Exit on any error

if [ -n "$PYTHON_RELEASE_VERSION" ]; then
    echo "Releasing Python package version $PYTHON_RELEASE_VERSION"
    uv publish
    echo "Python package published successfully!"
else
    echo "No Python package changes detected, skipping Python release"
fi 