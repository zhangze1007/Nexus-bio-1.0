# 干湿实验闭环整合执行方案（Dry–Wet Lab Integration Plan）

> 版本：v1.0 · 目标：把 Nexus-Bio 从"强干实验引擎 + 湿实验脚手架"推进到"可证伪、可回流的干湿闭环平台"。
> 适用分支：`main` · 语言：TypeScript（Node 运行时引擎）+ Next.js
> 阅读对象：负责实现的工程/科研人员。每个阶段都给出**目标 → 新建/修改文件 → 代码骨架 → 步骤 → 验收标准 → 测试**。

---

## 0. 总览

### 0.1 现状定位

- **干实验（in silico）已成体系**：14 个工具覆盖 DBTL，FBA / 热力学 / 动力学 / 蛋白设计 / CRISPR / 无细胞 / 组学均有真实算法。
- **湿实验桥接已有脚手架但未闭环**：
  - 类型化实验记录 `src/types/experimentRecord.ts`（`ExperimentRecordV1`）+ 校验器 `src/validation/experimentRecordValidator.ts`
  - 人工门控回流 `LearnedDeltaPack`（`src/types/learnedDelta.ts` / `learnedDeltaBuilder.ts` / `learnedDeltaApplication.ts` / `learnedDeltaValidator.ts`）
  - LIMS/ELN 客户端 `src/services/lims/*`（Benchling / LabArchives / RSpace / generic）
  - 仪器解析与 QC `src/services/instruments/*`（酶标仪、FCS、`qcPipeline`、`protocolGenerator`）
  - 实验室自动化桥 `src/server/labAutomationBridge.ts`（OT-2 / Antha / SBOL 导出）
  - 回流应用点 `src/components/tools/shared/workbenchDataflow.ts`（`applyChangedPrior()` 只作用于白名单先验字段）

### 0.2 目标闭环

```
        ┌──────────── Design (干) ─────────────┐
        │  PredictionRecordV1 (点估计 + 预测区间) │   ← P0-1
        └───────────────────┬───────────────────┘
                            ▼
        ┌──────────── Build (物理握手) ─────────┐
        │  可执行协议 + 板图/条码 (batchId 贯穿)  │   ← P1-1
        └───────────────────┬───────────────────┘
                            ▼
        ┌──────────── Test (回流) ─────────────┐
        │  LIMS/仪器 → ExperimentRecordV1 + QC   │   ← P1-2 / P1-3
        └───────────────────┬───────────────────┘
                            ▼
        ┌──────────── Judge (证伪) ────────────┐
        │  预测 vs 实测：残差 / 区间覆盖 / pass  │   ← P0-2
        └───────────────────┬───────────────────┘
                            ▼
        ┌──────────── Learn (更新) ────────────┐
        │  数据驱动 LearnedDeltaPack (人工门控)   │   ← P2-1
        │  贝叶斯重标定 + DoE 建议下一批实验      │   ← P2-1 / P2-2
        └───────────────────┬───────────────────┘
                            └──► 回到 Design
```

### 0.3 总体原则（不可违背的约束）

1. **人工门控保留**：`humanGateStatus: approved` 才能应用回流，这是现有优点，全程保留（P2 只自动生成"待审"提案，不自动批准）。
2. **类型化契约优先**：干湿之间只通过带 `schemaVersion` 的类型化对象通信，禁止自然语言解析为数值（沿用 `DBTL_TYPED_LOOPBACK.md` 边界）。
3. **可复现**：所有计算路径确定性（同输入→同输出），禁止未播种随机数。
4. **证伪优先**：任何"结合得好"的说法都必须由 P0-2 的证伪报告量化，不做无依据的验证声明（沿用 `cellfree-reality-audit.md` 非声明清单）。
5. **验收对齐 roadmap**：满足 `docs/NEXUS_BIO_RESEARCH_GRADE_ROADMAP.md` 的 Reviewer / Reproducibility / Citation 三项测试。

### 0.4 里程碑总览

| 阶段 | 名称 | 交付物 | 相对工作量 | 依赖 |
|---|---|---|---|---|
| **P0-1** | 预测契约 | `PredictionRecordV1` + 校验器 + 各引擎产出适配 | M | — |
| **P0-2** | 证伪引擎 | 比较引擎 + 阈值预登记 + 面板 + 反馈到 delta builder | L | P0-1 |
| **P0-3** | 可复现 + 去桩 | 播种 RNG + 实现桩函数 + 确定性快照测试 + CI 闸 | M | 可并行 |
| **P1-1** | 协议可执行 | Deck/labware 建模 + 板图/条码清单 + 校验扩展 | M | P0-1（键对齐） |
| **P1-2** | LIMS 双向 | 结果拉回 + 实体映射 + 溯源链强制 | M | P0-1 |
| **P1-3** | QC 强化 | 记录级 QC 闸 + 单位归一 + 对照/重复 | S–M | P0-2 |
| **P2-1** | 回流拓宽 | bounds/weights 应用 + 贝叶斯重标定 + 白名单扩展 | M–L | P0-2 |
| **P2-2** | DoE 主动学习 | 采集函数建议下一批实验 → 协议导出 | L | P0-2 / P2-1 |

> 建议实施顺序：**P0-1 → P0-2**（闭环判据地基）与 **P0-3**（可并行）先行；随后 **P1-1/P1-2/P1-3**（物理与回流）；最后 **P2-1 → P2-2**（真正融合）。

---

# P0 · 闭环地基

## P0-1 预测↔实测可比契约（`PredictionRecordV1`）

### 目标
让**每个工具的预测**与 `ExperimentRecordV1` 结构对齐（同一可观测量、同一单位、同一时间轴），并携带**预测区间**（不确定度）。这是证伪引擎能逐点对比的前提。当前 `cellfree-reality-audit.md` 已承认"无校准不确定度、无预测区间"，本步补齐。

### 新建文件
- `src/types/predictionRecord.ts` — 预测记录类型
- `src/validation/predictionRecordValidator.ts` — 校验器（镜像 `experimentRecordValidator.ts` 的 `{ ok, issues[] }` 模式）
- `src/services/prediction/predictionAdapters.ts` — 从各工具 workbench payload 生成预测记录
- `src/services/prediction/uncertainty.ts` — 预测区间推导（Monte Carlo / 集成）

