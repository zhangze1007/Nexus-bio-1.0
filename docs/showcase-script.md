# Three-Minute Showcase Script

## 0:00-0:25 Opening

Nexus-Bio is an assumption-gated scientific inference runtime for synthetic biology workflows.

This showcase is not about proving that Nexus-Bio optimizes artemisinin production. It is about showing that the runtime can tell the difference between a traceable partial output and a weak or demo output trying to become a stronger claim.

## 0:25-0:55 Problem

Scientific AI interfaces can make weak outputs look certain. A demo thermodynamics table or illustrative workflow can appear polished enough that a user might treat it as a recommendation, protocol, or external handoff.

Nexus-Bio addresses that product risk by attaching validity, assumptions, provenance, and gate decisions to outputs before they influence the next step.

## 0:55-1:40 Safe Path

The safe path uses an artemisinin educational trace. A partial pathway context enters the workbench. The output carries assumptions, local demo evidence IDs, and provenance IDs.

When that partial output asks for an allowed surface, the trust policy engine returns `ok`. The point is not that the biology is proven. The point is that the output has enough runtime metadata for the requested surface.

## 1:40-2:25 Blocked Path

Now the blocked path uses CETHX demo thermodynamics. CETHX can still be explored inside the workbench as demo context.

But when the same kind of demo thermodynamics tries to become a protocol-like claim, the policy engine blocks it with `DEMO_OUTPUT_PROTOCOL_BLOCKED`.

That block does not say the biological hypothesis is false. It says the output is not strong enough for that claim surface.

## 2:25-3:00 Takeaway

The product truth is simple: Nexus-Bio does not only generate scientific-looking outputs. It records trust metadata and refuses unsupported propagation.

Safe partial outputs can move forward with provenance. Demo or weak outputs can remain explorable, but they cannot silently become protocols, exports, external handoffs, or stronger downstream claims.

This is local trust-runtime behavior. It is not wet-lab validation, scientific validation, external benchmark validation, or proof of pathway optimization.
