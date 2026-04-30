# Replay

The proof package replays from repository-root scripts. It includes a local Python second implementation for trust-runtime protocol comparison, but it is not a third-party implementation and does not reimplement scientific tools.

Run:

```bash
npm run proof:replay
```

This command runs trust benchmark validation, policy benchmark evaluation, Step 15 trust metrics generation, Step 17 public benchmark generation, Step 19 Python reference consistency comparison, refreshes copied report artifacts in this folder, and then runs the proof package integrity check.

To run only the Python second implementation comparison:

```bash
npm run reference:py:compare
```

For the shorter integrity-only check:

```bash
npm run proof:check
```

Replay uses local files and installed dependencies. It does not require network access after dependencies are installed. Any failing command exits non-zero and should be inspected directly.
