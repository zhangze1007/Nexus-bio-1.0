# Master Optimization Roadmap

> **For agentic workers:** This is the master roadmap. Each direction has its own detailed sub-plan. Execute sub-plans in order of priority.

**Goal:** Systematically upgrade Nexus-Bio from demo/partial to research-grade across 6 dimensions.

**Execution Order:**
1. 🔴 Direction A: Real Database Data Replacement (sub-plan A)
2. 🔴 Direction B: Unified Report System (sub-plan B)
3. 🟡 Direction C: E2E Tests + CI Hardening (sub-plan C)
4. 🟡 Direction D: Inter-Tool Automatic Data Flow (sub-plan D)
5. 🟢 Direction E: Python Reference Implementation (sub-plan E)
6. 🟢 Direction F: External Reviewer Replay Tools (sub-plan F)

---

## Sub-Plans

| Direction | Plan File | Tasks | Priority | Est. Effort |
|-----------|-----------|-------|----------|-------------|
| A | `2026-06-12-dirA-database-data.md` | 12 | 🔴 High | Phase 1-3 |
| B | `2026-06-12-dirB-unified-report.md` | 8 | 🔴 High | Phase 1-2 |
| C | `2026-06-12-dirC-e2e-ci.md` | 6 | 🟡 Medium | Phase 1 |
| D | `2026-06-12-dirD-inter-tool-flow.md` | 8 | 🟡 Medium | Phase 1-2 |
| E | `2026-06-12-dirE-python-reference.md` | 5 | 🟢 Low | Phase 1 |
| F | `2026-06-12-dirF-reviewer-replay.md` | 5 | 🟢 Low | Phase 1 |

## Dependency Graph

```
A (database data) ──► B (report system needs real data)
                    ──► D (data flow needs real payloads)
A + B ──► C (E2E tests cover real data + reports)
A + D ──► E (Python ref needs real data contracts)
All ──► F (reviewer replay needs everything)
```

## Success Criteria

- [ ] All tools use real database data when available, mock fallback when not
- [ ] One-click export generates a complete scientific report
- [ ] E2E tests cover the full golden path workflow
- [ ] Tools automatically consume upstream payloads without manual wiring
- [ ] Python reference implementation evaluates benchmark cases
- [ ] External reviewer can replay and verify all proof artifacts