### 代码骨架

`src/types/predictionRecord.ts`：

```ts
import type { AssayType } from "./experimentRecord";

export const PREDICTION_METHODS = [
  "point-estimate",
  "monte-carlo",
  "ensemble",
  "analytic-ci",
] as const;
export type PredictionMethod = (typeof PREDICTION_METHODS)[number];

/** 与 ExperimentTimepoint 一一对应，多出区间上下界。 */
export interface PredictionTimepoint {
  timeHours: number;
  value: number;            // 预测点估计
  unit: string;             // 必须与实测 unit 归一后一致
  lower?: number;           // 预测区间下界（如 5%）
  upper?: number;           // 预测区间上界（如 95%）
  intervalLevel?: number;   // 区间置信水平，如 0.9
}

/** 预测记录：结构镜像 ExperimentRecordV1，键可与之匹配。 */
export interface PredictionRecordV1 {
  schemaVersion: "prediction-record-v1";
  predictionId: string;
  /** 关联同一实验的键；证伪引擎据此与 ExperimentRecordV1 匹配。 */
  batchId?: string;
  sampleId?: string;
  constructId: string;
  assayType: AssayType;         // 复用实验记录的 assayType 枚举
  measurementUnit: string;      // 预测量纲
  sourceToolId: string;         // 产出该预测的工具，如 "cellfree" / "fbasim"
  sourceRunId: string;          // 对应 workbench run / provenance
  method: PredictionMethod;
  modelVersion: string;         // 引擎版本，保证可追溯
  seed?: number;                // 若用 MC，记录随机种子（配合 P0-3）
  timepoints: PredictionTimepoint[];
  provenanceIds?: string[];
  notes?: string;
}
```

`src/validation/predictionRecordValidator.ts`（签名，实现镜像现有校验器）：

```ts
import type { PredictionRecordV1 } from "../types/predictionRecord";

export type PredictionValidationCode =
  | "schema-version"
  | "missing-construct"
  | "missing-unit"
  | "empty-timepoints"
  | "interval-inverted"      // lower > upper
  | "interval-missing-level"
  | "non-finite-value";

export interface PredictionValidationIssue {
  code: PredictionValidationCode;
  severity: "error" | "warning";
  message: string;
  path?: string;
}
export interface PredictionValidationResult {
  ok: boolean;
  issues: PredictionValidationIssue[];
}

export function validatePredictionRecordV1(value: unknown): PredictionValidationResult;
export function isPredictionRecordV1(value: unknown): value is PredictionRecordV1;
```

`src/services/prediction/uncertainty.ts`（复用已有 Monte Carlo 能力，如 13C-MFA / DynCon 里的 MC）：

```ts
export interface EnsembleSample { timeHours: number; value: number; }

/** 由多次带扰动/多种子仿真的样本，按分位数得到预测区间。 */
export function intervalFromEnsemble(
  samples: EnsembleSample[],
  level = 0.9,
): { value: number; lower: number; upper: number; intervalLevel: number };
```

`src/services/prediction/predictionAdapters.ts`（把每个工具接入契约的统一入口）：

```ts
import type { PredictionRecordV1 } from "../../types/predictionRecord";

/** 每个工具实现一个适配器：workbench payload → 预测记录。 */
export interface ToolPredictionAdapter<TPayload = unknown> {
  toolId: string;
  /** null 表示该 payload 尚不足以产出可比预测。 */
  toPrediction(payload: TPayload, ctx: { runId: string; modelVersion: string }): PredictionRecordV1 | null;
}

export function registerPredictionAdapter(a: ToolPredictionAdapter): void;
export function buildPredictionsForRun(runId: string): PredictionRecordV1[];
```

### 步骤
1. 建 `predictionRecord.ts` 类型；复用 `experimentRecord.ts` 的 `AssayType` 保证枚举一致。
2. 建校验器，覆盖：schemaVersion、`constructId` 非空、`measurementUnit` 非空、时间点非空、区间不得 `lower > upper`、值有限。
3. 建 `uncertainty.ts`：先支持 `analytic-ci`（已有解析误差的引擎）与 `monte-carlo`（复用 MFA/DynCon 的 MC 采样）。
4. **首批接 3 个工具**（覆盖率最高、最贴近湿实验读数）：`cellfree`（蛋白表达/滴度）、`fbasim`（生长率/产率）、`dyncon`（发酵时序）。各写一个 `ToolPredictionAdapter`，从对应 workbench payload 映射时间点与单位。
5. 在 workbench run 完成时调用 `buildPredictionsForRun()`，把预测记录随 run 落库（与实验记录同一存储层 `src/server/workbenchDb.ts`）。

### 验收标准
- 对 `examples/experiment-records/valid-wet-lab-like.json` 能构造出**结构可匹配**（相同 `constructId` / `assayType` / 单位归一后一致）的预测记录。
- 校验器对倒置区间、缺单位、空时间点分别报 `error`。
- 三个首批工具在 demo 输入下产出非空、确定性（配合 P0-3）的预测记录。

### 测试桩（`__tests__/prediction/predictionRecord.test.ts`）
```ts
describe("PredictionRecordV1", () => {
  it("validates a well-formed record", () => {/* ok === true */});
  it("flags inverted interval (lower > upper)", () => {/* code: interval-inverted */});
  it("cellfree adapter yields unit-consistent timepoints vs ExperimentRecordV1", () => {});
  it("is deterministic for a fixed seed", () => {/* 见 P0-3 */});
});
```

---

## P0-2 证伪 / 验证引擎（Falsification Engine）

### 目标
补上 `DBTL_TYPED_LOOPBACK.md` 明确缺失的一环——它写着当前边界"**不提供湿实验验证、科学验证、自动审批，也没有 falsification dashboard**"。本步实现：把配对的 (预测, 实测) 计算残差、区间覆盖率、校准指标，对照**预登记阈值**判 pass/fail，产出证伪报告，并把结果转成 `BuildLearnedDeltaPackInput` 喂给 `learnedDeltaBuilder`。

### 新建文件
- `src/types/acceptanceCriteria.ts` — 预登记阈值（实验前登记，防止事后挑数据）
- `src/types/falsification.ts` — 证伪报告类型
- `src/services/falsification/matchRecords.ts` — 预测↔实测配对
- `src/services/falsification/compare.ts` — 残差 / 覆盖 / 校准 / 判定
- `src/services/falsification/toLearnedDelta.ts` — 证伪结果 → delta 提案
- `app/tools/dbtlflow/falsification/` 或复用 DBTLflow 面板 — 展示层

