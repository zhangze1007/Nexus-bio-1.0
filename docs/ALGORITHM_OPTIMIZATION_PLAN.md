# 算法与工具研究级优化计划（Algorithm & Tool Research-Grade Optimization Plan）

> 版本：v1.0 · 目标：把核心算法/工具从"能跑、部分真实"推进到**研究级**（可复现、对标参照实现、可被论文引用）。
> 方法：三条优化线 × 四个工具簇，**渐进式**推进。
> 配套：与 `docs/NEXUS_BIO_RESEARCH_GRADE_ROADMAP.md`（参照标准表）、`NEXUS_BIO_INTEGRITY_AUDIT_V2.md`（桩清单）对齐。
> 阅读对象：负责实现的工程/科研人员。每一簇（Phase）给出 **桩清单 → 修法 → 参照基准 → 代码骨架 → 验收 → 测试**。

---

## 0. 总览

### 0.1 三条优化线（Tracks）

| 线 | 名称 | 做什么 | 判据 |
|---|---|---|---|
| **T1** | 去桩求真 | 修掉审计里 canned/decoy 的"忽略入参 / 输入无关输出"，让每个 compute 函数真的用它的输入算 | 输入敏感性测试（realness guard）：扰动入参 ⇒ 输出变 |
| **T2** | 对标研究级 | 让工具在参照数据集上匹配参照实现（COBRApy/eQuilibrator/COPASI…），配验证夹具 + 引用 | 参照容差内（见 roadmap 表） |
| **T3** | 数值精度与性能 | 求解稳定性、收敛容差、性能预算 | 数值稳健 + 满足 roadmap 性能预算 |

**每个工具内的三线顺序固定：T1 → T2 → T3。** 不能给桩做基准（先让它真算），也不能在正确之前优化性能。

### 0.2 研究级定义（复用 roadmap 三测）

一个工具达标 = 同时通过：**Reviewer**（同行评审会接受其数据）、**Reproducibility**（同输入同输出，无未播种随机）、**Citation**（常数有文献、结果可引用）+ **参照容差**。

### 0.3 现状（审计 50 桩的分流）

- **已修**：6 个未播种随机（P0-3）+ `emitOpentronsStep`（P1-1）。
- **非科学 infra，另列不进本计划**：`auth/mfa/enable`、`files/[...key]`、`rbac.ts`、`axonAdapterRegistry`、`inventoryExport`。
  - ⚠️ 其中 `rbac.ts:122 canPerformAction()` **忽略 `projectId`** 属**潜在越权 bug**，建议作为独立安全修复优先处理（不占算法线）。
- **mock 数据桩，低优先**：`mockGenMIM.designsgRNAs`、`mockProEvol.generateEvolutionTrajectory`（demo 回退，非真算路径）。
- **剩 ~35 个真算桩**，按四簇分布，是本计划主体。

### 0.4 四个工具簇（Phases，渐进顺序）

| Phase | 簇 | 覆盖工具/引擎 | 参照标准 | 相对量 |
|---|---|---|---|---|
| **P1** | 代谢核心 | FBA / dFBA / loopless-FBA / CETHX 热力学 / 动力学 / 13C-MFA / 逆合成 | COBRApy 1% · eQuilibrator 2 kJ/mol · COPASI 5% | L |
| **P2** | 蛋白与酶 | CatDes ΔΔG / 逆折叠 / rfdiffusion / 调控盒 / 质粒 / RBS | FoldX R²>0.3 | L |
| **P3** | 基因组与线路 | GenMIM planKnockdowns / Cas12a / gRNA / DNA 组装 / BGC | CHOPCHOP off-target | M |
| **P4** | 组学与仿真 | MPC / UMAP / 差异表达 / ScSpatial 聚类 / 基因表达预测 | scanpy 10% · Squidpy 5% | M |

> 顺序理由：代谢核心最基础、被下游最多工具依赖、参照标准最清晰（COBRApy/eQuilibrator），故先行；随后蛋白、基因组、组学。**每一簇独立可交付、可单独开 `/goal`。**

---

## 跨阶段基础设施（先建一次，四簇复用）

