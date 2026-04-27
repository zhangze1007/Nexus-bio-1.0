# Nexus-Bio Phase 1 收尾报告

生成日期：2026-04-27  
分支：`main`  
当前 HEAD：`ad4f823 Add MIT LICENSE file`  
报告类型：技术交接 / 本地可下载报告  

---

## 1. Phase 1 总览

Phase 1 的目标是为 Nexus-Bio 的 4-stage synthetic biology workbench 建立“假设、证据、运行 provenance”基础，而不是重写科学算法或提升 demo-tier 工具等级。

本阶段完成了三条主线：

1. 建立 assumption-gated runtime 的类型和静态 registry。
2. 让 workbench payload bus 能携带每次运行产生的 `runProvenance`。
3. 对仍是 demo 的 CETHX 做明确科学告知：文件级 provenance docstring 和页面顶部 warning banner。

当前仓库状态：

- `main` 已同步到 `origin/main`。
- Phase 1.1、1.2、1.3、1.4 均已完成并推送。
- 额外 metadata commit 已添加 MIT `LICENSE` 文件。
- CETHX、CellFree、MultiO、`fbasim-community` 仍保持 `demo` tier；Phase 1 没有进行 tier 升级。

---

## 2. 完成明细

### 2.1 Phase 1.1 — Assumption schema

新增 `src/types/assumptions.ts`，定义四个核心接口：

- `ToolAssumption`
- `Evidence`
- `ProvenanceEntry`
- `AssumptionViolation`

这些类型只提供 schema，不包含 runtime detector 或 UI gating 逻辑。设计意图记录在 `docs/assumption-schema.md`，并明确说明 Phase 1 不做 assumption inheritance graph、不做自动 violation rules、不做 payload migration、不做 tier upgrades。

### 2.2 Phase 1.2 — Tool assumption registry

新增 `src/components/tools/shared/toolAssumptions.ts`。

完成状态：

- 覆盖 14 个工具。
- 实际 registry 有 16 个 entries：14 个工具 + `fbasim-single` + `fbasim-community` 两个 sub-tier。
- 共记录 56 条 assumptions。
- demo-tier 工具有 blocking assumptions，但没有因此升级 tier。
- 保留 legacy `fbasim` entry 以兼容旧调用点。
- 新增 canonical sub-tier：
  - `fbasim-single`：partial，用于 single-species LP provenance。
  - `fbasim-community`：demo，用于 community/two-species mode 后续 gating。

关键保留约束：

- 没有修改 `toolValidity.ts`。
- 没有把 CETHX、CellFree、MultiO、`fbasim-community` 从 demo 提升为 partial。
- 没有编造 DOI 或数据来源。

### 2.3 Phase 1.3 — Payload bus + FBAsim provenance

新增 `src/utils/provenance.ts`，提供：

```ts
createProvenanceEntry(args): ProvenanceEntry
```

该 helper 会在调用时从 `TOOL_VALIDITY` 读取当前 tool validity tier，并生成包含 `toolId`、`timestamp`、`inputAssumptions`、`outputAssumptions`、`evidence`、`validityTier`、`upstreamProvenance` 的 execution record。

修改 `src/store/workbenchPayloads.ts`：

```ts
export interface WorkbenchPayloadBase {
  validity: PayloadValidity;
  runProvenance?: ProvenanceEntry;
}
```

字段名使用 `runProvenance`，不是 `provenance`。原因是 `ProEvolWorkbenchPayload` 已经有历史字段：

```ts
provenance: 'simulated' | 'inferred' | 'literature-backed' | 'user-supplied';
```

修改 `app/api/fba/route.ts`：

- single-species path 返回 `provenance`。
- `toolId` 使用 canonical sub-tier `fbasim-single`。
- 输出 assumptions 使用：
  - `fbasim-single.steady_state`
  - `fbasim-single.biomass_objective`
  - `fbasim-single.no_regulation`
  - `fbasim-single.simplex_real`
- evidence 使用 `source: 'computation'` 和 `confidence: 'high'`。

修改客户端 FBA write site：