### 代码骨架

`src/types/acceptanceCriteria.ts`：

```ts
/** 实验开始前登记，锁定判据，避免事后调阈值。 */
export interface ValidationThreshold {
  schemaVersion: "acceptance-criteria-v1";
  criteriaId: string;
  constructId: string;
  assayType: string;
  registeredAt: string;         // 必须早于 ExperimentRecord.startedAt
  maxRelativeError: number;     // 允许的最大相对残差，如 0.5 = 50%
  minIntervalCoverage: number;  // 实测落入预测区间的最低比例，如 0.8
  registeredBy?: string;
}
```

`src/types/falsification.ts`：

```ts
export type FalsificationVerdict = "corroborated" | "falsified" | "inconclusive";

export interface PointResidual {
  timeHours: number;
  predicted: number;
  observed: number;
  absError: number;
  relError: number;      // |pred - obs| / max(|obs|, eps)
  withinInterval: boolean;
}

export interface FalsificationReport {
  schemaVersion: "falsification-report-v1";
  reportId: string;
  predictionId: string;
  experimentRecordId: string;
  constructId: string;
  assayType: string;
  criteriaId?: string;            // 关联的预登记阈值
  residuals: PointResidual[];
  rmse: number;
  mae: number;
  intervalCoverage: number;       // withinInterval 的比例
  medianRelError: number;
  verdict: FalsificationVerdict;  // 依据 criteria 判定
  createdAt: string;
  notes?: string;
}
```

`src/services/falsification/matchRecords.ts`：

```ts
import type { PredictionRecordV1 } from "../../types/predictionRecord";
import type { ExperimentRecordV1 } from "../../types/experimentRecord";

export interface MatchedPair {
  prediction: PredictionRecordV1;
  experiment: ExperimentRecordV1;
  /** 时间点对齐后的 (pred, obs) 序列，单位已归一。 */
  aligned: Array<{ timeHours: number; predicted: number; observed: number; predLower?: number; predUpper?: number }>;
}

/**
 * 按 constructId + assayType + (batchId/sampleId 若存在) 匹配，
 * 时间点用最近邻/线性插值对齐，单位经 normalizeUnit 归一。
 */
export function matchPredictionsToExperiments(
  predictions: PredictionRecordV1[],
  experiments: ExperimentRecordV1[],
): MatchedPair[];
```

`src/services/falsification/compare.ts`：

```ts
import type { MatchedPair } from "./matchRecords";
import type { FalsificationReport } from "../../types/falsification";
import type { ValidationThreshold } from "../../types/acceptanceCriteria";

export function compareToFalsification(
  pair: MatchedPair,
  criteria?: ValidationThreshold,
): FalsificationReport;
// verdict 规则：
//   medianRelError <= maxRelativeError 且 intervalCoverage >= minIntervalCoverage → corroborated
//   任一超限 → falsified
//   无 criteria 或时间点不足 → inconclusive
```

`src/services/falsification/toLearnedDelta.ts`（关键：数据驱动地生成"待审"delta，而非手填）：

```ts
import type { FalsificationReport } from "../../types/falsification";
import type { BuildLearnedDeltaPackInput } from "../learnedDeltaBuilder";

/**
 * 由证伪结果推导 changedPriors 提案（humanGateStatus 仍为 pending）。
 * 例：cellfree 系统性高估 → 提案下调 cellfree.params.ribosomeTotal。
 * 映射表定义"哪个残差方向 → 调哪个先验、调多少（带阻尼）"。
 */
export function proposeDeltaFromFalsification(
  reports: FalsificationReport[],
  opts: { sourceDbtlRunId: string; iteration: number; damping?: number },
): BuildLearnedDeltaPackInput | null;
```

### 步骤
1. 建 `acceptanceCriteria.ts`；在 DBTLflow 发起实验时**强制先登记阈值**（`registeredAt` 早于 `startedAt`，否则该实验不参与证伪判定，仅 inconclusive）。
2. 建 `matchRecords.ts`：实现单位归一（依赖 P1-3 的 `normalizeUnit`）+ 时间点对齐。
3. 建 `compare.ts`：残差、RMSE/MAE、区间覆盖、中位相对误差、verdict。
4. 建 `toLearnedDelta.ts` + 一张"残差方向 → 先验字段/阻尼系数"映射表（首批覆盖 cellfree / fbasim / dyncon）。生成的 `BuildLearnedDeltaPackInput` 传入现有 `buildLearnedDeltaPack()`，天然 `humanGateStatus: pending`。
5. 面板：在 DBTLflow 增加"证伪"标签页，展示每个 construct 的残差图、区间覆盖、verdict 徽章，并列出待审 delta 提案（点击进入现有人工门控审批）。

### 验收标准
- 给定一对匹配记录 + 阈值，`compareToFalsification` 输出正确的 verdict（构造三组用例：命中、超相对误差、区间覆盖不足）。
- 无预登记阈值的实验只能得到 `inconclusive`，不能得到 `corroborated`（防止事后判定）。
- `proposeDeltaFromFalsification` 产出的 pack 通过 `validateLearnedDeltaPack()` 且为 `pending`，`sourceExperimentRecordIds` 非空。

### 测试桩（`__tests__/falsification/compare.test.ts`）
```ts
it("corroborates when relError and coverage within criteria", () => {});
it("falsifies when medianRelError exceeds maxRelativeError", () => {});
it("returns inconclusive without pre-registered criteria", () => {});
it("proposed delta is pending and passes learnedDelta validation", () => {});
```

---

## P0-3 可复现 + 去桩（Reproducibility & De-stub）

### 目标
用于湿实验决策的计算不能含假算或非确定性。`NEXUS_BIO_INTEGRITY_AUDIT_V2.md` 已列出计算路径上的未播种随机数与 canned/decoy 桩函数。本步：播种全部 RNG、实现桩、加确定性快照测试与 CI 闸。

