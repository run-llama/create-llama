#!/usr/bin/env bash

# build dist/index.js file
npm run clean && ncc build ./index.ts -o ./dist/ --minify --no-cache --no-source-map-register

# add shebang to the top of dist/index.js
sed -i '1s/^/#!\/usr\/bin\/env node\n\n/' ./dist/index.js