- `src/services/FBAAuthorityClient.ts` 新增保留 provenance 的 client wrapper。
- `src/components/tools/FBASimPage.tsx` 将 API 返回的 `provenance` 写入 `FBAWorkbenchPayload.runProvenance`。

### 2.4 Phase 1.4 — CETHX 文档化和 UI banner

修改 `src/data/mockCETHX.ts`，在文件最顶部新增 `@scientific_provenance` JSDoc block，包含：

- `REFERENCE`
- `NOT_IMPLEMENTED`
- `KNOWN_LIMITATIONS`
- `VALIDITY_TIER: demo`
- `BLOCKING_ASSUMPTIONS`

其中明确记录：

- 当前 CETHX 数据是 `MOCK_DATA: no peer-reviewed source`。
- research-grade thermodynamics 应参考 eQuilibrator 3 和 Alberty (2003)。
- 当前实现没有 reaction-specific pKa transform、Debye-Hückel ionic strength correction、group contribution method、magnesium binding correction 等。
- 输出 ΔG' 值不能用于 research thermodynamic feasibility decision。

修改 `src/components/tools/CETHXPage.tsx`：

- 使用 `AlertTriangle` from `lucide-react`。
- 在页面主内容上方加入 amber demo banner。
- banner 文案明确说明：
  - CETHX 使用 simplified placeholder thermodynamics。
  - 使用 uniform pH factor。
  - 没有 Alberty transform。
  - 输出只用于 UI illustration。
  - 不用于 downstream inference。
  - research-grade thermodynamics 应 consult eQuilibrator 3。

Phase 1.4 没有做：

- 没有集成 eQuilibrator API。
- 没有重写 CETHX 算法。
- 没有修改 `toolValidity.ts`。
- 没有修改 `toolAssumptions.ts` 中 CETHX assumptions。

---

## 3. Commit list

### 3.1 Phase 1 commits

```text
94f8c19 [phase-1] add assumption schema types and design notes (task 1.1)
9273e73 [phase-1] add per-tool assumption registry covering all 14 tools (task 1.2)
9965f8e [phase-1] split fbasim into single/community sub-tiers + log known inconsistencies (task 1.2)
fab511b [phase-1] sharpen cellfree.parameters assumption (rename + tighter statement)
bcd13fa [phase-1] handoff doc
eb0de64 [phase-1] add runProvenance to payload bus + helper (task 1.3 schema)
d4f1516 [phase-1] write fbasim-single provenance to payloads (task 1.3)
88e26b5 [phase-1] gitignore .codex marker file
35307d7 [phase-1] add scientific provenance docstring to mockCETHX (task 1.4a)
1e52d21 [phase-1] add demo banner to CETHX page (task 1.4b)
```

### 3.2 Non-Phase metadata / repository housekeeping

```text
2e38809 Delete .codex
ad4f823 Add MIT LICENSE file
```

说明：

- `2e38809` 是 GitHub web UI 上删除误提交 `.codex` marker 的 commit。
- `ad4f823` 是项目 metadata commit，添加 MIT `LICENSE` 文件，按要求不使用 `[phase-1]` 前缀。

---

## 4. 验证结果

### 4.1 Build

`npm run build` 已在 Phase 1.3 和 Phase 1.4 关键节点多次运行并通过。最终 Phase 1.4 checkpoint 中 build 通过。

### 4.2 FBAsim provenance smoke test

运行 dev server 后，对 `/api/fba` single-species endpoint 发送测试 payload，确认响应包含 `provenance` 字段。

验证到的 provenance 内容包括：

```json
{
  "toolId": "fbasim-single",
  "inputAssumptions": [],
  "outputAssumptions": [
    "fbasim-single.steady_state",
    "fbasim-single.biomass_objective",
    "fbasim-single.no_regulation",
    "fbasim-single.simplex_real"
  ],
  "evidence": [
    {
      "source": "computation",
      "reference": "two-phase simplex LP on iJO1366Subset",
      "confidence": "high"
    }
  ],
  "validityTier": "partial",
  "upstreamProvenance": []
}
```

### 4.3 CETHX banner visual verification

使用 Playwright/Chromium 访问 `http://localhost:3000/tools/cethx`，确认：