### 新建 / 修改文件
- 新建 `src/utils/rng.ts` — 可播种 PRNG（mulberry32 / xorshift）
- 修改（据审计清单，逐一替换 `Math.random`）：
  - `src/modules/ml/features.ts:216`、`src/modules/ml/interpretability.ts:188`
  - `src/modules/rna-engine/rnaEngine.ts:338`
  - `src/server/bioreactorAnalyticsEngine.ts:197`、`src/server/rfdiffusion.ts:408`
  - `src/services/protein/inverseFolding.ts:248`
- 实现被审计标为"忽略入参"的桩：
  - `src/services/instruments/protocolGenerator.ts:49` — `emitOpentronsStep()` **实际使用 `labwareMap`**（见 P1-1）
  - `src/server/genmimPipeline.ts:63` — `planKnockdowns()` 使用其 `spec`
  - 其余 decoy 项（`ddgPrediction`、`grnaDesigner`、`modelPredictiveControl` 等）按审计逐条修复或标注为有意忽略

### 代码骨架

`src/utils/rng.ts`：

```ts
/** 确定性 PRNG：同 seed 同序列。计算路径一律用它，禁止 Math.random。 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gaussian(rng: () => number, mean = 0, sd = 1): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
```

替换范式（每处计算函数显式接收 `seed`）：

```ts
// before: const x = Math.random();
// after:
export function simulateSomething(input: Input, seed = 42) {
  const rng = makeRng(seed);
  const x = rng();
  // ...记录 seed 到 PredictionRecordV1.seed
}
```

### 步骤
1. 建 `rng.ts`，加单元测试（同 seed 同序列、不同 seed 不同序列）。
2. 按审计清单逐个替换计算路径 `Math.random` → `makeRng(seed)`，并将 `seed` 透传到 `PredictionRecordV1.seed`。
3. 实现桩函数：优先 `emitOpentronsStep`（P1-1 依赖）与 `planKnockdowns`；其余按严重度处理。
4. 加**确定性快照测试**：对每个改动引擎，同输入跑两次断言结果全等。
5. 加 CI 闸：脚本 `scripts/check-determinism.mjs` 扫描 `src/server` / `src/modules` / `src/services` 计算路径中裸 `Math.random(` 出现即失败（允许显式白名单注释 `// rng-ok`）。

### 验收标准（对齐 roadmap 的 Reproducibility Test）
- `grep -rn "Math.random(" src/server src/modules src/services` 在计算路径上返回 0（UI/非计算路径可豁免并注释）。
- 审计清单中 severity ≥ 3 的 canned/decoy 项全部关闭或标注理由。
- 每个改动引擎的确定性快照测试通过。

### 测试桩（`__tests__/utils/rng.test.ts` + `__tests__/determinism/*.snap.test.ts`）
```ts
it("same seed produces identical sequence", () => {});
it("cellfree simulateCFPS is byte-identical across two runs (fixed seed)", () => {});
it("no bare Math.random on compute paths (CI guard)", () => {});
```

---

# P1 · 物理握手与数据回流

## P1-1 协议导出：可执行 + 可回读

### 目标
让导出的机器人协议**物理上跑得通**，并写入**板图/条码**把 `batchId / sampleId / constructId` 贯穿到仪器读数——这样 P0-2 的预测↔实测配对才有键可依。当前问题：`labAutomationBridge.ts` 的 KNOWN_LIMITATIONS 明示"假设特定耗材、无液体类别"，且 `protocolGenerator.ts:49` 的 `emitOpentronsStep()` **忽略 `labwareMap`**、孔位写死（`A1→B1`）。

### 修改 / 新建文件
- 新建 `src/services/instruments/deckModel.ts` — 甲板/耗材/移液器建模
- 修改 `src/services/instruments/protocolGenerator.ts` — `emitOpentronsStep()` 真正消费 `labwareMap` + 甲板槽位
- 修改 `src/server/labAutomationBridge.ts` — 导出携带 manifest；填液体类别
- 新建 `src/types/protocolManifest.ts` — 板图/条码清单（回读键的载体）

### 代码骨架

`src/types/protocolManifest.ts`：

```ts
/** 协议清单：把设计身份钉进物理孔位，随协议一起导出，回读时据此还原键。 */
export interface WellAssignment {
  well: string;            // 如 "A1"
  labwareId: string;       // 甲板上耗材实例
  sampleId: string;        // ← 贯穿到 ExperimentRecordV1.sampleId
  constructId: string;     // ← 贯穿到 ExperimentRecordV1.constructId
  role: "sample" | "blank" | "control-pos" | "control-neg";
  barcode?: string;
}
export interface ProtocolManifest {
  schemaVersion: "protocol-manifest-v1";
  manifestId: string;
  batchId: string;         // ← 贯穿到 ExperimentRecordV1.batchId
  dbtlRunId: string;
  plateMap: WellAssignment[];
  createdAt: string;
}
```

`src/services/instruments/deckModel.ts`：

```ts
export interface LabwareDef { id: string; loadName: string; slot: number; wells: number; }
export interface PipetteDef { id: string; model: string; mount: "left" | "right"; minUl: number; maxUl: number; }
export interface DeckLayout { labware: LabwareDef[]; pipettes: PipetteDef[]; }

/** 校验：容量匹配移液器量程、槽位不冲突、blank/control 占位存在。 */
export function validateDeck(layout: DeckLayout, manifest: import("../../types/protocolManifest").ProtocolManifest): string[];
```

`emitOpentronsStep()` 修复要点（消费 `labwareMap`，不再写死孔位）：

```ts
function emitOpentronsStep(step, index, labwareMap: Map<string, string>, pipetteVar, plateMap: WellAssignment[]) {
  const src = plateMap[index];                       // 来自 manifest，而非 wellId(index)
  const srcLabware = labwareMap.get(src.labwareId);  // 真正使用 labwareMap
  // ...emit: pipetteVar.transfer(vol, srcLabware[src.well], dest..., new_tip='always')
  // 液体类别：根据 reagent 设定 flow_rate / touch_tip（补 KNOWN_LIMITATIONS）
}
```

### 步骤
1. 建 `protocolManifest.ts` 与 `deckModel.ts`。
2. 重写 `emitOpentronsStep()`：以 `plateMap` + `labwareMap` 决定源/目标孔位与耗材；补液体类别参数。
3. `labAutomationBridge.ts` 导出 OT-2/Antha 时一并导出 `ProtocolManifest`（JSON 附随）。
4. 扩展现有 validation pass（`protocolGenerator.ts` 的 `ValidationResult`）：加入 `validateDeck()` 结果、blank/control 占位检查、体积-量程一致性。
5. **回读接口**：仪器结果解析后（P1-3）用 manifest 的 `well → {sampleId, constructId, batchId}` 反查，写进 `ExperimentRecordV1`。

