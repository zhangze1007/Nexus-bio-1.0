# Benchmark Assets

This directory contains copies of the local trust-runtime benchmark assets:

- `trust-runtime-cases/p0-step-6-cases.json`
- `expected_labels.csv`
- `trust-runtime-schema.json`

Run benchmark replay from the repository root:

```bash
npm run benchmark:trust:validate
npm run benchmark:trust:evaluate
npm run benchmark:trust:report
npm run benchmark:public
```

Or run:

```bash
npm run proof:replay
```

The expected labels are curated local trust-runtime labels. They are not wet-lab truth labels and must not be edited to improve report numbers.