- banner 可见。
- 使用 amber translucent background 和 amber border。
- 左侧显示 Lucide warning triangle icon。
- banner 位于 CETHX 页面主要模块上方。
- banner 文案匹配 brief。
- 浏览器 console 未出现 page error；只出现 React DevTools 的正常 info message。

### 4.4 14 tool routes dev smoke test

在 `npm run dev` 下访问并跟随 redirect，以下 routes 返回 200：

```text
/tools/catdes
/tools/cellfree
/tools/cethx
/tools/dbtlflow
/tools/dyncon
/tools/fbasim
/tools/gecair
/tools/genmim
/tools/metabolic-eng
/tools/multio
/tools/nexai
/tools/pathd
/tools/proevol
/tools/scspatial
```

备注：浏览器 console 只对 CETHX 页面进行了直接检查；其余工具页做了 HTTP/dev route smoke check。

---

## 5. Exit criteria

| Criterion | Status | Evidence / Note |
|---|---|---|
| `src/types/assumptions.ts` 存在并通过编译 | DONE | Phase 1.1 完成，最终 build 通过 |
| `toolAssumptions.ts` 覆盖 14 工具 | DONE | 实际 16 entries，含 `fbasim-single` / `fbasim-community` |
| `WorkbenchPayloadBase` 有 optional `runProvenance` | DONE | `runProvenance?: ProvenanceEntry` 已加入 base payload |
| FBAsim 至少 1 处实际写入 provenance | DONE | `/api/fba` single-species path 返回 provenance，client 写入 payload |
| `mockCETHX.ts` 有 `@scientific_provenance` docstring | DONE | 文件顶部新增完整 JSDoc block |
| CETHX 页面有 demo banner | DONE | Playwright 验证可见 |
| `npm run build` 通过 | DONE | Phase 1.4 checkpoint build pass |
| 所有 14 pages render/dev smoke | PARTIAL | 14 routes 返回 200；CETHX browser console 已直接验证，其余未逐页做 browser console inspection |

---

## 6. Phase 2 risks / 已知限制与建议

### 6.1 Demo tier 不升级

Phase 1 明确不升级 demo-tier 工具。以下仍保持 demo：

- CETHX
- CellFree
- MultiO
- `fbasim-community`

建议 Phase 2 只有在算法、参数来源、验证证据足够后再调整 tier。

### 6.2 CETHX 仍未集成 eQuilibrator

当前 Phase 1.4 只做用户告知与文档透明化。CETHX 仍未实现：

- reaction-specific Alberty transform
- ionic strength correction
- magnesium binding correction
- group contribution method
- compartment-specific ΔG' adjustment

建议 Phase 2 将 eQuilibrator 3 或等价 thermodynamics backend 作为独立算法重构任务处理。

### 6.3 CellFree tier/code mismatch

`toolValidity.ts` 仍显示 CellFree 为 demo，caption 说 “no live TXTL kinetic model”。但 handoff 已记录 `CellFreeEngine.ts` 实际有 resource-aware TX-TL ODE。

Phase 1 保持 tier 不动。建议 Phase 2 对 CellFree 做参数来源、校准证据和 validity caption 统一。

### 6.4 Community FBA 仍是 demo

`fbasim-community` 的关键 limitation 是 two-species mode 仍为两个 independent LP + post-hoc exchange scaling，不是 joint community LP。

建议 Phase 2 若要提升，需要实现 joint stoichiometric constraints 或明确接入 community FBA solver。

### 6.5 `runProvenance` 只完成首个实际写入路径

Phase 1.3 只要求至少一个实际 provenance write site。当前完成的是 FBAsim single-species path。

建议 Phase 2 扩展：

- CETHX output provenance
- PathD / Analyze provenance
- downstream assumption compatibility detector
- UI gating / warning states
- upstream provenance chain resolution

---

## 7. 当前仓库状态摘要

截至本报告生成前，`git status --short --branch` 为：

```text
## main...origin/main
```

报告生成后预计新增两个未提交本地文件：

```text
docs/PHASE_1_CLOSING_REPORT.md
docs/PHASE_1_CLOSING_REPORT.pdf
```

按当前交付要求，这两个文件不 commit、不 push。

