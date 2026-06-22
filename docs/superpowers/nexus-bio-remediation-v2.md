# Nexus-Bio 修复执行方案 v2
**基线 commit**: `242bcd7b545757b2c9a4955175a3711325efc34d`（2026-06-22）  
**审计状态**: 本方案只包含已在仓库中直接验证过的问题，文件路径和行号均为实测值

---

## 工作纪律（必读，不允许跳过）

1. **按编号顺序执行**，不允许跳级。后面的任务依赖前面的判断结论。
2. **每项任务完成后输出"证据块"**（见每节末尾的 VERIFY 格式），不接受"已完成"的口头声明。
3. **修 bug 前先理解 bug**——本方案已提供了精确的代码位置和错误原因，直接对照改，不要自行发挥。
4. **不允许通过弱化断言来让测试通过**——例如把 `toBeCloseTo(x, 4)` 改成 `toBeDefined()` 算违规。
5. **不允许修改 toolValidity.ts 里的 level 为比 'real' 更高的值**——不存在比 'real' 更高的级别，不要试图绕过。

---

## 任务 1 — digitalTwinEngine：修复两个 EKF 数学 bug，降级 badge

### 背景
`src/config/toolValidity.ts` 第 58 行把 `digitaltwin` 标为 `level: 'real'`，但同一行 caption 承认了两个数学 bug。有已知数学错误的实现不应标 'real'——'real' 在整个 honesty 系统里的语义是"算法端到端正确"。

### Bug 1：Mahalanobis 用 S 而不是 S⁻¹
**文件**：`src/server/digitalTwinEngine.ts`  
**行号**：483–487  
**当前错误代码**：
```typescript
const StimesInnovation = matMul(S, innovation.map(v => [v])).flat();
const mahalanobis = innovation.reduce((sum, yi, i) => sum + yi * StimesInnovation[i], 0);
```
**错误原因**：计算的是 `yᵀ S y`（用 S 乘）。正确的 Mahalanobis 距离公式是 `yᵀ S⁻¹ y`。S⁻¹ 已经在同一个函数作用域里算好了（第 462 行 `const Sinv = matInverse(S)`），只是没被 likelihood 用到。

**正确代码**：
```typescript
// 直接复用上面已算好的 Sinv，不需要重新 matInverse
const SinvTimesInnovation = matMul(Sinv, innovation.map(v => [v])).flat();
const mahalanobis = innovation.reduce((sum, yi, i) => sum + yi * SinvTimesInnovation[i], 0);
```
注意：`Sdet` 的计算（第 483 行）用的是 S 的对角元素，是正确的——不要改。

### Bug 2：NIS detectAnomaly 传入的是 P 对角线而不是 S 对角线
**文件**：`src/server/digitalTwinEngine.ts`  
**行号**：685–690（调用端）和 520–540（函数定义）

**当前错误代码（调用端）**：
```typescript
const innovationCov = ekf.getUncertainty();       // 返回 √P 对角线
const anomalyResult = detectAnomaly(
  innovation,
  [innovationCov.biomass ** 2, innovationCov.substrate ** 2, innovationCov.product ** 2],
  // 上面这行 = [P[0][0], P[1][1], P[2][2]] —— 这是状态协方差，不是创新协方差
);
```

**错误原因**：`getUncertainty()` 返回 `√P` 的各分量（见第 498–505 行）。平方后得到 P 的对角线。但 `detectAnomaly` 需要的是 S 的对角线（创新协方差 `S = H P Hᵀ + R`）。S 在 `update()` 里计算了但没有返回。

**修复方案**：让 `update()` 额外返回 S 的对角线，供调用端传给 `detectAnomaly`。

Step 1：在 `update()` 的 return 里加 `innovationCovDiag`：
```typescript
// 在 "Extract Kalman gains for display" 之后，return 之前
const innovationCovDiag = [
  S[0][0],
  S[1]?.[1] ?? S[0][0],
  S[2]?.[2] ?? S[0][0],
];

return { innovation, kalmanGains, likelihood: Math.min(1, likelihood), innovationCovDiag };
```

