# Demo Video Script (3–5 Minutes)

## 0:00–0:30 Opening

Hi, I am presenting Nexus-Bio, an assumption-gated synthetic biology learning workbench.
This is not a claim that every model here is a high-fidelity scientific implementation.
The goal is to show a transparent runtime where validity, assumptions, and provenance are visible before users trust outputs.

## 0:30–1:00 Problem

A common issue in AI bio-tools is that interface confidence can hide model limitations.
Users may treat demo outputs as if they are equivalent to validated inference.
Nexus-Bio addresses this by attaching trust metadata to tool outputs and enforcing runtime gates when evidence quality is weak.

## 1:00–2:00 Workflow Demo

I start from the pathway workflow and move through FBA, thermodynamics, cell-free, and multi-omics views.
The artemisinin showcase provides a concrete context, but this is still a software transparency demonstration.
As I move between tools, each module shows what kind of computation it represents: real, partial, or demo.

## 2:00–3:00 Runtime Gating

Now I highlight runtime gating behavior.
If a source output is demo-tier, the system allows demo-to-demo handoff with warning labels.
If a demo output tries to feed a partial or real target, the gate blocks it.
If provenance is missing, the output is treated as untrusted and is blocked where provenance is required.

## 3:00–4:00 Provenance and Assumptions

Each major tool run writes a `runProvenance` snapshot with assumptions and evidence context.
Assumptions are severity-tagged, including blocking assumptions for known weak or placeholder methods.
This means downstream modules can reason about trust state, not just data shape.
The user can see where an output came from and why it should or should not be treated as strong evidence.

## 4:00–5:00 Closing

Nexus-Bio is currently a transparent learning workbench, not a fully validated research platform.
The contribution is not that every model is a high-fidelity scientific implementation.
The contribution is that Nexus-Bio refuses to hide uncertainty.
It makes trust boundaries explicit, so users can learn and iterate without confusing demonstration outputs with validated biological conclusions.