这是整个计划的地基，Phase 1 的第一步就是把它建出来。

### CC-1 "求真"守卫（realness harness）

P0-3 的 determinism 守卫保证"**同输入同输出**"；本守卫是它的对偶，保证"**不同输入不同输出**"——直接把 decoy/canned 测出来。

- 新建 `__tests__/realness/` — 每个 compute 函数一条**输入敏感性属性测试**：固定其它入参，逐个扰动目标入参，断言输出随之变化。
- 新建 `scripts/check-realness.mjs`（可选静态辅助）— 扫描 `src/server|modules|services` 中"声明了参数却在函数体内从未引用"的导出 compute 函数，输出疑似 decoy 清单（供人工确认，不做硬失败，避免误报）。

```ts
// __tests__/realness/_harness.ts
/** 断言 fn 对 argIndex 处入参敏感：至少一组扰动改变输出。 */
export function assertInputSensitive<A extends unknown[]>(
  fn: (...a: A) => unknown,
  baseArgs: A,
  argIndex: number,
  perturbations: A[number][],
): void {
  const base = JSON.stringify(fn(...baseArgs));
  const changed = perturbations.some((p) => {
    const a = [...baseArgs] as A;
    a[argIndex] = p;
    return JSON.stringify(fn(...a)) !== base;
  });
  if (!changed) throw new Error(`Input ${argIndex} of ${fn.name} is ignored (decoy/canned).`);
}
```

### CC-2 参照夹具（reference fixtures）

- 新建 `benchmarks/reference/<tool>/` — 存 `(input, referenceOutput, tolerance, source)` 夹具，`referenceOutput` 从参照实现（COBRApy/eQuilibrator/COPASI…）离线导出并提交。
- 新建 `src/services/benchmark/referenceRunner.ts` — 通用"跑本工具 → 与夹具比 → within tolerance"。

```ts
// src/services/benchmark/referenceRunner.ts
export interface ReferenceCase<I, O> {
  id: string;
  input: I;
  expected: O;
  tolerance: number;        // 相对或绝对，按 metric 定
  metric: "rel" | "abs";
  source: string;           // 文献/工具+版本，供 Citation 测
}
export interface ReferenceReport {
  caseId: string; ok: boolean; observed: number; expected: number; error: number; source: string;
}
export function runReferenceCase<I, O extends number | number[]>(
  compute: (input: I) => O,
  c: ReferenceCase<I, O>,
): ReferenceReport[]; // 逐标量比对，error ≤ tolerance 即 ok
```

### CC-3 复用既有

- P0-3 的 `src/utils/rng.ts`（播种随机）+ `scripts/check-determinism.mjs`（无裸 Math.random）。
- 每簇完工后把 realness / determinism / reference 三守卫都并入 CI。

---

# Phase 1 · 代谢核心（FBA / 热力学 / 动力学 / 通量）

最基础、下游依赖最多、参照最清晰。先在这里把跨阶段三守卫跑通，再横向复制。

## P1-T1 去桩求真

本簇真算桩清单与修法：

| 文件:行 | 函数 | 被忽略入参 | 应有算法 / 修法 |
|---|---|---|---|
| `fbaDynamic.ts:208` | `computeDerivative(reactions,…)` | `reactions` | dFBA 的 dc/dt 必须由当前通量解 + 反应化学计量算；用 `reactions` 的 stoichiometry × 当前 FBA 通量组装导数向量 |
| `looplessFBA.ts:201` | `detectLoops(externalMetabolites)` | `externalMetabolites` | ll-FBA 找的是**内部**热力学循环，须先排除交换/外部代谢物；用 `externalMetabolites` 过滤零和环 |
| `looplessFBA.ts:338` | `hasLoops(externalMetabolites)` | `externalMetabolites` | 同上，判定端一致化 |
| `mfa13CEngine.ts:464` | `simulateNetworkMIDs(fluxes)` | `fluxes` | 13C-MFA 的质量同位素分布必须由 `fluxes` 经 EMU 网络前向模拟得到；接上 EMU 分解 |
| `retrosynthesis.ts:159` | `computeScore(targetNorm,precursors)` | 两者 | 评分须基于 target↔precursor 结构相似度与路线步数，而非常量 |
| `cellFreeMetabolicEngine.ts:86` | `modelEnergySystem(initialConc,dt)` | `initialConc,dt` | 能量池 ODE 须从 `initialConc` 起、按 `dt` 步进（RK4） |