Step 2：更新调用端（约第 680 行）：
```typescript
const { innovation, kalmanGains, likelihood, innovationCovDiag } = ekf.update(measurement, mask);
// ...
const anomalyResult = detectAnomaly(innovation, innovationCovDiag);
```

### Badge 降级
**文件**：`src/config/toolValidity.ts` 第 58 行  
**改动**：`level: 'real'` → `level: 'partial'`  
**caption 不需要修改**——caption 已经诚实地描述了这两个 bug，这正是 'partial' 的合适理由。Bug 修好后可以升回 'real'，但要先修完再升。

### 新增回归测试
**文件**：`__tests__/digitalTwinEngine.test.ts`

在现有测试后追加以下两个 test（放在新的 `describe('EKF Mathematical Correctness', ...)` 块里）：

```typescript
describe('EKF Mathematical Correctness — Bug Regressions', () => {
  test('likelihood decreases monotonically as innovation magnitude grows (Mahalanobis bug regression)', async () => {
    // 如果 Mahalanobis 用了错误的 S（而不是 S⁻¹），likelihood 在大 innovation 时
    // 可能反而升高（因为 yᵀSy 不是概率密度的正确指数项）
    // 正确的 EKF likelihood 随 ||innovation|| 单调减小（高斯分布性质）
    const base = makeReadings(10, { biomassNoise: 0.01 });
    const noisy = makeReadings(10, { biomassNoise: 2.0 });  // 大偏差 → 小 likelihood

    const r1 = await runDigitalTwin({ readings: base });
    const r2 = await runDigitalTwin({ readings: noisy });

    const avgLikelihood1 = r1.updateHistory.reduce((s, u) => s + u.likelihood, 0) / r1.updateHistory.length;
    const avgLikelihood2 = r2.updateHistory.reduce((s, u) => s + u.likelihood, 0) / r2.updateHistory.length;

    // 噪声大的 run 平均 likelihood 应显著低于噪声小的 run
    expect(avgLikelihood2).toBeLessThan(avgLikelihood1);
  });

  test('anomaly score uses innovation covariance S not state covariance P (NIS bug regression)', async () => {
    // 如果 NIS 用了 P 而不是 S，当 P 很大时 NIS 会被人工压低（导致漏检真实异常）
    // 构造一个 innovation 很大、但模型不确定性（P）也很大的场景
    // 正确的 NIS 应该还是高（因为 innovation/S 大），错误的实现会低（因为 innovation/P 小）
    // 验证：固定 innovation，用高初始不确定性的 config 不应该让 anomalyScore 变低
    const readings = makeReadings(5, { biomassNoise: 0.5 });  // moderate anomaly
    const result = await runDigitalTwin({ readings });
    const anomalousUpdates = result.updateHistory.filter(u => u.anomalyScore > 0.3);
    // 如果 NIS 正确使用 S，中等 innovation 在合理 R 下应该至少触发一些异常检测
    expect(anomalousUpdates.length).toBeGreaterThan(0);
  });
});
```

注意：`makeReadings` 需要是一个 helper，接受 noise 参数生成 sensor readings。如果测试文件里已有类似工具函数直接复用，没有就在测试文件头部写一个简单的。

### VERIFY（此任务完成的可核查证据）
```
[ ] git diff src/server/digitalTwinEngine.ts 显示：
    - 第 484 行：StimesInnovation → SinvTimesInnovation（使用 Sinv 而非 S）
    - update() return 新增 innovationCovDiag: number[]
    - detectAnomaly 调用处参数从 P 对角线改为 innovationCovDiag
[ ] git diff src/config/toolValidity.ts 显示：
    - digitaltwin level: 'real' → level: 'partial'
[ ] 新增两个回归测试存在且通过（npm test -- --testPathPattern=digitalTwin 输出 2 new tests pass）
[ ] 两个回归测试的断言是具体数值比较，不是 toBeDefined() 或 toBeTruthy()
```

