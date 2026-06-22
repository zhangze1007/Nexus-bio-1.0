# Nexus-Bio 科学真实性 & 披露审计 — 执行方案

**基线 commit**: `d7e0dba4f36d55e813d7722782b378e943e2e7ac`（2026-06-21）
**审计来源**: 本次对话中对仓库的实际 clone + 静态/数据流审计（非凭印象判断）
**给 Claude Code 的第一条规则**：本文档里标"已确认"的发现是有证据链的（文件路径+行号），可以直接修；标"待核实"的只是线索，**先验证再动手**，不要假设线索成立就直接改代码。

---

## 工作纪律（在做任何修复前必读）

1. **不许用"标记为 real 来让问题消失"**。任何 `TOOL_VALIDITY` 条目的 `level` 判定，必须基于实际读完该引擎的核心计算路径后做出；默认偏保守（'demo' > 'partial' > 'real'），跟现有 14 条目的判定标准对齐（参考 `src/config/toolValidity.ts` 里 fbasim/cethx 那种"哪部分真哪部分启发式"的写法风格）。
2. **不许为了让测试通过而弱化断言**。新增测试要断言具体数值/不变量，不能只断言"返回了一个对象"或"没有 throw"。
3. **每修一项,产出可独立核查的证据**——测试运行截图/log、git diff、或具体数字与文献值的对比，不接受"我已经检查过,是对的"这种自我declaration。
4. **不直接 push 到 main / 不直接部署**。所有改动在分支上做，每个 P 级任务结束后等 Zhang Ze review。
5. **删除代码前必须先问**，不要自主判断"这个引擎没人用了所以删掉"。

---

## P0 — 生产环境真实 bug（已确认，优先级最高因为成本最低、影响用户可见）

### P0.1 修复 FBASim 页面 "Strain Design Pipeline" 按钮 404

- **现象**：`src/components/tools/FBASimPage.tsx` 第 902 行左右，按钮 onClick 调用 `fetch('/api/pipeline/fbasim', ...)`
- **根因**：`app/api/pipeline/[tool]/route.ts` 里的 `PIPELINE_MAP` 没有 `fbasim` 这个 key（确认过完整列表：catdes, proevol, dyncon, cethx, gecair, cellfree, genmim, multio, scspatial, nexai, inversefolding, multiplexcrispr, pathwaydiscovery, digitaltwin）
- **结果**：点击按钮会收到 `{ ok: false, error: "Unknown pipeline: fbasim. Available: ..." }`，HTTP 400
- **任务**：
  1. 先读 `src/server/fbaStrainPipeline.ts`（已确认存在，从 mockFBA 的引用列表里看到的）和 `src/services/FBAAuthorityClient.ts`，确认"FSEOF + OptKnock → FBA evaluation → Pareto ranking"这条 pipeline 真正应该调用的函数是什么
  2. 在 `PIPELINE_MAP` 里补上 `fbasim` 条目，指向正确的函数（不是随便接一个能跑的函数糊弄过去——要对应按钮文案描述的那三步：FSEOF、OptKnock、Pareto ranking）
  3. **验证标准**：写一个集成测试，POST `/api/pipeline/fbasim` 真实 payload（参考 onClick 里的 body：`species, objective, glucoseUptake, oxygenUptake, knockouts, maxKnockouts, growthFractionConstraint`），断言返回 200 且 `result.paretoFront` 是非空数组、每个元素结构符合 FBASimPage 渲染逻辑的预期
  4. 本地 `npm run dev` 实际点一次按钮，截图/log 确认不报错

---

## P1 — 披露缺口（已确认，4 个"前沿引擎"已上线但完全未披露）

### 背景
`src/components/tools/shared/toolRegistry.ts` 第 326-402 行，标注为 `// ── Frontier engines (2025-2026) ──` 的 4 个条目：`inversefolding`、`multiplexcrispr`、`pathwaydiscovery`、`digitaltwin`。这 4 个：
- 在 `toolRegistry.ts` 里有完整的对外文案（`summary`/`glossary`/`keyConcepts`），措辞具体到可被技术尽调直接验证（"ProteinMPNN-style"、"Extended Kalman Filter"、"A* search"、"epistasis-aware"）
- 在 `PIPELINE_MAP` 里是真实可调用的（`inversefolding`, `multiplexcrispr`, `pathwaydiscovery`, `digitaltwin` 四个 key）
- `digitaltwin` 已确认嵌入在 `DynConPage.tsx` 的一个真实 tab 里（第 274、1136 行附近）
- **完全不在 `src/config/toolValidity.ts` 的 `TOOL_VALIDITY` 里**，意味着 `ToolShell.tsx` 不会为它们渲染任何 real/partial/demo badge

