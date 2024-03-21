#!/usr/bin/env bash

# build dist/index.js file
npm run clean && ncc build ./index.ts -o ./dist/ --minify --no-cache --no-source-map-register

# add shebang to the top of dist/index.js
echo '#!/usr/bin/env node ' | cat - dist/index.js > temp && mv temp dist/index.js