---

## 任务 2 — fbaEngine：解决 growthRate 换算系数缺乏科学溯源，修正测试期望值

### 背景
`src/server/fbaEngine.ts` 第 103 行和第 475 行用了魔法数字 `0.061`（E. coli）和 `0.045`（yeast）把 BIOMASS LP 目标函数值换算为 growth rate。无文献来源。测试文件第 90–92 行用循环推导出来的 1.22 作为"已知解验证"——这不是独立验证，而是在验证数学式 20×0.061=1.22 本身。

真实 iJO1366 在好氧葡萄糖 10 mmol/gDW/h 条件下的标准参考值（COBRApy/BiGG）：growth rate ≈ **0.74 h⁻¹**，不是 1.22。

### 根本原因
BIOMASS 反应（`src/data/iJO1366Subset.ts` 第 245 行）设了 `ub: 100`，允许 LP 把 BIOMASS flux 优化到 ~20，超出生物学合理范围。0.061 是事后用来把这个非物理数字缩放回"看起来正常"区间的，没有理论依据。

### 修复方案（两步）

**Step 1：给 toolValidity.ts 里 fbasim 的 caption 加一句说明**

**文件**：`src/config/toolValidity.ts`  
在 fbasim 的现有 caption 末尾追加：
```
'; growthRate is a scaled proxy (×0.061 E. coli / ×0.045 yeast) whose scaling factor is heuristic and not derived from literature; raw LP objective value is available as objectiveValue.'
```

**Step 2：修改 `__tests__/fbaEngine.test.ts` 的 "known-solution" 测试**

**文件**：`__tests__/fbaEngine.test.ts` 第 87–93 行

**当前（循环验证，不可接受）**：
```typescript
test('E. coli growth rate matches hand-calculated value', async () => {
  // growthRate = BIOMASS * 0.061 = 20 * 0.061 = 1.22   ← 这是从代码倒推的，不是独立验证
  const result = await solveAuthorityFBA({ species: 'ecoli', ... });
  expect(result.growthRate).toBeCloseTo(1.22, 2);
});
```

**修改为（诚实的测试 + 独立的不变量检查）**：
```typescript
test('E. coli LP objective value is in a positive finite range for standard conditions', async () => {
  // NOTE: growthRate = objectiveValue * 0.061（E. coli heuristic scaling, no literature source）
  // 本测试只验证 LP 返回正数且在 (0, 50] 内（工程合理性上界）
  // 不验证与文献值吻合，因为 0.061 系数未经文献校准
  // Reference limitation: documented in toolValidity.ts fbasim caption
  const result = await solveAuthorityFBA({
    species: 'ecoli', objective: 'biomass', glucoseUptake: 10, oxygenUptake: 20
  });
  expect(result.feasible).toBe(true);
  expect(result.growthRate).toBeGreaterThan(0);
  expect(result.growthRate).toBeLessThanOrEqual(50); // 工程上界
  // 如果 0.061 系数未来被文献校准后，改为 toBeCloseTo(0.74, 1)
});

test('E. coli growth rate scales monotonically with glucose uptake (parameter sensitivity)', async () => {
  // 独立验证：glucoseUptake 增大 → growthRate 不应减小（生物学单调性）
  const low  = await solveAuthorityFBA({ species: 'ecoli', objective: 'biomass', glucoseUptake: 5,  oxygenUptake: 20 });
  const high = await solveAuthorityFBA({ species: 'ecoli', objective: 'biomass', glucoseUptake: 15, oxygenUptake: 20 });
  expect(high.growthRate).toBeGreaterThanOrEqual(low.growthRate);
});
```

同时在 `solveExpandedFBA` 的返回注释里加一行：
```typescript
// NOTE: growthRate = fluxes.BIOMASS * 0.061 is a heuristic scaling factor.
// The raw BIOMASS LP objective value is available as objectiveValue.
// Scientific provenance: none. Do not use growthRate as a quantitative
// prediction against experimental data without independent calibration.
```