### 验收标准
- 生成的 OT-2 Python 通过 `opentrons_simulate`（CI 中以容器跑）零错误。
- 板图中每个 sample 孔都能反查到 `constructId`，且含至少一个阴性对照与一个空白孔。
- 校验 pass 能拦截：体积超移液器量程、槽位冲突、缺对照。

### 测试桩（`__tests__/instruments/protocolExec.test.ts`）
```ts
it("emitOpentronsStep uses labwareMap (no hard-coded A1/B1)", () => {});
it("exported manifest round-trips well → constructId", () => {});
it("validation rejects volume exceeding pipette max", () => {});
```

---

## P1-2 LIMS/ELN 双向同步 + 身份贯穿

### 目标
把 `src/services/lims/*` 从偏推送做成**双向**：按 `externalId` 拉回化验结果并转为 `ExperimentRecordV1`；建立 Nexus construct ↔ LIMS 实体映射；强制每条实验记录经 `provenanceIds` 链回产生它的设计工件（`examples/sbol-prov-linked` 的 provenance bundle 已有雏形）。类型里 `syncDirection` 已支持 `bidirectional`，本步落地拉取侧。

### 修改 / 新建文件
- 修改 `src/services/lims/benchlingClient.ts` — 新增 `pullAssayResults()`
- 新建 `src/services/lims/entityMap.ts` — 实体映射表 + 持久化
- 新建 `src/services/lims/resultToExperimentRecord.ts` — LIMS 结果 → `ExperimentRecordV1`
- 新建 `src/services/lims/syncEngine.ts` — 推/拉编排
- 修改 `src/services/lims/genericAdapter.ts` — 泛化拉取给非 Benchling LIMS

### 代码骨架

`src/services/lims/entityMap.ts`：

```ts
export interface EntityLink {
  nexusConstructId: string;
  limsEntityId: string;       // externalId in LIMS
  limsType: "strain" | "plasmid" | "sample";
  linkedAt: string;
}
export function upsertEntityLink(link: EntityLink): void;
export function resolveConstructId(limsEntityId: string): string | undefined;
```

`benchlingClient.ts` 新增：

```ts
export interface AssayPull {
  externalId: string;
  assayType: string;
  unit: string;
  timepoints: Array<{ timeHours: number; value: number }>;
  instrument?: string; operator?: string; startedAt: string; completedAt?: string;
}
// 复用已有 request<T>() 私有方法；按 schema/entity 拉取 assay results
async pullAssayResults(params: { batchId?: string; since?: string }): Promise<AssayPull[]>;
```

`resultToExperimentRecord.ts`：

```ts
import type { ExperimentRecordV1 } from "../../types/experimentRecord";
import type { AssayPull } from "./benchlingClient";

/** 拉回结果 → 类型化实验记录。强制填 provenanceIds（链回设计工件）。 */
export function assayPullToExperimentRecord(
  pull: AssayPull,
  ctx: { batchId: string; sampleId: string; sourceFileId?: string; designProvenanceIds: string[] },
): ExperimentRecordV1;
// sourceType = "wet-lab"; 经 validateExperimentRecordV1 校验后落库
```

`syncEngine.ts`：

```ts
export interface SyncReport { pushed: number; pulled: number; recordsCreated: number; errors: string[]; }

/** push: 设计/下单信息推入 LIMS；pull: 结果拉回并转记录。 */
export async function runSync(configId: string, direction: "push" | "pull" | "bidirectional"): Promise<SyncReport>;
```

### 步骤
1. 建 `entityMap.ts`，在"下单/建样"时写入映射（construct ↔ LIMS entity）。
2. `benchlingClient.pullAssayResults()`：复用现有 `request<T>()` 与 Basic 认证，按 `batchId`/时间增量拉取。
3. `resultToExperimentRecord.ts`：映射单位/时间点，`sourceType: "wet-lab"`，**强制 `provenanceIds` 非空**（链回设计工件；缺失则打 QC flag `manual-review-required`）。
4. `syncEngine.ts` 编排推拉；落库经 `validateExperimentRecordV1()`。
5. `genericAdapter.ts` 暴露同样的 `pullAssayResults` 契约，覆盖非 Benchling LIMS。

### 验收标准
- 从 mock Benchling 响应能拉出 ≥1 条结果并生成通过校验的 `ExperimentRecordV1`。
- 每条生成记录的 `provenanceIds` 都能解析到一个设计工件；否则被标记 `manual-review-required` 且不进入证伪。
- `resolveConstructId()` 对已建映射的 externalId 正确返回。

### 测试桩（`__tests__/lims/sync.test.ts`）
```ts
it("pullAssayResults maps to a valid ExperimentRecordV1", () => {});
it("record without provenance is flagged manual-review-required", () => {});
it("entityMap resolves construct from LIMS externalId", () => {});
```

---

## P1-3 仪器数据 QC 强化

### 目标
真实酶标仪/FCS 文件噪声大。当前 `qcPipeline.ts` 在 `number[]` 上做 `runQC / detectOutliers / normalizeData`，但缺**记录级**的对照扣除、重复一致性、单位归一，且 `ExperimentRecordV1` 已定义的 QC flag（`missing-unit / outlier / failed-control` 等）尚未作为**回流前闸门**强制执行。

### 修改 / 新建文件
- 新建 `src/services/instruments/unitNormalization.ts` — 单位归一表（P0-2 配对依赖）
- 新建 `src/services/instruments/recordQc.ts` — 记录级 QC（空白/对照/重复）
- 新建 `src/services/instruments/qcGate.ts` — 回流闸门
- 修改各 parser（`plateReaderParser.ts` 等）— 扩展厂商覆盖 + 输出携带 well role

### 代码骨架

`src/services/instruments/unitNormalization.ts`：

```ts
/** 归一到规范单位（如 titer → mg/L, OD 无量纲）。配对/证伪前统一调用。 */
export function normalizeUnit(value: number, fromUnit: string, toUnit: string): number;
export function canonicalUnitFor(assayType: string): string;
```