### P1.1 — 逐个引擎做真实性分级，然后补 registry 条目

对下面 4 个引擎，**每个都要先完整读完核心计算路径**（不能只看文件头注释），再下 level 判定：

| 引擎文件 | 对外文案声称的算法 | 状态 |
|---|---|---|
| `src/server/inverseFoldingEngine.ts`（1112行）| k-NN 图构建 + 多轮 message passing + PSSM decoding | 本次审计**未读** — 需从头审 |
| `src/server/multiplexCRISPREngine.ts`（827行）| epistasis-aware fitness prediction + MAGE cycling | 本次审计**未读** — 需从头审 |
| `src/server/pathwayDiscoveryEngine.ts`（1227行）| A* search + 热力学可行性评分 | 已读文件头：有规范的 `@scientific_provenance`，引用 Hadicke 2017 / Campodonico 2014 / Cho 2018 三篇真实文献，诚实列出局限性（精简反应库、无原子映射、基团贡献法近似）。**但核心 A* search 实现本身还没逐行验证** |
| `src/server/digitalTwinEngine.ts`（793行）| Extended Kalman Filter 状态估计 + 蒙特卡洛预测 | 本次审计**未读** — 需从头审 |

对每一个，跑完整六层审计（数据流追踪 → 确定性检验 → 已知解验证 → 不变量检查 → 参数溯源 → 必要时跨实现交叉验证），具体到这几个引擎的不变量检查标准：

- **inverseFoldingEngine**：如果真的是 message passing，扰动输入图的某个节点特征，输出的序列预测分布应该相应变化；如果输出对图结构变化不敏感，大概率是查表/模板生成在冒充 GNN
- **multiplexCRISPREngine**：epistasis matrix 应满足对称性（如果声称是无向交互）或至少自洽；单基因 fitness 应该是 epistasis 模型在零交互项下的特例,可以反推验证
- **pathwayDiscoveryEngine**：A* 搜索出的每条路径，逐步做质量守恒检查（每个反应的底物/产物在化学计量上要 balance，哪怕是简化的 reaction-type-based stoichiometry）；ΔG cascade 的加总应该等于路径整体 ΔG
- **digitalTwinEngine**：EKF 的协方差矩阵在每个 predict-update 循环后必须保持半正定（数值上可以检查特征值非负）；给定已知噪声水平的合成传感器数据流，估计误差应该随时间收敛而不是发散或恒定不变（恒定不变说明滤波器没有真的在融合新数据）

完成分级后，在 `toolValidity.ts` 里补 4 条目，caption 写法对齐现有风格（具体到"哪部分真、哪部分是占位/启发式"），并确认这 4 个引擎实际接入的 UI 入口（`toolRegistry.ts` 里的 `href` 指向 `/tools/catdes`、`/tools/genmim`、`/tools/pathd`、`/tools/dyncon`）会正确渲染出 badge——不是加完 config 条目就算完事,要在浏览器里实际看到 badge 出现。

### P1.2 — 待核实项：trustPolicyEngine 的披露状态

`trustPolicyEngine.ts` 被 `app/api/workbench/route.ts` 引用，已确认该文件不走 `ToolShell.tsx`。**没有确认**它是否经由其他机制对用户披露、或它是否真的面向终端用户（也可能是纯内部/管理用途）。任务：先查清楚调用链和受众，再决定是否需要披露机制，不要预设它一定有问题。

---

## P2 — 零测试覆盖的高风险引擎（已确认覆盖现状）

`src/server/` 下确认零测试的 6 个：`digitalTwinEngine`、`fbaEngine`、`pathwayDiscoveryEngine`、`scVAEEngine`、`tfaEngine`、`umapEngine`。优先级排序理由：

1. **`fbaEngine.ts`**（最优先）—— 本次审计已部分验证核心可信：`highsSolver.ts` 真实包装 `highs-js`（HiGHS WASM，爱丁堡大学开源项目，已确认非伪造）；`solveAuthorityCommunityFBA` 的实现（第341-394行）已逐行核对，跟它自己的 validity caption 完全一致（两个独立真实 LP + post-hoc 启发式 cross-feeding，没有夸大）。**但零测试意味着这些结论没有回归保护**。
   - 任务：写 `__tests__/fbaEngine.test.ts`
   - **确定性测试**：同一个 `SingleSpeciesFBARequest` 跑两次，`solveAuthorityFBA` 输出必须 byte-for-byte 一致
   - **已知解验证**（具体基准，不要让 Claude Code 自己现编）：E. coli, aerobic, glucose minimal media, 典型 glucose uptake ~10 mmol/gDW/h、oxygen uptake ~20 mmol/gDW/h 条件下，iJO1366 模型预测的最大生长速率公开文献值约在 0.6–1.0 /hr 区间（标准 FBA 教学案例，COBRApy 官方教程有对照数据）。跑 `solveExpandedFBA`（用的是真实 iJO1366 子集）验证 growth rate 落在这个区间，偏差需要写进测试注释里说明可接受范围
   - **不变量检查**：抽查若干约束，验证 S·v ≈ 0（质量守恒，浮点误差容许范围内）
   - **knockout 测试**：敲掉一个已知必需基因（iJO1366 里有公开的 essential gene 列表），growth rate 应该显著下降或不可行——如果敲什么都没区别，说明 knockout 参数没真正进入 LP 约束