### VERIFY
```
[ ] toolValidity.ts fbasim caption 末尾新增了 growthRate scaling 的说明
[ ] fbaEngine.test.ts 里 "matches hand-calculated value" 测试已移除或替换
[ ] 新测试中没有出现 1.22 这个数字
[ ] 新增的单调性测试（glucoseUptake 5 vs 15）存在且通过
[ ] 其余 37 个测试仍然通过（npm test -- --testPathPattern=fbaEngine）
```

---

## 任务 3 — 4 个新增 tabs 补 validity badge

今天新增的 4 个功能没有进 `src/config/toolValidity.ts`，产生新的披露缺口。

对每个 engine，先完整读完实现，再按下面已经分析好的结论填写 caption。**不允许不读实现就直接复制粘贴下面的 caption**——如果发现实现跟下面的分析不符，以实际代码为准，更新 caption。

### 3a — 13C-MFA（`src/server/mfa13CEngine.ts`）
**已验证情况**：
- EMU 分解结构是真实的（Antoniewicz 2007 引用真实存在）
- `monteCarloConfidenceIntervals` 用了真实的 Box-Muller 采样（第 597–601 行），不是假 MC
- 已知限制：grid search 估计通量（非非线性最优化），无原子映射验证
- docstring 自己说"No Monte Carlo confidence intervals"但代码里有且是真实的——caption 要纠正这个误导

**建议 level**：`'partial'`  
**建议 caption**：
```
'EMU decomposition and isotopomer balancing (Antoniewicz 2007) are real. 
Monte Carlo confidence intervals via Box-Muller perturbation are genuine. 
Limitations: flux estimation uses grid search (not nonlinear least-squares); 
no atom mapping verification; σ=0.01 noise level is fixed, not data-driven.'
```

### 3b — GEM Reconstruction（`src/server/gemReconstructionEngine.ts`）
**已验证情况**：
- 使用 `IJO1366_REACTIONS` 真实化学计量数据（第 21 行 import）
- GPR boolean 解析器是真实逻辑（docstring 说"Full GPR boolean parser"）
- KEGG reaction mapping 是用 iJO1366Subset 模拟的，不是真实 KEGG API
- biomass 组成来自 iJO1366（第 403 行）

**建议 level**：`'partial'`  
**建议 caption**：
```
'GPR boolean parsing and iJO1366 stoichiometric matrix assembly are real. 
Biomass composition from iJO1366 (Orth et al. 2011). 
Limitations: KEGG reaction mapping uses iJO1366Subset as proxy (no live KEGG API); 
no gap-filling; no organism-specific biomass optimization.'
```

### 3c — RNA Engineering（`src/modules/rna-engine/rnaEngine.ts`）
**已验证情况**：
- Turner 2009 nearest-neighbor 参数表（NN_RNA）是真实文献值（Turner & Mathews 2010，NAR 38:D280）
- Watson-Crick + wobble 配对检查是正确实现
- 没有真实的 RNA 二级结构预测（没有接 NUPACK / RNAfold / ViennaRNA）

**建议 level**：`'partial'`  
**建议 caption**：
```
'Turner 2009 nearest-neighbor stacking parameters (Turner & Mathews 2010 NAR) 
and Watson-Crick/wobble complementarity rules are genuine. 
Limitations: no full secondary structure prediction (no NUPACK/RNAfold integration); 
thermodynamic scores are nearest-neighbor approximations only; 
off-target scoring uses simplified similarity, not full alignment.'
```

### 3d — Biosafety（`src/modules/biosafety/safetyEngine.ts`）
**已验证情况**：
- k-mer Jaccard similarity 是真实算法（第 129–136 行）
- 毒力因子和 Select Agent 数据库是内嵌的硬编码模式，不是真实 VFDB 下载
- 21-mer 精确匹配（`seq.includes(pattern)`）对真实序列可靠性很低（单碱基突变就会漏检）
- 依赖 `../../core/safety/riskModel`——需要确认该文件存在（否则是运行时错误）