`src/services/instruments/recordQc.ts`：

```ts
import type { ExperimentRecordV1, ExperimentRecordQcFlag } from "../../types/experimentRecord";

export interface RecordQcResult {
  flags: ExperimentRecordQcFlag[];
  blankCorrected: boolean;
  replicateCV?: number;         // 重复孔变异系数
  controlPassed: boolean;
}
/** 空白扣除、阴阳性对照检查、重复孔 CV、异常点标记 → 写回 record.qcFlags。 */
export function runRecordQc(
  record: ExperimentRecordV1,
  controls: { blank?: number[]; posControl?: number[]; negControl?: number[] },
): RecordQcResult;
```

`src/services/instruments/qcGate.ts`：

```ts
import type { ExperimentRecordV1 } from "../../types/experimentRecord";
/** 只有通过闸门的记录才允许进入 P0-2 证伪与 P2 学习。 */
export function passesLearnGate(record: ExperimentRecordV1): { ok: boolean; blockedBy: string[] };
// 规则：含 failed-control / manual-review-required / missing-unit → 不通过
```

### 步骤
1. 建 `unitNormalization.ts`（P0-2、P1-2 都依赖）。
2. 建 `recordQc.ts`：复用 `qcPipeline` 的 `detectOutliers/normalizeData`，加空白扣除、对照判定、重复 CV，把结果写进 `record.qcFlags`。
3. 建 `qcGate.ts`：把 QC flag 变成硬闸门；`matchRecords`/`learnedDeltaBuilder` 上游先过闸。
4. 扩展 parser 厂商覆盖与 well role 解析（对照/空白孔识别）。

### 验收标准
- 含 `failed-control` 的记录被 `passesLearnGate` 拒绝，不进入证伪/学习。
- 单位归一：`mg/L` 与 `g/L`、`OD` 与百分透光等在配对前正确统一。
- 重复孔 CV 超阈值时自动打 `outlier` flag。

### 测试桩（`__tests__/instruments/recordQc.test.ts`）
```ts
it("blank subtraction lowers reported titer", () => {});
it("failed positive control sets failed-control and blocks learn gate", () => {});
it("normalizeUnit unifies g/L and mg/L", () => {});
```

---

# P2 · 真正融合

## P2-1 回流拓宽 + 贝叶斯重标定

### 目标
现在 `workbenchDataflow.ts` 只用 `applyChangedPrior()` 把 `changedPriors` 应用到白名单字段（`fbasim.glucoseUptake`@L281、`catdes.requiredFlux`@L393 等），`changedBounds` / `changedWeights` 从不读取，且是**单点覆盖**。本步：实现 bounds/weights 应用路径、扩大白名单、并把"单点覆盖"升级为**贝叶斯后验更新**（用先验均值/方差 + 实测证据得到后验），让回流稳健且可累积。类型层 `LearnedDeltaPack.changedBounds/changedWeights` 已存在，缺的是应用侧。

### P2-1.0 前置：与 P0-2 证伪引擎的对接校正（必须先做）

> 来源：P0-2 落地后代码审查发现。`src/services/falsification/toLearnedDelta.ts` 产出的 delta 目前与应用层 `applyChangedPrior()` 对不上；不先校正，回流会**静默失效**（方向对但量级错，或整条提案被跳过）。

三个必须处理的错位：

1. **语义冲突（乘性 vs 绝对）**：`toLearnedDelta` 用乘性修正 `before:1 → after:scale`（`unit:"relative-scale"`），但 `workbenchDataflow.applyChangedPrior()` 是绝对替换（`seed = clampNumber(after, min, max)`）。直接应用会把 `scale=0.7` 当成"把种子设为 0.7"，而非"乘 0.7"。
2. **键不在白名单**：`PRIOR_MAP` 的 3 个键里只有 `cellfree.params.ribosomeTotal` 是真白名单字段；`fbasim.params.substrateUptakeScale`、`dyncon.params.feedbackGain` 不存在，按 DBTL 边界会被**静默跳过**（真实白名单为 `fbasim.glucoseUptake/oxygenUptake`、`dyncon.controller.*`、`dyncon.hill.*`）。
3. **缺端到端测试**：没有"propose → apply → 种子按预期方向移动"的用例，正是这个错位没被 P0-2 测出的原因。

校正方向（P2-1 实现时：语义二选一 + 键对齐 + 补测试）：

- **语义**：优先方案 A——教 `applyChangedPrior()` 认 `unit==="relative-scale"` 走乘性（`seed = clamp(current * after, min, max)`），保留 P0-2"不臆造绝对旋钮值"的诚实做法；或方案 B——让 `toLearnedDelta` 读当前种子后输出绝对 `after`。
- **键对齐**：把 `PRIOR_MAP` 的 `priorKey` 全部对齐到本节新建的 `seedFieldRegistry.ts`，并让 `seedFieldRegistry` 成为**唯一键源**——P0-2 的映射表与 P2-1 的应用层都从它取键，杜绝再次漂移。
- **测试**：新增端到端用例——falsified 报告 → `proposeDeltaFromFalsification` → 审批为 approved → `filterApprovedLearnedDeltaPacks` → seed builder，断言目标种子按预期方向变化。

> 附带（determinism）：P0-2 的 `compare.ts`/`toLearnedDelta.ts` 用 `new Date().toISOString()` 作 `createdAt`，非确定性；若 P0-3 的可复现改造未覆盖这两个文件，在此一并注入可控时钟。

### 修改 / 新建文件
- 修改 `src/components/tools/shared/workbenchDataflow.ts` — 新增 `applyChangedBound()` / `applyChangedWeight()`；扩白名单
- 新建 `src/services/learning/bayesianUpdate.ts` — 后验更新
- 新建 `src/config/seedFieldRegistry.ts` — 可回流字段注册表（集中管理白名单）

### 代码骨架

`src/config/seedFieldRegistry.ts`（把散落的白名单集中、可扩展）：

