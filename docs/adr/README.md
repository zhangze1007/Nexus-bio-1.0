# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records for Nexus-Bio 1.0.

ADRs document key architectural decisions, their context, and consequences. They help new team members understand *why* things are built the way they are.

## Index

| # | Title | Status |
|---|-------|--------|
| [001](001-groq-as-primary-ai-provider.md) | Groq as Primary AI Provider | Accepted |
| [002](002-sqlite-ephemeral-with-localstorage-fallback.md) | SQLite Ephemeral with localStorage Fallback | Accepted |
| [003](003-edge-vs-nodejs-runtime-selection.md) | Edge vs Node.js Runtime Selection | Accepted |

## How to write an ADR

1. Copy `000-template.md` to `NNN-title.md`
2. Fill in all sections
3. Submit as a PR for team review
4. Once accepted, update this index

## When to write an ADR

- Choosing a technology or library
- Defining a system boundary or API contract
- Establishing a pattern that will be repeated
- Making a decision with significant tradeoffs
- Overturning a previous ADR
