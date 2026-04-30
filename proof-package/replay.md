# Replay

The proof package replays from repository-root scripts. It does not contain a second trust-runtime implementation.

Run:

```bash
npm run proof:replay
```

This command runs trust benchmark validation, policy benchmark evaluation, Step 15 trust metrics generation, Step 17 public benchmark generation, refreshes copied report artifacts in this folder, and then runs the proof package integrity check.

For the shorter integrity-only check:

```bash
npm run proof:check
```

Replay uses local files and installed dependencies. It does not require network access after dependencies are installed. Any failing command exits non-zero and should be inspected directly.