```ts
export interface SeedField {
  key: string;                 // 如 "cellfree.params.ribosomeTotal"
  toolId: string;
  kind: "prior" | "bound" | "weight";
  min: number; max: number;    // clamp 边界
  priorVariance?: number;      // 贝叶斯先验方差（供 P2-1 后验更新）
}
export const SEED_FIELDS: SeedField[] = [
  { key: "fbasim.glucoseUptake", toolId: "fbasim", kind: "prior", min: 4, max: 20, priorVariance: 4 },
  { key: "catdes.requiredFlux",  toolId: "catdes", kind: "prior", min: 0.15, max: 3.2, priorVariance: 0.2 },
  { key: "cellfree.params.ribosomeTotal", toolId: "cellfree", kind: "prior", min: 0.5, max: 5, priorVariance: 0.5 },
  // …扩展：dyncon.* 控制器与 hill 参数、fbasim.oxygenUptake、以及新增 bound/weight 字段
];
export function seedFieldsFor(toolId: string, kind?: SeedField["kind"]): SeedField[];
```

`src/services/learning/bayesianUpdate.ts`：

```ts
export interface Belief { mean: number; variance: number; }

/** 共轭高斯更新：先验 Belief + 观测(值,方差) → 后验 Belief。取代单点覆盖。 */
export function updateBelief(prior: Belief, obs: { value: number; variance: number }): Belief {
  const k = prior.variance / (prior.variance + obs.variance);
  return { mean: prior.mean + k * (obs.value - prior.mean), variance: (1 - k) * prior.variance };
}
```

`workbenchDataflow.ts` 新增（与现有 `applyChangedPrior` 同风格）：

```ts
function applyChangedBound(current: [number, number], packs: LearnedDeltaPack[], key: string): [number, number] {
  for (const p of packs) { const d = p.changedBounds[key]; if (d) return d.after; }
  return current;
}
function applyChangedWeight(current: number, packs: LearnedDeltaPack[], key: string, min: number, max: number): number {
  for (const p of packs) { const d = p.changedWeights[key]; if (d && Number.isFinite(d.after)) return clampNumber(d.after, min, max); }
  return current;
}
```

### 步骤
1. 建 `seedFieldRegistry.ts`，把现有硬编码白名单迁移进来，逐工具补齐（dyncon 控制器/hill、fbasim.oxygenUptake，以及首批 bound/weight 字段）。
2. 在 `workbenchDataflow.ts` 实现 `applyChangedBound/Weight`，在各 seed builder 里对注册字段统一应用。
3. 建 `bayesianUpdate.ts`；把 `toLearnedDelta.ts`（P0-2）产出的 `after` 从"直接目标值"改为"后验均值"，`priorVariance` 取自注册表，观测方差来自证伪残差散布。
4. 保持人工门控不变：后验只写入 `pending` pack，审批后才落地。

### 验收标准
- `changedBounds` / `changedWeights` 能真正改变对应工具的种子（此前被静默跳过）。
- 连续两轮一致方向的实测证据，贝叶斯后验单调收敛且方差下降（可累积，不来回跳）。
- 未注册字段仍被安全跳过（沿用现有边界语义）。

### 测试桩（`__tests__/dyncon/loopWidening.test.ts`、`__tests__/learning/bayesian.test.ts`）
```ts
it("applyChangedBound updates fbasim uptake bounds", () => {});
it("updateBelief converges toward repeated consistent evidence", () => {});
it("unregistered field is skipped safely", () => {});
```

---

## P2-2 DoE / 主动学习：建议"下一批实验"

### 目标
让平台不止验证，还**主动挑下一批该做的实验**：在设计空间上用采集函数（EI / UCB）选信息量最大的 construct/条件，消费 P0-2 的残差与当前模型不确定度，输出候选批次 → 直接进 P1-1 协议导出，物理闭环。可复用 ProEvol 已有的 GP 回归（`src/services/ProEvolCampaignEngine.ts`）。

### 新建文件
- `src/services/doe/designSpace.ts` — 设计空间定义
- `src/services/doe/acquisition.ts` — 采集函数
- `src/services/doe/suggestNextBatch.ts` — 主编排
- 面板：DBTLflow 增"下一批建议"标签页

### 代码骨架

`src/services/doe/designSpace.ts`：

```ts
export interface DesignDimension { name: string; min: number; max: number; kind: "continuous" | "categorical"; choices?: string[]; }
export interface DesignPoint { values: Record<string, number | string>; }
export interface DesignSpace { dimensions: DesignDimension[]; }
export function sampleCandidates(space: DesignSpace, n: number, seed: number): DesignPoint[];
```

`src/services/doe/acquisition.ts`：

```ts
/** 高斯过程后验 → 采集分数。EI 探索欠采样区，UCB 平衡均值/方差。 */
export function expectedImprovement(mean: number, sd: number, best: number, xi = 0.01): number;
export function upperConfidenceBound(mean: number, sd: number, kappa = 2): number;
```

`src/services/doe/suggestNextBatch.ts`：

```ts
import type { DesignPoint, DesignSpace } from "./designSpace";
import type { FalsificationReport } from "../../types/falsification";

export interface BatchSuggestion {
  points: DesignPoint[];         // 排序后的候选
  rationale: string[];           // 每个点为何入选（探索/利用）
  expectedInfoGain: number[];
}
/**
 * 用历史(设计→实测)拟合 GP（复用 ProEvol GP），
 * 结合最新证伪残差更新，输出 acquisition 排序的下一批。
 */
export function suggestNextBatch(
  space: DesignSpace,
  history: Array<{ point: DesignPoint; observed: number }>,
  recentReports: FalsificationReport[],
  opts: { batchSize: number; strategy: "ei" | "ucb"; seed: number },
): BatchSuggestion;
```

### 步骤
1. 建 `designSpace.ts`，为首个用例（如无细胞表达条件：温度/核糖体/时长）定义维度。
2. 建 `acquisition.ts`（EI/UCB），单元测试对已知函数形状的正确性。
3. 建 `suggestNextBatch.ts`：复用 ProEvol GP 作为代理模型；输入历史 (设计, 实测) + 最新证伪残差；输出排序候选与理由。
4. 面板呈现候选批次，一键送 P1-1 `protocolGenerator` 生成协议 + manifest，闭合到物理执行。
5. 全程确定性（`seed` 透传），候选可复现。

### 验收标准
- 在合成基准函数（如 Branin / 一维正弦）上，EI/UCB 能在有限迭代内逼近最优，优于随机采样。
- 建议批次每个点都能生成通过 P1-1 校验的可执行协议 + manifest。
- 同 `seed` 下建议批次可复现。