**建议 level**：`'demo'`（比其他三个更低，因为数据库是完全模拟的）  
**建议 caption**：
```
'k-mer Jaccard similarity algorithm is real. 
Pattern database is a 14-entry simulated subset (not live VFDB/CDC download); 
21-mer substring matching has very low sensitivity to real mutant sequences. 
Not suitable for actual biosafety screening without BLAST integration and live database.'
```

### 操作
在 `src/config/toolValidity.ts` 里，在现有 4 个 frontier engine 条目（第 55–58 行）后追加：

```typescript
// ── Expansion tabs (2026-06-22) ───────────────────────────────────────────
mfa13c:          { level: 'partial', caption: '...' },
gemreconstruct:  { level: 'partial', caption: '...' },
rnaengineering:  { level: 'partial', caption: '...' },
biosafety:       { level: 'demo',    caption: '...' },
```

**注意**：moduleId 的拼写要和 toolRegistry.ts 里对应工具的 `id` 字段完全一致（大小写敏感）。先检查 toolRegistry.ts 里这几个新 tab 是怎么注册的，再决定 key 名。如果这几个 tab 是作为现有工具的子 tab 而不是独立工具注册的，那 moduleId 方案需要调整——可以加 toolId:tabId 格式，但要先确认 ToolShell 的 badge 渲染逻辑是否支持这个格式。

### 同时检查：`src/core/safety/riskModel.ts` 是否存在
```bash
find src/core -name "riskModel*" | head -5
```
如果不存在，`safetyEngine.ts` 会在运行时报 module not found，这是比 badge 缺失更紧急的 P0 bug。

### VERIFY
```
[ ] toolValidity.ts 新增了 4 条目，moduleId 与 toolRegistry.ts 里实际注册的 id 对得上
[ ] biosafety 的 level 是 'demo'，不是 'partial' 或 'real'
[ ] riskModel.ts 存在且能被正常 import（运行 `npx tsc --noEmit` 无报错）
[ ] caption 里没有出现任何无法在代码里验证的能力描述
```

---

## 任务 4 — pathwayDiscovery 和 digitalTwin：为已知缺陷补回归测试

### 背景
`toolValidity.ts` 里对这两个引擎诚实地列出了已知问题，但对应的测试完全没有覆盖这些问题边界。这意味着以后有人"修了"这些问题（或者意外改变了行为），测试感知不到。

### 4a — pathwayDiscovery 已知缺陷回归测试
`toolValidity.ts` caption：`'heuristic is broken (empty functional groups); atom economy is a fixed lookup; no mass conservation'`

**文件**：`__tests__/pathwayDiscoveryEngine.test.ts`  
追加一个 `describe('Known Limitations — Regression Guards', ...)` 块：

