# Community FBA Decision Memo

P1 Step 9A audits the community FBA surface in Nexus-Bio. This memo is a scientific honesty and architecture decision. It does not implement a new solver.

## Current Implementation Status

FBA logic currently appears in:

- `src/server/fbaEngine.ts`
- `app/api/fba/route.ts`
- `src/data/mockFBA.ts`
- `src/services/FBAAuthorityClient.ts`
- `src/components/tools/FBASimPage.tsx`

Community mode now uses a joint community LP with shared exchange metabolite pool constraints and weighted community biomass objective.

Evidence from code:

- `solveAuthorityCommunityFBA()` in `src/server/fbaEngine.ts` builds a joint LP with shared exchange metabolite pools (acetate, ethanol, succinate, lactate) and coupling constraints between species.
- Exchange fluxes are LP decision variables, not post-hoc scaled comparisons.
- Community growth uses a weighted community biomass objective, not a linear blend of independent solves.
- `app/api/fba/route.ts` emits community provenance as `toolId: "fbasim-community"` with `validityTier: "partial"`.
- `src/components/tools/FBASimPage.tsx` labels the mode as a joint community LP with shared exchange constraints.

Single-species FBA is separate. This memo does not change the single-species simplex LP path or its `partial` validity tier.

## Scientific Requirement For Real Community FBA

Real community FBA needs one shared optimization problem, not two independent host solves placed side by side. A scientifically stronger community model would need species-specific flux variables, species abundance or biomass variables, a common growth or community objective constraint, shared exchange metabolites, cross-feeding stoichiometric coupling, and constraints tying organism-level fluxes to community-level balances.

The current mode does not meet those requirements.

## Route Decision Table

| Route | What it means | Scientific truthfulness | Engineering cost | User value | Risk | When to choose |
|---|---|---|---|---|---|---|
| A. Full joint community LP | Implement a SteadyCom-like joint LP with species abundance variables, a common growth rate variable, shared exchange constraints, and toy-community tests. | Highest if implemented and tested. | High. Requires new formulation, solver coverage, and validation fixtures. | High for users who need actual community modeling. | High risk of subtle biological and numerical overclaiming. | Choose later only if community modeling becomes a core scientific claim. |
| B. Demo-only illustrative mode | Keep current two-species comparison but label it as demo-only and prevent formal community claims. | Honest for current code because it describes what the code actually does. | Low. Mostly docs, metadata, policy, and tests. | Moderate. Useful for education and workflow exploration. | Low if formal surfaces remain blocked for demo output. | Choose now for Step 9A. |
| C. Remove formal community mode | Remove or hide community mode from formal workflow and keep only single-species FBA supported. | Very high because no ambiguous community claim remains. | Medium. Requires UI/workflow pruning and possible user-facing changes. | Lower for users exploring co-culture ideas. | Product disruption and loss of exploratory affordance. | Choose if demo labeling is still too easy to misread. |

## Final Step 9A Recommendation

Recommend B now.

Keep the current community view only as a demo-only illustrative two-species comparison. Do not call it true community FBA, a joint community LP, SteadyCom-like, or a validated community model. Formal recommendation, protocol, export, and external-handoff claims from demo community output should remain blocked by claim-surface policy or future mode-specific policy.

Recommend A later only if a future Step 9C deliberately implements and tests a true joint community LP. Recommend C if the product cannot make the demo-only boundary clear enough.

## Decision Boundary

Implemented now:

- Decision memo for community FBA honesty.
- Documentation wording that separates single-species FBA from two-species demo mode.
- Tests that prevent community FBA overclaiming.

Not implemented now:

- No SteadyCom-like joint LP.
- No new LP solver.
- No species abundance variables.
- No common growth rate variable in a joint optimization.
- No shared exchange stoichiometric coupling.
- No export, protocol, recommendation, or external-handoff runtime enforcement.
- No UI redesign.

## Step 9B Implementation

Step 9B implements Route A (joint community LP) as the current product boundary:

- `src/domain/communityFbaBoundary.ts` records the mode-specific decision: single-species `fbasim` remains the partial-validity LP path, while `fbasim-community` is now a joint community LP with shared exchange metabolite pool constraints.
- The joint LP uses shared exchange metabolite pools (acetate, ethanol, succinate, lactate) with coupling constraints between species.
- Growth rate scaling factors (×0.061 E. coli, ×0.045 yeast) remain heuristic and not derived from literature.
- The toy-network model (10 reactions per species) is the primary remaining scientific limitation.
- The trust benchmark known-bad cases continue to block community output used as formal recommendations without proper caveats.

This implementation does not change the single-species FBA solver, the community heuristic computation, claim-surface runtime enforcement, exports, protocols, or routes. A future Step 9C may add mode-aware claim-surface policy handles if formal community output routing becomes explicit.

## Rollback Condition

If future joint community LP implementation fails, remains untested, or cannot be explained honestly, Nexus-Bio should keep the community mode demo-only or remove it from formal workflow surfaces.

## Non-Claims

- No SteadyCom equivalence unless implemented and tested.
- No validated community model claim.
- No wet-lab validation claim.
- No formal external-handoff claim from community output.
