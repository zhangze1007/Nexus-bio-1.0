# KEGG Commercial License Request — Draft Template

**Status:** DRAFT — Requires review and personalization before sending
**Created:** 2026-06-25
**Action Required:** Customize highlighted fields, then send to Kanehisa Laboratories

---

## Contact Information

**License Provider:** Kanehisa Laboratories, Kyoto University
**Website:** https://www.kegg.jp/kegg/legal.html
**Email:** kegg@kuicr.kyoto-u.ac.jp (or use the contact form at kegg.jp)

---

## Draft Email

**Subject:** Commercial License Inquiry — KEGG Database for Synthetic Biology Platform

---

Dear Kanehisa Laboratories,

I am writing to inquire about obtaining a commercial license for the KEGG (Kyoto Encyclopedia of Genes and Genomes) database for use in our synthetic biology platform, **Nexus-Bio**.

### About Nexus-Bio

Nexus-Bio is an AI-powered synthetic biology platform that assists researchers in metabolic pathway design, flux balance analysis, enzyme engineering, and genome minimization. The platform is currently deployed as a web application at nexus-bio-1-0.vercel.app.

### KEGG Data Usage

Our platform uses KEGG data in the following ways:

1. **Pathway Discovery Engine** (`pathwayDiscoveryEngine.ts`): Contains a curated reaction database with 500+ reactions referencing KEGG reaction IDs (e.g., R00200, R00756) and EC numbers. These are used for A* graph search-based pathway discovery with thermodynamic feasibility scoring.

2. **KEGG REST API Proxy** (`app/api/kegg/route.ts`): Proxies requests to the KEGG REST API (`rest.kegg.jp`) for:
   - Compound search by name
   - Pathway-to-compound linkage
   - Reaction detail retrieval

3. **KEGG Client Library** (`src/services/database/keggClient.ts`): Client-side library for accessing KEGG data through our proxy.

### Intended Use

**[SELECT ONE:]**
- [ ] **SaaS platform** — Users access KEGG data through our web interface; no data redistribution
- [ ] **API service** — KEGG data served via our API to third-party applications
- [ ] **Data redistribution** — KEGG-derived data embedded in downloadable outputs

### Specific Questions

1. What are the licensing terms and fees for commercial use of the KEGG REST API?
2. Are there different licensing tiers based on usage volume or organization size?
3. Does the license cover both live API access and cached/hardcoded KEGG data (reaction IDs, EC numbers)?
4. What attribution requirements apply to commercial use?
5. Is there a startup or academic spin-off discount available?

### Organization Details

**Organization:** [YOUR ORGANIZATION NAME]
**Type:** [Startup / SME / Enterprise / Academic Spin-off]
**Country:** [YOUR COUNTRY]
**Website:** [YOUR WEBSITE]
**Primary Use Case:** [BRIEF DESCRIPTION]

We are committed to complying with KEGG's licensing terms and are happy to provide any additional information needed.

Thank you for your time and consideration.

Best regards,
[YOUR NAME]
[YOUR TITLE]
[YOUR EMAIL]

---

## Next Steps

1. **Customize** the highlighted `[FIELDS]` above
2. **Select** the intended use type (SaaS/API/redistribution)
3. **Send** to kegg@kuicr.kyoto-u.ac.jp
4. **Document** the response in this file for future reference
5. **Update** `THIRD_PARTY_LICENSES.md` with the licensing outcome

## Alternative: Free Academic Use

If Nexus-Bio is used exclusively for academic research (non-commercial), the KEGG REST API is free to use without a license. The current deployment (Vercel Hobby plan, free tier) may qualify as non-commercial research use. Verify with your institution's technology transfer office.

## Reference

- KEGG License Terms: https://www.kegg.jp/kegg/legal.html
- KEGG REST API: https://rest.kegg.jp/
- Kanehisa & Goto (2000) Nucleic Acids Res 28:27-30