2. **`pathwayDiscoveryEngine.ts`** —— 见 P1.1，零测试 + 零披露的交集，按 P1.1 的六层审计同步写测试

3. **`digitalTwinEngine.ts`** —— 同上

4. `scVAEEngine`、`tfaEngine`、`umapEngine` —— 本次未深挖，按通用六层流程补测试，优先级低于上面三个（确认过这三个目前没有被任何 app 页面/API 直接引用，参见 P3 但仍需 P3 的可达性分析确认后才能下"低风险"结论）

---

## P3 — 全仓库引擎可达性复查（注意：本次审计有方法论局限）

本次为找未披露引擎做的 grep，**只检查了 `app/` 和 `app/api/` 目录下的直接文件名引用**，不是真正的 import 依赖图分析。以下 ~19 个引擎当时显示"0 引用"，但不能就此认定是死代码——可能被某个 service 间接 import，而那个 service 又被页面用到：

```
bioprocessOptimizationEngine, bioreactorAnalyticsEngine, biosensorDesignEngine,
cellFreeMetabolicEngine, circuitCompilerEngine, closedLoopDBTLEngine,
consortiumDesignEngine, digitalCellEngine, gemReconstructionEngine,
mfa13CEngine, mlMetabolicEngine, plasmidDesignEngine, regulatoryDesignEngine,
syntheticGenomicsEngine, MOIEngine, confidenceEngine, safetyEngine,
fluxomicsEngine, rnaEngine
```

**任务**：用真正的依赖图工具（比如 `madge` 或 TS compiler API 做 import graph traversal,不要再用纯文件名 grep）确认每个引擎的可达性。分三类处理：
- **真可达**（被间接 import 链到某个页面）→ 升级进 P1/P2 的流程，补披露 + 测试
- **真死代码**（完全没有任何引用路径）→ 列清单给 Zhang Ze 确认是否要移到 `archive/` 或删除，**不要自主删**
- **不确定** → 标注，人工复核

---

## P4 — Trust 自证系统的审计（trust-showcase / proof-package / nexus_trust_runtime）

这一批本身是"用来证明其他东西可信"的基础设施，需要用对待科学引擎同样的怀疑标准去查它自己：

- `src/services/trustPolicyEngine.ts`、`reference_impl_py/nexus_trust_runtime/`（含 `policy.py`、`consistency.py`、`benchmark.py`）、`reference_impl_py/policies/claim_surface_policies.json`、`proof-package/`、`benchmarks/trust-runtime-cases/`
- **核心问题**：trust score / confidence 的计算逻辑本身，是基于可验证规则（比如检测到 Math.random 在计算路径里就降级、检测到测试覆盖率才能评 real），还是又是一层启发式数字在装权威？
- 跑 `npm run benchmark:trust:validate` 和 `python3 reference_impl_py/run_reference_benchmark.py compare`（这两个脚本已确认存在于 package.json），看它们实际输出什么、对比的是什么对什么——先确认这套对比机制本身有没有在真正比较 TS 实现和 Python reference 的输出，还是只是空跑流程
- 这条线优先级在 P0-P2 之后，因为不直接面向投资人尽调,但概念上风险最高(如果这套系统本身不严谨,会系统性地给所有其他 badge 背书)

---

## 每批结束后的产出格式（强制）

```
ENGINE/FILE | TASK | STATUS(PASS/FAIL/PARTIAL) | EVIDENCE | FILES CHANGED | COMMIT
```

EVIDENCE 列必须是可独立复核的东西：测试运行的实际 log 片段、具体数字 vs 文献值的对比、或者明确的 git diff 链接。不接受"已验证"这种无证据的状态描述。

---

## 范围声明（避免 scope creep）

本方案覆盖的是**本次对话实际验证过或有明确证据线索的问题**，不是全仓库 33 个引擎的完整审计。P3 的可达性分析做完后，大概率会发现更多需要同样流程处理的引擎——那是下一轮的范围，不要在这一轮里因为"顺手"就扩大到没有证据支撑的文件。