### 测试桩（`__tests__/doe/suggestNextBatch.test.ts`）
```ts
it("EI beats random search on a synthetic benchmark", () => {});
it("suggested batch produces executable protocol + manifest", () => {});
it("suggestions are deterministic for a fixed seed", () => {});
```

---

# 跨阶段：依赖、排期、测试、验收

## A. 依赖关系

```
P0-3 (可复现/去桩) ─── 可与一切并行，是研究级前提
P0-1 (预测契约) ──► P0-2 (证伪引擎) ──► P2-1 (回流拓宽/贝叶斯) ──► P2-2 (DoE)
        │                  ▲                     ▲
        ├──► P1-1 (协议+manifest，键对齐) ───────┘
        ├──► P1-2 (LIMS 拉回) ──► P0-2 (提供实测)
        └──► P1-3 (QC 闸/单位归一) ──► P0-2 (提供干净可比数据)
```

要点：**P0-1 与 P0-2 是所有闭环价值的地基**；P1-1 的 manifest 键 与 P1-3 的单位归一 是 P0-2 能正确配对的前置；P2 依赖 P0-2 的残差信号。

## B. 建议排期（相对工作量，非绝对工期）

| 顺序 | 阶段 | 工作量 | 可并行项 |
|---|---|---|---|
| 1 | P0-1 预测契约 | M | P0-3 |
| 2 | P0-3 可复现/去桩 | M | P0-1 |
| 3 | P1-3 QC/单位归一 | S–M | P1-1 |
| 4 | P1-1 协议+manifest | M | P1-2 |
| 5 | P0-2 证伪引擎 | L | — |
| 6 | P1-2 LIMS 双向 | M | — |
| 7 | P2-1 回流拓宽/贝叶斯 | M–L | — |
| 8 | P2-2 DoE 主动学习 | L | — |

> 最小可用闭环（MVP loop）= P0-1 + P0-3 + P1-1 + P1-3 + P0-2。跑通它即可对**一个** construct 完成"预测→执行→回读→证伪→待审 delta"，先在 cellfree 单工具打样，再横向铺开。

## C. 测试策略

三层，全部纳入 CI：

1. **单元测试**：每个新模块的测试桩（上文各节已列）。
2. **确定性快照**：`__tests__/determinism/*`，同输入同种子结果全等（P0-3 的核心保证）。
3. **端到端闭环集成**（新增 `__tests__/integration/dbtl-loop.e2e.test.ts`）——一条打通全链的黄金路径：

```ts
it("closes one DBTL loop: design → protocol → mock instrument → record → falsify → pending delta", async () => {
  // 1. 干实验产出 PredictionRecordV1 (cellfree)               [P0-1]
  // 2. 预登记 ValidationThreshold                              [P0-2]
  // 3. 导出协议 + ProtocolManifest (键: batchId/constructId)    [P1-1]
  // 4. mock 仪器文件 → parser → recordQc → ExperimentRecordV1  [P1-3]
  // 5. LIMS 拉回同一条记录，provenance 链回设计工件            [P1-2]
  // 6. matchRecords + compareToFalsification → verdict         [P0-2]
  // 7. proposeDeltaFromFalsification → pending pack (人工门控)  [P0-2/P2-1]
  // 断言：verdict 合理、delta 通过 validateLearnedDeltaPack、humanGateStatus==="pending"
});
```

## D. 验收总表（对齐 `NEXUS_BIO_RESEARCH_GRADE_ROADMAP.md`）

| 维度 | 验收条件 |
|---|---|
| **Reproducibility Test** | 计算路径无裸 `Math.random`；确定性快照全绿；`seed` 贯穿预测记录 |
| **契约完整性** | 预测与实测经单位归一后可逐点配对；校验器拦截结构错误 |
| **证伪有效性** | 三类 verdict（命中/证伪/不确定）用例通过；无预登记阈值只能 inconclusive |
| **物理可执行** | OT-2 协议过 `opentrons_simulate`；manifest 板图可反查 constructId；含对照/空白 |
| **回流安全** | 数据驱动 delta 一律 `pending`；bounds/weights 生效；贝叶斯后验可累积收敛 |
| **溯源** | 每条 wet-lab 记录 `provenanceIds` 链回设计工件，否则被 QC 闸拦截 |
| **覆盖率** | 新增模块单测覆盖率不低于仓库现有基线；`npm test` 全绿 |

## E. 风险与回退

| 风险 | 缓解 / 回退 |
|---|---|
| 单位/时间轴对齐错误导致假证伪 | 配对前强制 `normalizeUnit`；对齐失败判 `inconclusive` 而非 `falsified` |
| 自动 delta 提案带偏模型 | 全程人工门控 + 贝叶斯阻尼；可一键回退到某个 `deltaPackId` 之前的种子 |
| 去桩改动波及既有算法结果 | 每个引擎先加确定性快照基线，改动前后对比；分 PR 小步合入 |
| OT-2 耗材/液体类别与真实设备不符 | manifest + `validateDeck` 前置校验；真机前先 `opentrons_simulate` |
| LIMS API 差异（非 Benchling） | 统一 `pullAssayResults` 契约 + `genericAdapter`；失败降级为 CSV 导入（`experimentCsvImporter.ts`）|

## F. "完美结合" 的完成定义（Definition of Done）

当以下同时成立，即达成干湿闭环的"完美结合体"：

1. 任一 construct 都能走完 **C 节的端到端闭环**且全绿。
2. 每个预测都带**校准过的预测区间**，每次实测都能给出**pass/falsified/inconclusive** 判定。
3. "学习"由**实测残差自动生成待审提案**，而非人工臆测；审批后经**贝叶斯更新**稳健落地。
4. 平台能**主动建议下一批实验**并一键导出可执行协议，物理闭环。
5. 全链路**确定性、可溯源、人工可控**——满足 roadmap 三项研究级测试。

---

*本方案与仓库现状对齐：类型层 `LearnedDeltaPack.changedBounds/changedWeights` 已存在（应用侧待补）、回流应用点在 `workbenchDataflow.ts`、证伪与预测区间为 `DBTL_TYPED_LOOPBACK.md` / `cellfree-reality-audit.md` 明示的缺口。实现应逐阶段小步 PR，先在 cellfree 单工具打样再横向铺开。*
