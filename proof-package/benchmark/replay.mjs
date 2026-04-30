#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const commands = [
  ['npm', ['run', 'benchmark:trust:validate']],
  ['npm', ['run', 'benchmark:trust:evaluate']],
  ['npm', ['run', 'benchmark:trust:report']],
  ['npm', ['run', 'benchmark:public']],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
