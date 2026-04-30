#!/usr/bin/env bash
set -euo pipefail

npm run benchmark:trust:validate
npm run benchmark:trust:evaluate
npm run benchmark:trust:report
npm run benchmark:public