> 每修一个，配一条 `__tests__/realness/metabolic.test.ts` 的输入敏感性测试（用 CC-1 的 `assertInputSensitive`）。

## P1-T2 对标研究级

| 工具 | 参照 | 容差 | 夹具位置 |
|---|---|---|---|
| FBA | COBRApy（`e_coli_core`、`iJO1366`） | LP 目标值 & 关键通量 **1%** | `benchmarks/reference/fba/` |
| CETHX | eQuilibrator 3 | ΔG'° **2 kJ/mol** | `benchmarks/reference/cethx/` |
| 动力学 | COPASI | ODE 轨迹 **5%** | `benchmarks/reference/kinetics/` |

夹具从参照实现离线导出（脚本记录版本），提交进仓库；用 CC-2 的 `runReferenceCase` 断言。

## P1-T3 数值精度与性能

- LP：退化/循环用 Bland 规则防死循环；报告最优性/可行性。
- ODE：自适应步长 + 相对/绝对容差；刚性时降步。
- 性能：对齐 roadmap 实测预算（如 `solveAuthorityFBA < 5s`，实测 ~1.8ms）。

## 代码骨架（新建）

- `__tests__/realness/_harness.ts`（CC-1）
- `__tests__/realness/metabolic.test.ts`
- `src/services/benchmark/referenceRunner.ts`（CC-2）
- `benchmarks/reference/fba/e_coli_core.core.json` 等夹具 + `scripts/export-reference/` 导出说明
- `scripts/check-realness.mjs`（可选静态辅助）

## 验收（Phase 1）

- 本簇 6 个真算桩全部关闭：`metabolic.test.ts` 输入敏感性全绿。
- FBA/CETHX/动力学各自 within 容差（reference 夹具全绿）。
- `check-determinism.mjs` 仍退出 0；性能预算达标；全量 `npm test` 无回归。

## 测试桩

```ts
// __tests__/realness/metabolic.test.ts
it("fbaDynamic.computeDerivative uses reaction stoichiometry (not canned)", () => {/* assertInputSensitive on reactions */});
it("looplessFBA.detectLoops excludes external metabolites", () => {});
it("mfa13C.simulateNetworkMIDs varies with fluxes", () => {});
// __tests__/benchmark/fba.reference.test.ts
it("FBA objective matches COBRApy within 1% (e_coli_core)", () => {});
it("CETHX ΔG'° matches eQuilibrator within 2 kJ/mol", () => {});
```

---

# Phase 2 · 蛋白与酶（CatDes ΔΔG / 逆折叠 / rfdiffusion / 调控 / 质粒 / RBS）

复用 Phase 1 建好的 realness / reference / determinism 三守卫。

## P2-T1 去桩求真

| 文件:行 | 函数 | 被忽略入参 | 应有算法 / 修法 |
|---|---|---|---|
| `ddgPrediction.ts:163` | `computeVdW(structure)` | `structure` | ΔΔG 的范德华项必须由原子坐标算；用 `structure` 的坐标做接触/重叠 |
| `ddgPrediction.ts:212` | `computeSolvation(structure)` | `structure` | 溶剂化项须由结构埋藏面积/可及性算 |
| `ddgPrediction.ts:601` | `scanAllMutations(chainId)` | `chainId` | 扫描须限定在 `chainId` 指定链上 |
| `inverseFoldingEngine.ts:618` | `sampleSequence(temperature)` | `temperature` | 采样温度须调制 softmax 分布（低温更确定） |
| `inverseFoldingEngine.ts:763` | `computeDesignScore(pssm)` | `pssm` | 设计分须用位置特异打分矩阵 `pssm` |
| `rfdiffusion.ts:212` | `generateHeuristicSequence(temperature)` | `temperature` | 同逆折叠，温度调制采样 |
| `regulatoryDesignEngine.ts:602` | `computeStandbySite(cds)` | `cds` | RBS standby 结构须依 `cds` 前导序列算 |
| `regulatoryDesignEngine.ts:942` | `optimizeCodons(organism)` | `organism` | 密码子优化须用 `organism` 的密码子使用表 |
| `plasmidDesignEngine.ts:507` | `optimizeCDS(host)` | `host` | 同上，按 `host` 偏好 |
| `rbsCalculator.ts:221` | `computeSpacing(cdsSeq)` | `cdsSeq` | 间距/强度须依 `cdsSeq` 起始上下文算 |

