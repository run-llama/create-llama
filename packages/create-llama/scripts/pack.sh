#!/usr/bin/env bash

pnpm pack && npm install -g $(pwd)/$(ls ./*.tgz | head -1)