```typescript
describe('Known Limitations — Regression Guards', () => {
  test('heuristic breakage: search still returns paths when functional group scoring fails', () => {
    // toolValidity caption: "heuristic is broken (empty functional groups)"
    // 这意味着 A* heuristic 退化为 0 或固定值，搜索仍能完成（不能因 heuristic=0 就 throw）
    // 如果有人"修了"heuristic，这个 test 要能继续通过（不能因为 heuristic 不是 0 就 fail）
    const result = discoverPathways({ precursor: 'pyruvate', target: 'acetyl_coa' });
    expect(result.pathways.length).toBeGreaterThanOrEqual(1);
    // 但同时记录：步骤分数不应全为同一个固定值（如果修好了，enzymeScore 应该有变化）
    const scores = result.pathways[0].steps.map(s => s.enzymeScore);
    // 当前实现因 heuristic broken，scores 可能全相同——记录当前行为
    // 当 heuristic 修好后，这个断言可以改为 expect(new Set(scores).size).toBeGreaterThan(1)
    expect(scores.length).toBeGreaterThan(0); // placeholder，等 heuristic 修好后加强
  });

  test('atom economy: value is a fixed lookup (same precursor always returns same atom economy)', () => {
    // toolValidity caption: "atom economy is a fixed lookup"
    // 验证当前行为：同一对 precursor/target，无论 steps 如何变化，atomEconomy 应该一致
    const r1 = discoverPathways({ precursor: 'pyruvate', target: 'acetyl_coa' });
    const r2 = discoverPathways({ precursor: 'pyruvate', target: 'acetyl_coa' });
    if (r1.pathways.length > 0 && r2.pathways.length > 0) {
      expect(r1.pathways[0].metrics.atomEconomy).toBe(r2.pathways[0].metrics.atomEconomy);
    }
  });

  test('no mass conservation: pathway steps do NOT guarantee stoichiometric balance', () => {
    // toolValidity caption: "no mass conservation"
    // 这个 test 验证当前的已知行为（不守恒），而不是在要求它守恒
    // 如果未来修复了 mass conservation，这个 test 应该被删除并替换为正向守恒验证
    const result = discoverPathways({ precursor: 'glucose', target: 'ethanol' });
    if (result.pathways.length > 0) {
      // 当前实现没有质量守恒检查——这里只记录 pathways 存在，不验证化学平衡
      // FUTURE: when mass conservation is implemented, add:
      //   expect(pathway.steps.every(s => checkAtomBalance(s))).toBe(true);
      expect(result.pathways[0].steps.length).toBeGreaterThanOrEqual(1);
    }
  });
});
```

### 4b — digitalTwin 已知 bug 的额外回归说明
任务 1 里已经加了 EKF bug 的回归测试（Mahalanobis 和 NIS）。这里不需要重复，只需要在任务 1 完成后的测试文件里加一行注释，标注 caption 里的两个 bug 对应哪两个测试，方便以后维护：

```typescript
// BUG REGRESSION TESTS (see toolValidity.ts digitaltwin caption for context):
// - "likelihood Mahalanobis uses S instead of S⁻¹" → test: 'likelihood decreases monotonically...'
// - "NIS uses state covariance P instead of innovation covariance S" → test: 'anomaly score uses innovation covariance S...'
```

### VERIFY
```
[ ] pathwayDiscovery 新增 3 个 regression guard 测试，全部通过
[ ] 这 3 个测试的注释里包含"toolValidity caption:"字样，说明 test 对应哪个已知限制
[ ] digitalTwinEngine.test.ts 里有注释标注 caption 和测试的对应关系
```

---

## 推进条件检查表（在进入下一阶段前必须全部打勾）

```
任务 1:
[ ] digitalTwinEngine Mahalanobis bug 已修（Sinv 替换 S）
[ ] digitalTwinEngine NIS bug 已修（S 对角线替换 P 对角线）
[ ] digitaltwin badge: 'partial'
[ ] 两个 EKF 回归测试存在且通过

任务 2:
[ ] toolValidity fbasim caption 新增 growthRate scaling 说明
[ ] fbaEngine.test.ts 里移除了 1.22 循环验证
[ ] 新增单调性测试存在且通过
[ ] 其余 37 个 fbaEngine 测试仍通过

任务 3:
[ ] 4 个新 tab 全部进了 toolValidity.ts
[ ] biosafety 是 'demo' 不是 'partial'
[ ] riskModel.ts 存在，npx tsc --noEmit 无报错
[ ] moduleId 与 toolRegistry.ts 实际注册的 id 对得上

任务 4:
[ ] pathwayDiscovery 新增 3 个 regression guard 测试
[ ] digitalTwinEngine.test.ts 有 caption→test 对应注释

全部打勾后，在下一轮对话里提供：
- git log --oneline -10（最新 10 个 commit）
- npm test 的完整输出（不允许只贴"X passed"，要能看到具体测试名）
```