## P2-T2 对标 · P2-T3 精度

- **对标**：CatDes ΔΔG ↔ **FoldX**，相关 **R² > 0.3**（`benchmarks/reference/catdes/`，用一组已知 ΔΔG 突变集）。逆折叠可对标序列恢复率（native sequence recovery）。
- **精度**：坐标基打分的数值稳定（缺原子/多构象处理）；密码子表齐全性。

## 验收（Phase 2）
本簇 10 个桩 realness 全绿；ΔΔG↔FoldX R²>0.3；determinism 绿；全量无回归。

---

# Phase 3 · 基因组与线路（GenMIM / CRISPR / gRNA / 组装 / BGC）

含审计里**唯一 severity-5** 的 canned：`planKnockdowns`。

## P3-T1 去桩求真

| 文件:行 | 函数 | 问题 | 应有算法 / 修法 |
|---|---|---|---|
| `genmimPipeline.ts:63` | `planKnockdowns(spec)` | **canned（sev 5）**，忽略 `spec` | 敲除计划须依 `spec` 的目标基因/目标产物/约束驱动 essentiality 与调度，而非返回固定方案 |
| `crisprCas12aEngine.ts:419` | `calculateGenericEfficiency(pam,variant)` | 忽略 `pam,variant` | 效率须依 PAM 匹配与酶变体参数算 |
| `grnaDesigner.ts:329` | `designgRNAs(geneName)` | 忽略 `geneName` | 候选须来自 `geneName` 对应序列窗口 |
| `grnaDesigner.ts:388` | `evaluateCandidate(pamDef)` | 忽略 `pamDef` | 打分须按 `pamDef` 的 PAM 规则 |
| `dnaAssemblyEngine.ts:401` | `generateOverhang(frag2Start)` | 忽略 `frag2Start` | Gibson/Golden Gate overhang 须依接头位置 `frag2Start` 生成 |
| `bgcDetection.ts:325` | `clusterGenesIntoRegions(geneScores)` | 忽略 `geneScores` | 基因簇聚类须用 `geneScores` |

## P3-T2 对标 · P3-T3
- **对标**：gRNA 脱靶/在靶 ↔ **CHOPCHOP**（Rule Set 2 在靶、脱靶计数一致）；`benchmarks/reference/grna/`。
- **精度**：多重敲除的组合搜索复杂度控制、epistasis 近似。

## 验收（Phase 3）
6 个桩 realness 全绿（`planKnockdowns` 用 `spec` 变化驱动结果变化）；gRNA↔CHOPCHOP 一致；无回归。

---

# Phase 4 · 组学与仿真（MPC / UMAP / 差异表达 / ScSpatial / 基因表达）

## P4-T1 去桩求真

| 文件:行 | 函数 | 被忽略入参 | 应有算法 / 修法 |
|---|---|---|---|
| `modelPredictiveControl.ts:176` | `buildPredictionMatrices(c,Nc)` | `c,Nc` | 预测矩阵须依控制时域 `Nc`、输出向量 `c` 组装 |
| `umapEngine.ts:236` | `optimizeEmbedding(knnGraph)` | `knnGraph` | 嵌入优化须在 `knnGraph` 上做力导/交叉熵 |
| `multiOmicsPipeline.ts:634` | `runDifferentialExpression(sampleNames)` | `sampleNames` | 分组差异须按 `sampleNames` 的分组做 |
| `ScSpatialEngine.ts:795` | `computeModularity(adjList)` | `adjList` | 模块度须在 `adjList` 图上算 |
| `ScSpatialEngine.ts:872` | `louvainPhase2(edgeWeights)` | `edgeWeights` | Louvain 第二阶段须用 `edgeWeights` |
| `geneExpressionPredictor.ts:891` | `generateSuggestions(bottlenecks)` | `bottlenecks` | 建议须由 `bottlenecks` 驱动 |

