#!/usr/bin/env bash

# build dist/index.js file
pnpm run build:ncc

# add shebang to the top of dist/index.js
# XXX: Windows needs a space after `node` to work correctly
# Note: ncc can handle shebang but it didn't work with Windows in our tests
echo '#!/usr/bin/env node ' | cat - dist/index.js >temp && mv temp dist/index.js

# make dist/index.js executable
chmod +x dist/index.js
