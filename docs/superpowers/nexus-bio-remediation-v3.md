# Nexus-Bio 修复执行方案 v3
**基线 commit**: `0a342d9`（2026-06-22）
**审计来源**: 全仓库扫描（provenance、test coverage、dead imports、magic numbers、handoff）

---

## 工作纪律
1. 按编号顺序执行
2. 每项任务完成后输出证据块
3. 修 bug 前先理解 bug

---

## 任务 1 — PathDPage 补 setToolPayload handoff（Critical）

### 背景
`src/components/tools/PathDPage.tsx` 产出 KEGG 路径、逆合成、路径发现三类结果，但从未调用 `setToolPayload`。下游工具（MetabolicEng、CETHX、FBAsim）拿不到这些数据。

### 修复方案
在 PathDPage 的三个 tab 的结果回调里加 `setToolPayload('pathd', ...)`：
- KEGG 搜索成功 → 推送 pathway data
- 逆合成成功 → 推送 retrosynthesis results
- 路径发现成功 → 推送 discovered pathways

### VERIFY
```
[ ] PathDPage 包含 setToolPayload 调用
[ ] 推送的 payload 结构与 workbenchStore 的 pathd 类型一致
[ ] 下游工具能通过 toolPayloads.pathd 读到数据
```

---

## 任务 2 — 30 个引擎补 @scientific_provenance 注释

### 重要引擎（需要读完代码后写注释）
按优先级分批：

**批次 A — FBA 相关（3 个）**
- fbaFVA.ts
- fbaGPR.ts
- fbaPFBA.ts

**批次 B — 其他服务器引擎（12 个）**
- codonOptimizer.ts, rbsCalculator.ts, retrosynthesis.ts
- gaussianProcess.ts, gillespieSSA.ts, mcmcCalibration.ts
- modelPredictiveControl.ts, ddgPrediction.ts
- mofaPlus.ts, cellChat.ts
- scVAEEngine.ts, umapEngine.ts

**批次 C — 分析引擎（5 个）**
- circuitBuilder.ts, jacobianAnalysis.ts
- sensitivityAnalysis.ts, parameterDistributions.ts
- robustnessScore.ts

**批次 D — Pipeline 文件（10 个）**
- cethxPipeline.ts, dynconPipeline.ts, genmimPipeline.ts
- multioPipeline.ts, nexaiPipeline.ts, proevolPipeline.ts
- robustnessPipeline.ts, scspatialPipeline.ts
- fbaStrainPipeline.ts, circuitReasonerPipeline.ts

**批次 E — 基础设施（Minor，可选）**
- simplexLP.ts, highsSolver.ts, gridSearch.ts
- scspatialArtifactStore.ts, scspatialDemo.ts, scspatialSidecar.ts
- workbenchDb.ts, libsqlDb.ts, db/adapter.ts

### 注释模板
```typescript
/**
 * [Engine Name] — [One-line description]
 *
 * [Algorithm description]
 *
 * Reference: [Author et al. (Year) Journal Volume:Pages]
 *
 * @scientific_provenance
 *   ALGORITHM: [Algorithm name]
 *   REFERENCE: [Full citation]
 *   KNOWN_LIMITATIONS:
 *     - [Limitation 1]
 *     - [Limitation 2]
 */
```

### VERIFY
```
[ ] 所有 Important 级别的引擎文件都有 @scientific_provenance 注释
[ ] 注释包含 ALGORITHM、REFERENCE、KNOWN_LIMITATIONS
[ ] 引用的文献是真实可查的
```

---

## 任务 3 — DataUpload/DataPreview 接入 FBAsim

### 背景
`FBASimPage.tsx` 导入了 `DataUpload` 和 `DataPreview` 但从未使用。这两个组件应该让用户上传自定义 FBA 模型数据。

### 修复方案
在 FBAsim 页面加一个 "Custom Model" tab：
- 使用 `DataUpload` 上传 CSV（列：reaction_id, lb, ub, stoichiometry）
- 使用 `DataPreview` 预览上传的数据
- 上传后调用 `solveDynamicFBA`（已存在于 fbaEngine.ts）运行自定义模型

### VERIFY
```
[ ] FBAsim 页面有 Custom Model tab
[ ] DataUpload 和 DataPreview 组件被实际使用
[ ] 上传 CSV 后能运行 FBA 并显示结果
```

---

## 任务 4 — Magic Numbers 提取

### 目标文件
- `CellFreePage.tsx` — 500/5000/20000 表达水平阈值
- `GECAIRPage.tsx` — 0.0075 降解率（9 处）
- `PathDPage.tsx` — 60+ 个 rgba 颜色字面量

### 修复方案
在每个文件顶部提取命名常量：
```typescript
// CellFree
const EXPRESSION_LOW = 500;
const EXPRESSION_MEDIUM = 5000;
const EXPRESSION_HIGH = 20000;

// GECAIR
const MRNA_DEGRADATION_RATE = 0.0075; // 1/min, Alon 2007

// PathD — 用 THEME tokens 替换硬编码颜色
```

### VERIFY
```
[ ] 每个文件的魔法数字被提取为命名常量
[ ] 常量有单位/来源注释
[ ] 功能不变（测试通过）
```
