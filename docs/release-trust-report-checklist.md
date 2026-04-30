# Release Trust Report Checklist

This checklist is for local release preparation. It does not create CI, publish a proof package, or make a third-party benchmark claim.

1. Run `npm run benchmark:trust:validate`.
2. Run `npm run benchmark:trust:evaluate`.
3. Run `npm run benchmark:trust:report`.
4. Open `reports/trust-metrics/latest.json`.
5. Check `mismatches` and resolve or document any mismatch honestly.
6. Confirm `demoLeakageRate` is understood before release notes mention trust-runtime behavior.
7. Confirm no homepage UI/UX files changed unless the release explicitly includes homepage work.
8. Confirm no scientific algorithm, validity tier, or claim-surface policy was changed only to improve report numbers.
9. Attach or link the local trust metrics report in release notes with local-only scope language.