## P4-T2 对标 · P4-T3
- **对标**：MultiO PCA loadings ↔ **scanpy** 10%；ScSpatial Moran's I ↔ **Squidpy** 5%；DynCon MPC ↔ **SimBiology** 10%。夹具需 Python 侧离线导出（scanpy/squidpy）后提交 JSON。
- **精度**：UMAP/Louvain 的确定性（播种）+ 收敛。

## 验收（Phase 4）
6 个桩 realness 全绿；组学三项 within 容差；确定性绿；无回归。

---

# 跨阶段：依赖、排期、验收、风险

## A. 依赖
```
CC-1 realness harness ┐
CC-2 reference runner ├─（Phase 1 内先建）─► P1 ─► P2 ─► P3 ─► P4
P0-3 determinism/rng  ┘        每簇复用同一套三守卫
```
三守卫在 Phase 1 建成后，P2–P4 只是"填桩清单 + 加夹具"，边际成本递减——这正是渐进式的价值。

## B. 排期（相对量，非绝对工期）
| 顺序 | Phase | 桩数 | 参照 | 量 |
|---|---|---|---|---|
| 1 | P1 代谢核心（含三守卫地基） | 6 | COBRApy/eQuilibrator/COPASI | L |
| 2 | P2 蛋白与酶 | 10 | FoldX | L |
| 3 | P3 基因组与线路 | 6（含 sev-5） | CHOPCHOP | M |
| 4 | P4 组学与仿真 | 6 | scanpy/Squidpy/SimBiology | M |

> 每个 Phase = 一个 `/goal`。建议先跑 P1（把三守卫地基一并建出来），我再逐簇 review。

## C. 全局验收（对齐 roadmap 三测）
- **Reproducibility**：`check-determinism.mjs` 全绿（沿用 P0-3）。
- **Realness**：`__tests__/realness/*` 全绿——所有真算桩对其入参敏感；CI 常驻。
- **Reviewer / Citation**：每工具 within 参照容差，夹具标注 `source`（工具+版本/文献）。
- 全量 `npm test` 无回归。

## D. 风险与回退
| 风险 | 缓解 |
|---|---|
| 去桩会**改变既有输出**（桩本来返回固定值） | 每个引擎先打 snapshot 基线，改动前后对比并在 PR 说明"这是有意的正确性修正"；小步 PR |
| 参照实现（COBRApy/eQuilibrator/scanpy）是 Python，JS 侧跑不了 | 夹具**离线**用 Python 生成 (input, expected) 提交 JSON；`scripts/export-reference/` 记录版本，保证可复现 |
| realness 守卫误报（合法的常量分支） | realness 用**测试**（人工写敏感性用例）而非纯静态；静态脚本只做提示不硬失败 |
| 把 mock 数据文件当真算改 | 明确区分：`src/data/mock*` 是 demo 回退，不在本计划改动范围 |
| 触及安全项 | `rbac.ts` 越权项**独立**作安全修复，不混进算法线 |

## E. 完成定义
四簇桩全部关闭（realness 全绿）、各工具 within 参照容差、三守卫并入 CI、全量无回归时，平台达到"**每个工具的输出都能写进论文而不脸红**"（roadmap 三测）。此后即进入持续标定/新算法阶段。

---

*说明：本计划的桩清单逐条来自 `NEXUS_BIO_INTEGRITY_AUDIT_V2.md`（已剔除 P0-3/P1-1 已修项、非科学 infra 项、mock 数据项）；参照标准来自 `NEXUS_BIO_RESEARCH_GRADE_ROADMAP.md`。实现按 Phase 小步 PR，先在代谢核心把三守卫地基跑通再横向复制。*
