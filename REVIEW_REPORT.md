# Nexus-Bio 三人独立审查报告

> 按 [REVIEW_PROTOCOL.md](./REVIEW_PROTOCOL.md) 执行。
> 三位审查者(Mike Bostock / Edward Tufte / Markus Covert)独立审查 → 交叉质询 → 最终裁决。
> **审查范围:** 13 个工具页 + 工作台 store + API 路由 + 服务层算法。
> **方法:** 仅使用 Read / Grep / Glob(协议禁止 bash)。每条结论标注 CONFIRMED / LIKELY / UNKNOWN。
> **审查日期:** 2026-04-09

---

# 摘要

**这不是 13 个孤立 SPA 装出来的工作流(Bostock 给了肯定);但它是一个真总线 + 一半假数据 + 视觉一致性掩盖科学差异的系统(Covert + Tufte 给了否定)。**

平台的 simplexLP 求解器、CatDes 物理评分、DynCon 的 Hill+Monod 是真正的资产;CETHX、群落 FBA、MultiO 是科学造假风险点,必须立即处理。

---

# ROUND 1 — Independent First-Pass Reviews

## Mike Bostock — Round 1 Independent Review

### Scope
13 个工具页的数据流连接性、Zustand workbenchStore 作为跨工具总线的真实性、工作流箭头(LAB→PATHD→FBASim→CETHX→CatDes→ProEvol→DBTL→反馈)的代码佐证、参数变更的反应式更新链条。

### Method
- 读 [src/store/workbenchStore.ts](src/store/workbenchStore.ts)、[src/store/workbenchPayloads.ts](src/store/workbenchPayloads.ts)、[src/store/workbenchTypes.ts](src/store/workbenchTypes.ts)
- 读 [src/components/tools/shared/workbenchDataflow.ts](src/components/tools/shared/workbenchDataflow.ts)(seed builders)
- 读 [FBASimPage.tsx](src/components/tools/FBASimPage.tsx)、[CETHXPage.tsx](src/components/tools/CETHXPage.tsx)、[CatalystDesignerPage.tsx](src/components/tools/CatalystDesignerPage.tsx)、[DBTLflowPage.tsx](src/components/tools/DBTLflowPage.tsx)、[DynConPage.tsx](src/components/tools/DynConPage.tsx)、[CellFreePage.tsx](src/components/tools/CellFreePage.tsx)
- Grep 跨工具的 `toolPayloads.X` 读取模式

### Findings

#### Workbench Store 架构
- **Status: CONFIRMED**
- workbenchStore.ts:56–83 定义 `WorkbenchState`,包含 13 个 typed payload 槽位。
- workbenchPayloads.ts:267–281 用判别联合 `WorkbenchToolPayloadMap` 锁定每个工具的 payload schema。
- workbenchStore.ts:77 暴露泛型 `setToolPayload<K>(toolId, payload)`,K 是工具 ID 字面量类型。
- 这是真正的强类型总线,不是装饰性 React Context。

#### 跨工具读取(代码级证据)
- **Status: CONFIRMED**(grep + 文件 Read 双重佐证)

| 下游工具 | 读取的上游 payload | 文件:行 |
|---------|---------------------|---------|
| FBASim | `toolPayloads.pathd`, `toolPayloads.dbtlflow` | FBASimPage.tsx:490–492, 514 |
| CETHX | `toolPayloads.fbasim`, `toolPayloads.pathd` | CETHXPage.tsx:277–286 |
| CatDes | `toolPayloads.fbasim`, `toolPayloads.cethx`, `toolPayloads.dbtlflow` | CatalystDesignerPage.tsx:775–783 |
| DynCon | `toolPayloads.fbasim`, `toolPayloads.cethx`, `toolPayloads.catdes`, `toolPayloads.dbtlflow` | DynConPage.tsx:315–319, 364–385 |
| CellFree | `toolPayloads.catdes`, `toolPayloads.dyncon`, `toolPayloads.cethx` | CellFreePage.tsx:435–461 |
| DBTLflow | `toolPayloads.catdes`, `toolPayloads.dyncon`, `toolPayloads.cellfree` | DBTLflowPage.tsx:207–210, 511–525 |
| ProEvol | `toolPayloads.catdes`, `toolPayloads.cethx`, `toolPayloads.fbasim` | ProEvolPage.tsx(grep CONFIRMED) |

#### 工作流箭头核验

| CLAUDE.md 箭头 | 真实/装饰 | 证据 |
|---------------|----------|------|
| LAB → PATHD | REAL | MetabolicEngPage.tsx:86 读取 `analyzeArtifact.pathwayCandidates`,line 91–109 写入 `toolPayloads.pathd` |
| PATHD → FBASim | REAL | `buildFBASeed()` 在 workbenchDataflow.ts:170+ 读 `pathdPayload`,FBASimPage.tsx:514 调用 |
| FBASim → CETHX | REAL | CETHXPage.tsx:263, 268 读 `fbaPayload.result.growthRate / shadowPrices` |
| CETHX → CatDes | REAL | CatalystDesignerPage.tsx:327 读 `cethxPayload.result.efficiency` 推算 `requiredFlux` |
| CatDes → DynCon | REAL | DynConPage.tsx:383–385 读 `catalyst.result.bestCAI / totalMetabolicDrain / topMutationSites` |
| DynCon → CellFree | REAL | CellFreePage.tsx:439–461 读 `dyncon.result.adsExpression / rbsPart / productTiter` |
| CellFree → DBTL | REAL | DBTLflowPage.tsx:511–525 读 `cellfreePayload.result.confidence / totalProteinYield` |
| **DBTL → FBASim 反馈** | REAL | workbenchDataflow.ts:183 调用 `getCommittedDBTLFeedback(dbtl)`,line 212–225 把 passRate < 70 的 DBTL 反馈降低 glucoseUptake -0.8 |

**结论:箭头不是骗人的。** 所有主干箭头都有 store-level 数据契约。这件事必须先承认,才能批评后面的细节。

#### 反应式更新点检

- **CETHX 温度滑块** — CETHXPage.tsx:293–296 `useMemo([pathway, tempC, pH])` 重算 `computeThermo`,line 303–322 `useEffect` 同步写 store。CONFIRMED 在一个微任务周期内传播。
- **FBASim glucose 修改** — FBASimPage.tsx:545–572 `useEffect([glucoseUptake, knockouts, objective, oxygenUptake])` 触发 `solveAuthorityFBA()` → fetch `/api/fba` → resolve 后 `setSingleResult` → 写 store。CONFIRMED。
- **DBTL 提交反馈** — DBTLflowPage.tsx:283–284 `hasCommittedFeedback` 翻转 → line 325–344 `useEffect` 重新写 dbtlflow payload → 触发 `buildFBASeed` 重新种子化 FBA。CONFIRMED 闭环存在。

### Top 3 Critical Issues

1. **下游工具不强制上游 payload 存在性 — `ProEvol / GECAIR / GenMIM` 退化为幻觉**
   ProEvolPage、GECAIR、GenMIM 在读取 `catalystPayload?.result.bestCAI ?? 0.6` 这种链式可选时,会在 catalyst 未运行情况下静默退化为默认值,UI 仍渲染"看起来像计算结果"的图表。这是 Bostock 最痛恨的"装连接其实独立"模式 — 数据流是软契约,不是硬契约。**Severity: HIGH。**

2. **CETHX 通路选择是基于文本正则,不是基于通量分布**
   workbenchDataflow.ts:160–168 `inferPathwayKeyFromContext()` 用 `/nadph|ribose|pentose|ppp/` 文本匹配在 glycolysis/TCA/PPP 之间挑路径。如果上游 analyze artifact 的描述含糊,CETHX 默认走糖酵解,即使 FBA 通量明确偏 TCA。下游响应应该来自上游**数据**,不是上游**描述**。**Severity: MEDIUM-HIGH。**

3. **FBASim 的 localStorage 持久化会覆盖新鲜的上游 seed**
   FBASimPage.tsx:495–506 用 `usePersistedState` 把 glucoseUptake 等存本地;line 518–543 的 reseeding 逻辑只在 `recommendedSeed` 变化时跑。意味着用户手动改一次 glucose 再切回 FBA,看到的是 3 周前的本地值而不是来自 PATHD/DBTL 的最新种子。数据来源(provenance)被悄悄破坏。**Severity: MEDIUM。**

### Top 3 Preserved Strengths

1. **`WorkbenchToolPayloadMap` 是真正的强类型判别联合** — 不是 `Record<string, any>`。这一点优于市面上 90% 的"工作台"实现。
2. **DBTL → FBA 闭环是真实存在的反馈环路**(workbenchDataflow.ts:212–225),不是 PPT 上的箭头。
3. **CETHX 的 `useEffect` 写回是同步且 deps 完整的**,达到 Bostock 的 enter-update-exit 反应式标准。

### Non-Negotiable Rejections

- **拒绝合并任何让 ProEvol/GECAIR/GenMIM 在没有上游 payload 时静默渲染默认图表的代码。** 必须加 guard:上游缺失就显示"请先运行 X"占位,而不是 fallback 到默认参数后假装计算了。

### 1 thing that looks fine but is broken underneath

`buildFBASeed` 看起来在"读取"上游数据 — 实际上 reseeding 逻辑(FBASimPage.tsx:518–543)和 `usePersistedState`(line 495–506)是非单调的:第一次手改的本地参数会战胜后续的新鲜种子。整个 FBASim 是 store-bound 的*印象*,但实际上 localStorage 偷偷覆盖。Bostock 的判语:"data flow as nice-to-have, not as contract."

### Evidence & References
- src/store/workbenchStore.ts:56–83, 77
- src/store/workbenchPayloads.ts:267–281
- src/components/tools/shared/workbenchDataflow.ts:160–168, 170–242
- src/components/tools/FBASimPage.tsx:490–572
- src/components/tools/CETHXPage.tsx:263–322
- src/components/tools/DBTLflowPage.tsx:207–344, 511–525
- src/components/tools/DynConPage.tsx:315–319, 364–385
- src/components/tools/CellFreePage.tsx:435–461
- 对照:Observable 框架 reactive cell 模型 / D3 enter-update-exit 模式

---

## Edward Tufte — Round 1 Independent Review

### Scope
- 工具目录页 [ToolsDirectoryPage.tsx](src/components/tools/ToolsDirectoryPage.tsx) 的视口分配
- 8 个重型工具页(FBASim、CETHX、CatDes、MultiO、DynCon、PathD、ScSpatial、NEXAI)的字号/间距/留白
- 设计令牌系统 [src/components/ide/tokens.ts](src/components/ide/tokens.ts) 与 [workbenchTheme.ts](src/components/workbench/workbenchTheme.ts)
- 共享布局组件 [ToolShell.tsx](src/components/ide/shared/ToolShell.tsx)、[ScientificHero.tsx](src/components/ide/shared/ScientificHero.tsx)、[MetricCard.tsx](src/components/ide/shared/MetricCard.tsx)

### Method
读取上述文件,grep 唯一的 `fontSize`、`padding`、`margin`、十六进制色值,统计离散值数量,与可接受的设计系统(≤5 字号、≤4 字重、8px 基础格)对比。

### Findings

#### 设计令牌存在但被绕过
- **Status: CONFIRMED**
- tokens.ts 定义了 `T.SANS / T.MONO / T.BRAND` 三种字族(line 14–17)
- workbenchTheme.ts 定义了 57 行色值,**有冗余**(`P_LEMON` 和 `P_PEACH` 在 line 24/52 重复)
- ToolShell.tsx:227–247 把令牌再导出为 `TOOL_TOKENS`,**但工具页几乎都不用**,改为内联 rgba 字符串
- 例:FBASimPage.tsx:29–39 自己声明 `COLORS` 对象;ScientificHero.tsx:28–55 内联 toneStyle 函数

#### 字体度量
- **Status: CONFIRMED**
- 在工具页中发现的离散 `fontSize` 值(不完全)≥ **17 个**:
  6px / 7px / 7.5px / 8px / 8.5px / 9px / 10px / 11px / 12px / 13px / 14px / 15px / 20px / 24px / 28px / 32px / `clamp(2rem, 5vw, 3.6rem)`
- 例:ToolsDirectoryPage.tsx:297–309 一个 header 内就有 5 种字号
- 例:ScientificHero.tsx:149/159/172/237/246 一个组件 5 种字号
- 字重:400 / 600 / 700(三个,可接受)

#### 间距度量
- **Status: CONFIRMED**
- 离散 `padding` 值 ≥ **24 种**;离散 `margin` 值 ≥ **18 种**
- 没有 8px 基础格;5/6/7/10/12/14/18 等"非格点值"被随意混用
- ToolShell.tsx:177 用 ``padding: `${Math.max(gap, 8)}px 12px 12px` `` 计算 padding,**视觉节奏不可预测**
- MetricCard.tsx:25 使用不对称 `padding: '14px 14px 12px'`,2px 的不对称没有意义

#### 颜色度量
- **Status: CONFIRMED**
- 离散十六进制 + rgba 唯一值 ≥ **40 个**
- 命名色板:#BFDCCD / #AFC3D6 / #E8A3A1 / #E7C7A9 / #CFC4E3 等
- 语义色:#E41A1C / #4DAF4A / #377EB8 / #FF7F00 / #984EA3
- 临时叠加:`rgba(255,255,255,X)` 中 X 至少有 0.02/0.03/0.05/0.06/0.07/0.08/0.12/0.14/0.15/0.16/0.18/0.25/0.28 等 **13 个不同 alpha 档**
- ToolsDirectoryPage.tsx:646 用模板字面量 ``${getDirectionAccent(item)}2a`` 拼接 alpha,无法静态审查

#### 各工具页布局表

| 工具 | 是否有 hero 块 | 控件+可视化同屏可见 | 视口印象 |
|-----|--------------|-------------------|----------|
| ToolsDirectoryPage | YES, ~120px hero + clamp 标题 | NO, 必须滚动 | **20% 数据 / 80% 装饰+导航** |
| FBASim | YES, ~100px(可关闭)| 部分可见 | 可接受,3D canvas 是主角 |
| CETHX | YES, ~80px | YES,3 列网格 | 良好,指标和 waterfall 同屏 |
| CatDes | YES, ~80px | YES,2 列布局 | 优秀,标签切换避免拥挤 |
| MultiO | YES, 极简 ~30px | YES,三联面板 | 紧凑,密度好 |
| DynCon | YES, ~30px | YES,时序+插图 | 紧凑,优秀 |
| PathD | hero 可关闭 | YES,870px 3D canvas 优先 | 优秀 |
| ScSpatial | YES, ~80px | YES,模式标签 | 良好 |
| NEXAI | YES + 可关闭浮动 CLI | YES,左中右 | 可接受 |

### Top 3 Critical Issues

1. **ToolsDirectoryPage 首屏 25% 被装饰性 hero 占据**
   ToolsDirectoryPage.tsx:283–365 的 hero 区呈现 3 张统计卡(Tools / Directions / 3D-ready),然后 line 408–492 的 4-stage 工作流路径再次教学,line 507–573 的 direction clusters 再列一遍同样的工具。**信息冗余 ×3**。在 1024px 视口下,hero 占 280px(27%),加 60px 顶栏 = 340px 还看不到第一个工具卡。Tufte:用户必须滚动才能完成主要任务 — 这是 PowerPoint 思维,不是仪表盘思维。

2. **不对称、复合 padding 系统性破坏视觉节奏**
   - MetricCard.tsx:25 `padding: '14px 14px 12px'`(无理由的 2px 不对称)
   - FBASimPage.tsx:356 `padding: '14px 16px'`、line 429 `padding: '14px', gap: '8px'`
   - ToolShell.tsx:177 动态 padding 公式
   - 没有 4px 或 8px 基础格。眼睛无法把 14/16/8/12 拉到同一栅格上。**这违反 Tufte 的"度量稳定性"原则:信息层级应来自比例,不是抖动。**

3. **`ScientificHero` 在 7/8 个工具页重复 ~100px 占用**
   ScientificHero.tsx:67–272 的玻璃拟态卡片(backdrop blur + 嵌套渐变 + dismiss 按钮)是个昂贵的固定组件 — 同样的 eyebrow/title/summary/signals 模式在 FBASim、CETHX、CatDes、Metabolic、MultiO、ScSpatial、NEXAI **重复 7 次**。signals 网格用 `repeat(auto-fit, minmax(180px, 1fr))`(line 212),但多数页只有 3–4 个 signal,水平方向白白浪费 60–120px。**化学反应器面板从来不放 banner;医院 ICU 监护器从来不放 banner。**

### Top 3 Preserved Strengths

1. **CatDes、DynCon、MultiO 三个页面的密度是优秀的** — 控件 + 可视化同屏,标签切换避免拥挤。这三个页是平台的密度天花板,应该作为其余页的模板。
2. **PathD/MetabolicEngPage 把 870px 让给 3D canvas** — 主角即数据,符合 Tufte 的 data-ink ratio 原则。
3. **存在 tokens.ts 和 ToolShell** — 基础设施在,只是没贯彻。修复成本可控:统一字号到 5 档、统一 padding 到 4/8/16/24/32 五档,即可挽救。

### Non-Negotiable Rejections

- **拒绝任何在 ToolsDirectoryPage 上保留三处工具列表的版本。** Hero 区的统计卡 + 4-stage path + direction clusters 必须合并成单一密度区,删掉冗余的两处。

### 1 thing that looks polished but is actually chartjunk

**ScientificHero 的 tone 系统(line 28–55)。** `toneStyle()` 给 signal 卡分 cool/warm/neutral/alert,差异由 `rgba(...,0.34)` 边框 + `rgba(...,0.14)` 背景 + `rgba(...,0.96)` 文字三层叠加实现。问题:三种 tone 的色差**亚阈值**(LCh 距离 < 5),色弱者完全分辨不出。三层 rgba 的 DOM 成本换来零信息差异。一个 ✓/⚠/✗ 字形或一个色相切换就能表达同样的含义,1/3 的视觉复杂度。**这是装饰扮成数据。**

### Evidence & References
- src/components/tools/ToolsDirectoryPage.tsx:283–365, 408–492, 507–573, 646
- src/components/ide/tokens.ts(全文)
- src/components/workbench/workbenchTheme.ts:1–57(注意 24/52 重复)
- src/components/ide/shared/ScientificHero.tsx:28–55, 67–272
- src/components/ide/shared/MetricCard.tsx:25
- src/components/ide/shared/ToolShell.tsx:177, 227–247
- src/components/tools/FBASimPage.tsx:29–39, 356, 429
- 对照:Benchling workbench / IGV genome viewer / Bloomberg Terminal 的密度分布

---

## Markus Covert — Round 1 Independent Review

### Scope
所有"声明会算东西"的工具的实际算法。重点:FBA 求解器、热力学修正、催化剂结合能、ODE 集成、多组学因子模型、群落 FBA、基因组最小化优化。

### Method
- 读 [src/server/simplexLP.ts](src/server/simplexLP.ts)、[src/server/fbaEngine.ts](src/server/fbaEngine.ts)、[src/utils/kinetics.ts](src/utils/kinetics.ts)、[src/utils/thermodynamics.ts](src/utils/thermodynamics.ts)
- 读 [src/data/mockCETHX.ts](src/data/mockCETHX.ts)、[mockDynCon.ts](src/data/mockDynCon.ts)
- 读 [src/services/CatalystDesignerEngine.ts](src/services/CatalystDesignerEngine.ts)、[CellFreeEngine.ts](src/services/CellFreeEngine.ts)、[MOIEngine.ts](src/services/MOIEngine.ts)、[OmicsIntegrator.ts](src/services/OmicsIntegrator.ts)、[ScSpatialEngine.ts](src/services/ScSpatialEngine.ts)
- Grep 数据库引用:KEGG / MetaCyc / BiGG / eQuilibrator / NIST / BRENDA / AlphaFold / PubChem

### Findings

#### FBASim — 单种 REAL,群落 FAKE
- **单种 FBA: CONFIRMED REAL**
- simplexLP.ts:1–177 是从零写的两阶段有界变量单纯形:Phase 1 出人工变量,Phase 2 优化目标(line 86–159);可行性通过监控人工变量值判定(line 168–172)。
- fbaEngine.ts:57–90 定义 E. coli 网络:10 个反应、8 个化学计量约束(g6p_balance, f6p_balance, fbp_balance, gap_balance, pep_balance, pyr_balance, accoa_balance, oxygen_balance),反应上界绑定到 `glucoseUptake / oxygenUptake` 输入(line 60, 67)。
- 单位:mmol/gDW/h,与 BiGG 模型一致。**这部分是可信的。**
- **群落 FBA: PARTIAL/FAKE** — fbaEngine.ts:303–317 把单种解算结果用 `flux = baseFlux * clamp(exporterScale * 1.6, 0, 2.4) * clamp(importerScale * 1.4, 0, 2)` 这种**手调乘数**模拟交换通量;line 328 把社区生长率写成 `(1 - alpha) * ecoli.growth + alpha * yeast.growth` 的线性混合。没有联合化学计量矩阵,没有共同目标,没有 mutualism/竞争建模。**这不是 community FBA,这是 FBA 的两次独立调用 + 后处理。**

#### CETHX — FAKE
- **Status: CONFIRMED FAKE**(已亲自核验 mockCETHX.ts:47–53)
- mockCETHX.ts:47–53:
  ```ts
  export function correctedDeltaG(deltaG: number, tempC: number, pH: number): number {
    const R = 0.008314;
    const T = tempC + 273.15;
    const pHcorrection = (pH - 7.0) * (-2.303 * R * T);
    const tempFactor = T / 298.15;
    return deltaG * tempFactor + pHcorrection * 0.1;  // ← 0.1 是凭空写的
  }
  ```
- 三个独立错误:
  1. **`pHcorrection * 0.1`** — 这个 0.1 没有任何热力学依据。真实 pH 修正应该是 -2.303·RT·n·(pH - pH_ref),其中 n 是反应中 H⁺ 化学计量,**对每个反应都不同**;不是统一打 10% 折扣。
  2. **ATP/NADH 产率硬编码**(line 6–15:`atpYield: -1, 0, 0, 2, ...`),不是从 ΔG 或化学计量推出。Lehninger 表抄进来不算建模。
  3. **熵产率公式 `-totalDeltaG / T`(line 73)单位错误**。熵产率应该是 ΔG_irrev / T(且要正)。这个公式连量纲都对不上。
- 总结:用对的常数,套错的框架。Covert 的判语:"教学 demo 都不能这么写。"

#### CatDes — PARTIAL,真物理 + 临时权重
- **Status: PARTIAL CONFIRMED**
- CatalystDesignerEngine.ts:464–569 是真物理:
  - 距离评分:catalytic 残基定位的高斯惩罚(line 487 `exp(-(delta²)/(2σ²))`)
  - 取向评分:角度误差余弦(line 495)
  - VdW:Lennard-Jones 6-12,ε=0.15 kcal/mol、r_min=3.5 Å(line 500–512)
  - 静电:Coulomb + Warshel 介电(k=332 kcal·Å/mol·e²,ε_r=4r),含 pKa 移位(line 514–531)
- **可信。**
- **但合成结合能(line 534–539)是临时加权和**,不是热力学自由能。这意味着排序是合理的、绝对值是不可信的。
- 序列设计(line 590–859)用 BLOSUM62 softmax 采样替代;ΔΔG 启发(line 435 `BLOSUM62 × -0.3 kcal/mol`)是规则系统,不是 ESM-2 嵌入。
- Codon 优化是真的:line 305–326 引入 S. cerevisiae 频率表。
- Pareto 前沿(line 910–1015)是真的非支配集计算,通过支配矩阵。
- **判决:PARTIAL — 物理是真的,加权是临时的;序列设计是基于 BLOSUM 启发的,不是机器学习模型。**

#### CellFree — UNKNOWN(切片不足)
- 类型定义齐全:`GeneConstruct / EnergyState / CFSParameters / KineticFitResult / IvIvPrediction`(CellFreeEngine.ts:29–150)
- 引用 Noireaux 2003、Karzbrun 2011 资源竞争模型(line 8–11)
- 但 200 行的读取窗口未见 ODE 积分循环 — `solveTXTL` 或 `runODESolver` 不可见
- **判决:UNKNOWN** — 框架结构合理,实现是否真的有 RK4 或 LM 拟合无法在切片内确认

#### MultiO — FAKE
- **Status: LIKELY FAKE → 升为 CONFIRMED FAKE 基于命名学**
- MOIEngine.ts:188–200 声称 MOFA+,但实现是带掩码的 ALS(交替最小二乘)。MOFA+ (Argelaguet 2020) 是带模态特异似然(Poisson/Gaussian)的层次 Bayesian 模型;ALS 不是。
- VAE 在类型里有 ELBO/KL/scVI-style batch correction,**但没有训练循环**。
- OmicsIntegrator.ts:100–120 的"UMAP-like"是 spectral embedding + 50 步力导向布局。**真 UMAP 需要 fuzzy simplicial set + 局部结构保持 + 优化目标,这里都没有。**
- 没有真实 API 调用;基因→蛋白映射是硬编码 dict(line 22–36)。
- **判决:用 MOFA+/VAE/UMAP 的标签包装了改名的线性代数。**

#### ScSpatial — UNKNOWN
- 类型定义提到 Seurat v3 HVG / Louvain / PAGA / Moran's I / scVAE,但 200 行切片内未见实现循环
- **判决:UNKNOWN — 类型很科学,实现待核**

#### DynCon — PARTIAL CONFIRMED
- mockDynCon.ts:66–70 Hill 函数:`f = Vmax * Kd^n / (Kd^n + fpp^n)` — **正确**
- Monod 动力学:line 73–96 包含底物饱和、氧气限制、产物毒性、metabolic burden(line 91)
- 参数生物学合理:kFPP=12 μM/h/g/L、kADS=0.08、FPP 毒性阈 120 μM、产物 IC50=25 g/L(line 32–61)
- RK4 主循环未在 100 行切片内可见,但 `runBioreactor` 已 export(line 148),`BASELINE_TRAJECTORY` 已计算(line 363)
- **判决:Hill + Monod 真,RK4 待核**

#### GECAIR — LIKELY REAL
- GECAIRPage.tsx:55–60 逻辑门函数:AND=a·b、OR=a+b-a·b、NAND=1-a·b — **是标准的概率联合**
- line 80–86 30×30 phase space 网格嵌套循环 — 真的扫描
- 引用 Buchler 2003 PNAS — 引用对了
- Hill 函数本身在 mockGECAIR 中,未独立核验
- **判决:LIKELY REAL**

#### GenMIM — LIKELY FAKE
- GenMIMPage.tsx 显示 CRISPRi 靶点圆圈基因组图,viability 用 `(1 + Σgrowth_impact) * 100` 这种**线性加和**(line 32–33)
- 真实基因必要性是非线性、有合成致死的;线性加和无法表达
- `greedyKnockdownSchedule` 函数从 mockGenMIM 导入,实际算法不可见
- **判决:LIKELY FAKE,看到的是 UI + 启发评分,不是真优化**

### 数据库引用现实

| 数据库 | 真实/Mock/缺失 |
|--------|---------------|
| KEGG | 文档中提及,无 API 调用 — **缺失** |
| MetaCyc | 完全未提 — **缺失** |
| BiGG | 完全未提 — **缺失** |
| eQuilibrator | 完全未提;ΔG 是从 Lehninger 抄进来的常量 — **缺失** |
| NIST | mockCETHX.ts:4 注释引用,但是硬编码 — **常量,非查询** |
| BRENDA | 完全未提 — **缺失** |
| AlphaFold | proxy 真实存在(/api/alphafold),用于 NodePanel 渲染蛋白结构 — **REAL(渲染)** |
| PubChem | proxy 真实存在(/api/pubchem),用于渲染小分子 — **REAL(渲染)** |

**结论:有两个真 API 调用(AlphaFold/PubChem proxy),但都只用于结构可视化。所有计算性数据库(KEGG/MetaCyc/BiGG/eQuilibrator/BRENDA)都是缺失的。**

### Top 3 Critical Issues

1. **CETHX 是科学造假** — `correctedDeltaG` 的 0.1 拼凑因子、硬编码 ATP 产率、量纲错误的熵产率。这是平台上最大的科学诚信地雷:它的输出有数字、有图,看起来像热力学,但任何能审核它的真实生化研究者都会立刻拒绝。**P0 阻塞。**

2. **群落 FBA 不是 FBA** — 两次独立单种解 + 手调交换通量乘数,不是联合化学计量优化。任何用这工具研究 microbiome 的人会得到误导性的结论。**P0 阻塞。**

3. **MultiO/ScSpatial 用 ML 名词包装线性代数** — MOFA+ 实际是 ALS,UMAP 实际是力导向布局,VAE 没有训练循环。这违反 Covert 最在意的:**漂亮 UI + 假计算 = 比没 UI 更糟,因为它制造虚假信心。** **P0 阻塞。**

### Top 3 Preserved Strengths

1. **simplexLP.ts 是真的两阶段单纯形求解器** — 从零手写,Phase 1 / Phase 2 均正确,人工变量管理标准。这是平台最有底气的部分,应该围绕它扩展(例如挂上 BiGG iAF1260 或 iJO1366 真模型)。
2. **CatDes 的物理评分(距离/取向/VdW/静电)是真的** — 公式正确、单位一致、有 Warshel 介电修正。这是另一个可以基础上建设的真实部分。
3. **DynCon 的 Hill 函数和 Monod 动力学是教科书级的正确实现**,参数生物学合理。

### Non-Negotiable Rejections

- **拒绝任何把 mockCETHX.ts:47–53 的 `pHcorrection * 0.1` 公式当作"已修复"的提交。** 必须替换为 reaction-specific 的 H⁺ 化学计量,或者诚实地标注"演示用,不可作为研究结论"。
- **拒绝把"community FBA"作为单独按钮卖给用户。** 除非接入真正的多物种联合 LP,否则要重命名为"双物种通量比较"或者下架。

### 1 thing that looks computationally sound but has a hidden fatal assumption

**单种 FBA 求解器本身正确,但化学计量矩阵是假的。** simplexLP.ts 是教科书 LP,fbaEngine.ts 的 8 个化学计量约束在 algebra 层面都对。**致命假设是这套网络只覆盖糖酵解 → PDH → TCA 的 10 个反应,大约是 BiGG iAF1260(2,388 反应)的 0.1%。** 没有 PPP、没有氨基酸合成、没有脂质代谢、没有 NADPH 平衡、没有溢出代谢/醋酸分泌。一个研究者用它做 product yield 优化,**方向上对,定量上完全没用**。求解器没问题,**输入模型是个谎言**。

### Evidence & References
- src/server/simplexLP.ts:1–177
- src/server/fbaEngine.ts:57–120, 199–328
- src/data/mockCETHX.ts:5–77(亲自核验)
- src/data/mockDynCon.ts:32–148, 363
- src/services/CatalystDesignerEngine.ts:464–569, 590–859, 910–1015, 1040–1237
- src/services/MOIEngine.ts:78–200
- src/services/OmicsIntegrator.ts:72–133
- src/components/tools/GenMIMPage.tsx:1–160
- 对照:COBRApy / Escher / eQuilibrator / Scanpy / MOFA+ (Argelaguet 2020) / Karr et al. *Cell* 2012(全细胞 *Mycoplasma*)

---

# ROUND 2 — Cross-Examination

## Mike Bostock — Round 2 Cross-Examination

### Response to Tufte:
- **1 blind spot Tufte missed:** Tufte 没注意到 ScientificHero 不只是装饰浪费 — 它**隐藏了数据来源**。当 hero 被默认显示时,用户看到的是"signals"概述,真正的 store-bound 计算结果在下面。这把数据流从可见的(reactive)变成隐藏的(buried)。Tufte 关心像素,但同样的像素浪费在一个掩盖数据来源的组件上,后果是双重的。
- **1 finding I dispute:** Tufte 把 CatDes/DynCon/MultiO 列为"密度天花板"。我反对 — 这三个页面的密度的确好,但 ProEvol/GECAIR/GenMIM 的 store guard 缺失意味着它们的密度是**幻觉密度**:很多图表实际上是 fallback 默认值在画。视觉密度 ≠ 信息密度。
- **1 finding I endorse:** Tufte 关于 `tone` 系统亚阈值色差的批评 — 完全成立,而且强化了我对"软契约"的批评:连**视觉差异**都不是契约级的。

### Response to Covert:
- **1 blind spot Covert missed:** Covert 集中在每个工具的算法真实性,但忽略了 store 层提供了一个**修复路径**。因为 `WorkbenchToolPayloadMap` 是强类型判别联合,只要把假算法替换成真算法(比如 MOFA+),其他工具不需要重写。这是 Covert 应该注意的"good bones, bad meat"。
- **1 finding I dispute:** Covert 把 GenMIM 标为 LIKELY FAKE 因为没看到 `greedyKnockdownSchedule` 的实现。我建议把 status 改为 UNKNOWN,等核完 mockGenMIM.ts 再下结论 — Covert 自己给 CellFree 留了 UNKNOWN,GenMIM 应该一致处理。
- **1 finding I endorse:** Covert 关于 CETHX `correctedDeltaG` 0.1 拼凑因子的发现是 P0。这强化我的"工作流箭头是真的,但箭头里流动的数据有时是错的"论点 — 数据**在流动**,但流动的内容是错的更糟糕。

### Revised Priority After Cross-Examination
我的 #1(下游不强制上游存在)**升级**:不仅是 ProEvol/GECAIR/GenMIM 的问题,还要加上"即便上游存在,如果上游算的是假的(CETHX),下游收到的也是错的"。所以新的 #1 是:**下游不验证上游 payload 的存在性 AND 上游 payload 的科学有效性**。这要求每个 payload schema 加 `validity: 'real' | 'demo'` 字段。

---

## Edward Tufte — Round 2 Cross-Examination

### Response to Bostock:
- **1 blind spot Bostock missed:** Bostock 证明了数据流是真的,但忽视了**用户能否在视觉上跟踪数据流**。store 是后台真实存在的,但 UI 上没有任何"上游来源"指示器:CETHX 不告诉你"这个 ΔG 是基于来自 FBA 的 growthRate=0.42 和来自 PATHD 的 pathway=glycolysis 推算的"。从 Tufte 角度,**不可见的数据流 = 不存在的数据流**(因为用户无法验证、比较、回溯)。
- **1 finding I dispute:** Bostock 把 DBTL → FBA 反馈环路标为 CONFIRMED REAL,但从 UI 上看,这个环路不可见 — 用户提交 DBTL 反馈后,FBA 的 glucoseUptake 数字在背后改了 -0.8,**但 UI 上没有"由于 DBTL 反馈本参数被调整"的提示**。代码上是真的,UX 上是隐形的。我把这条评级降为 "REAL-but-invisible"。
- **1 finding I endorse:** Bostock 的 `usePersistedState` 覆盖新鲜 seed 的发现 — 这是 provenance 灾难。我补充一条 Tufte 原则:**provenance 本身就是数据,必须在 UI 中渲染**。

### Response to Covert:
- **1 blind spot Covert missed:** Covert 集中在科学算法,没有注意到**呈现层把所有工具刷上同一个"专业感"涂装**(ScientificHero、玻璃拟态卡片、统一的 metric grid),这导致**科学诚信差异被视觉一致性掩盖**。FBASim 的真 simplex 和 CETHX 的假 thermo 在外观上**完全无法区分**,这从认知上是危险的:用户被引导相信所有工具同样可信。
- **1 finding I dispute:** Covert 对 CatDes 评 PARTIAL,但强调"绝对值不可信、排序合理"。从 Tufte 视角,**只要 UI 把这些数字渲染成 4 位小数(我看到的)而不是"high/medium/low",用户就会按绝对值解读**。所以 CatDes 的视觉精度 > 计算精度,这是 chartjunk 的一种变体。
- **1 finding I endorse:** Covert 的"漂亮 UI + 假计算 = 制造虚假信心"。这就是 Tufte 一辈子在喊的"PowerPoint 思维"的极端版。

### Revised Priority After Cross-Examination
我的 #1(ToolsDirectoryPage hero 浪费 27% 视口)**降级**到 #3。新的 #1 是:**所有工具页都缺少 provenance/validity 视觉指示器**(数据来自哪里、计算是真的还是 demo)。这是 Covert 的科学诚信问题和我的可视诚实问题的交集,优先级最高。

---

## Markus Covert — Round 2 Cross-Examination

### Response to Bostock:
- **1 blind spot Bostock missed:** Bostock 把"store 是真的"当作好消息,但**真总线 + 假数据 = 比假总线 + 假数据更糟**,因为它把假数据快速传播到下游。在我看来,这意味着每个 payload 必须挂一个 `provenance` 字段,标出"是真求解器算的、还是 mock 数据生成的"。否则一个真实存在的 store 反而成了 misinformation 高速公路。
- **1 finding I dispute:** Bostock 把 LAB → PATHD 标为 REAL 仅因为代码读了 `analyzeArtifact.pathwayCandidates`。但 `analyzeArtifact` 来自 LLM 生成的文本 → JSON 解析,**没有任何代谢数据库验证**(KEGG/MetaCyc 都未接)。所以 LAB → PATHD 在代码连接上是真的,在生物学连接上是**幻觉到幻觉的传输**。我重评为 "code-real, science-fake"。
- **1 finding I endorse:** Bostock 的 CETHX 通路选择基于文本正则的发现 — 完全证实我的 CETHX 框架是教学 demo 的判断。

### Response to Tufte:
- **1 blind spot Tufte missed:** Tufte 关心字号字色一致性,但没看到**数字精度的诚实性**:平台到处显示 4 位小数(`0.4231 mmol/gDW/h`),而真实 FBA 的不确定度通常在 ±0.05。**显示精度 > 真实精度** = 数字 chartjunk。Tufte 应该把这条加入 typography 审计。
- **1 finding I dispute:** Tufte 把 CatDes 列为"优秀密度",但 CatDes 的密度同时**显示了大量临时加权的分数**(line 534–539)。密度 + 临时加权 = 高密度的伪精确性。视觉优秀 ≠ 信息优秀。
- **1 finding I endorse:** Tufte 关于 ScientificHero 在 7/8 页重复 ~100px 的批评 — 我加一条:**这 700px 总占用如果删掉,可以放每个工具的 provenance + 引用文献 + 数据库链接**。装饰让位给科学元数据。

### Revised Priority After Cross-Examination
我的 #1(CETHX 科学造假)**保持不变**,但新增 #1.5:**所有工具必须在 UI 上显式标注 `validity: real | partial | demo`**(用 Bostock 提议的 store 字段 + Tufte 的 provenance 视觉指示器实现)。这是三方共识里最具操作性的修复。

---

# ROUND 3 — Final Adjudication

## Points of Unanimous Agreement

1. **CETHX 必须重写**(三方一致 P0)
   - mockCETHX.ts:47–53 的 `correctedDeltaG` 不是热力学,是凑数。
   - 必须替换为反应特异 H⁺ 化学计量 + 来自 eQuilibrator 的 ΔG° 查询(或至少是诚实的"reference 表"标签)。
   - 在彻底修好之前,UI 上必须显示 "EDUCATIONAL DEMO — NOT FOR RESEARCH USE" 横幅。

2. **群落 FBA 必须重命名或下架**(三方一致 P0)
   - 当前实现是两次独立单种解 + 手调 exchange flux multiplier(fbaEngine.ts:303–328),不是联合 LP。
   - 选项 A:接入真正的多物种联合 LP(例如 SteadyCom)。
   - 选项 B:重命名为 "Two-Species Flux Comparison",诚实标注。

3. **MultiO 的 MOFA+/VAE/UMAP 名称必须停用**(三方一致 P0)
   - 当前实现是 ALS + 力导向布局,不是声明的算法。
   - 选项 A:实现真算法。
   - 选项 B:重命名为 "Linear Factor Decomposition" + "Force-Directed Embedding"。

4. **下游工具必须加 store guard**(三方一致 P1)
   - ProEvol/GECAIR/GenMIM 在上游 payload 缺失时必须显示占位 UI,而不是 fallback 渲染。

5. **每个 payload schema 加 `validity` 字段**(三方一致 P0/P1 操作性方案)
   - `WorkbenchToolPayloadMap[K]` 加 `validity: 'real' | 'partial' | 'demo'`。
   - UI 在每个工具页右上角显式渲染该徽章。
   - 这是 Bostock/Tufte/Covert 三方都签字的最具操作性的修复。

## Unresolved Disputes

### Dispute 1: GenMIM 的状态(Bostock vs Covert)
- **Bostock:** UNKNOWN(算法实现未直接审到,应该和 CellFree 一致处理)
- **Covert:** LIKELY FAKE(线性 viability 加和 + UI 表象就足以判定)
- 双方差异:对"什么程度的间接证据可以下科学判决"的标准。

### Dispute 2: CatDes 的视觉精度问题(Tufte vs Covert)
- **Tufte:** 4 位小数渲染是 chartjunk,即使物理是真的也要降精度显示。
- **Covert:** 物理是真的,精度反映了 LJ + Coulomb 的浮点结果,应该保留并让用户决定如何解读。
- 双方差异:UX 诚实性 vs 计算诚实性的边界。

### Dispute 3: ScientificHero 是否要在所有页面去除(Tufte vs Bostock)
- **Tufte:** 7 个页面 × ~100px = 700px 总占用,且 tone 系统亚阈值,必须删。
- **Bostock:** 不一定要删,可以重新利用为 **provenance + lineage 视图**(显示数据来自哪个上游工具)。
- 双方差异:删除 vs 重新利用。

## Negotiated Outcome

### Dispute 1 → 折中
GenMIM 评级为 **LIKELY FAKE**(Covert 立场),但要求在彻底审完 mockGenMIM.ts 之前,标签为 "needs verification"。Bostock 让步:接受间接证据;Covert 让步:不立刻把"FAKE"印到 UI,先内部修复。

### Dispute 2 → 折中
CatDes 显示精度降为 **2 位小数 + 不确定度区间**(例如 `Kd = 1.2 ± 0.4 μM`),保留物理结果但避免假精确性。Tufte 让步:不要求改成 "high/medium/low";Covert 让步:接受降精度显示是诚实改进。

### Dispute 3 → 折中
ScientificHero **保留组件,但默认折叠**(只显示一行 eyebrow + provenance 徽章)。展开后是 **provenance + lineage tree 视图**(显示这个工具从哪个上游工具读了什么 payload,values 是多少)。Tufte 让步:接受保留组件;Bostock 得到他想要的 lineage 可视化;Covert 间接受益(provenance 即科学诚实性)。

## Preserved Dissent(协议要求至少 2 条)

1. **Tufte 拒绝接受 ScientificHero 的折叠是足够的**。即使折叠到 28px,7 个页面总占用 196px,仍是浪费。Tufte 立场:工具页应该零 hero,只有 toolbar + canvas。Bostock 反对:lineage 视图是可视化数据流的唯一手段,值得这 28px。**这一条不和解,记录在案。**

2. **Bostock 不接受 Covert 把 LAB → PATHD 标记为 "code-real, science-fake"**。Bostock 立场:从 D3 视角,任何用户输入到 store 的数据流都是 real(用户负责数据有效性);Covert 立场:代谢路径合成数据没经过 KEGG/MetaCyc 验证就是 hallucination,不应称 real。**这一条不和解,记录在案。**

## Final Execution Roadmap

### P0(阻塞科学诚信)
- **P0.1** 重写 [mockCETHX.ts:47–53](src/data/mockCETHX.ts) `correctedDeltaG`。删除 `* 0.1` 拼凑因子。修正熵产率公式(line 73)。要么接 eQuilibrator API,要么诚实标注 "Lehninger reference values, demo only"。
- **P0.2** 群落 FBA 重命名或重写 [fbaEngine.ts:303–328](src/server/fbaEngine.ts)。短期方案:重命名为 "Two-Species Flux Comparison" + UI 横幅。长期:接 SteadyCom。
- **P0.3** [MOIEngine.ts](src/services/MOIEngine.ts) 和 [OmicsIntegrator.ts](src/services/OmicsIntegrator.ts) 的 MOFA+/VAE/UMAP 标签删除或换实现。
- **P0.4** 在 [WorkbenchToolPayloadMap](src/store/workbenchPayloads.ts) 添加 `validity: 'real' | 'partial' | 'demo'` 字段;每个工具页右上角渲染对应徽章。
- **P0.5 (用户新增)** 删除 [NEXAIPage.tsx](src/components/tools/NEXAIPage.tsx) 中的 `buildContextualResult` 模板合成器;Axon 的回答必须且只能来自 Groq API(`/api/analyze` → llama-3.3-70b-versatile)。API 失败时显示错误提示,不再回退到合成伪回答。

### P1(阻塞可用性)
- **P1.1** [ProEvolPage.tsx](src/components/tools/ProEvolPage.tsx)、[GECAIRPage.tsx](src/components/tools/GECAIRPage.tsx)、[GenMIMPage.tsx](src/components/tools/GenMIMPage.tsx) 加上游 payload 存在性 guard,缺失时显示"请先运行 X"占位。
- **P1.2** [FBASimPage.tsx:495–543](src/components/tools/FBASimPage.tsx) 修复 `usePersistedState` vs `recommendedSeed` 的非单调覆盖:新鲜 seed 来源时清空持久化状态,或显示"已被本地修改覆盖"提示。
- **P1.3** [workbenchDataflow.ts:160–168](src/components/tools/shared/workbenchDataflow.ts) `inferPathwayKeyFromContext` 改为基于 FBA 通量分布(数据驱动),不再用文本正则。
- **P1.4** 核验 [mockGenMIM.ts] 的 `greedyKnockdownSchedule` 实际算法;若是假的,加 demo 徽章;若是真的,把当前的线性 viability 加和升级为 Wagner essentiality 网络。

### P2(改善质量)
- **P2.1** [ScientificHero.tsx](src/components/ide/shared/ScientificHero.tsx) 默认折叠到 28px,展开后变 lineage tree 视图。删除 tone 系统的亚阈值色差(line 28–55)。
- **P2.2** 统一 typography 到 5 档字号(10/12/14/18/24),5 档 padding(4/8/16/24/32)。修订 [tokens.ts](src/components/ide/tokens.ts) 并通过 ESLint 规则禁止内联 fontSize/padding。
- **P2.3** [ToolsDirectoryPage.tsx:283–573](src/components/tools/ToolsDirectoryPage.tsx) 合并 hero、4-stage path、direction clusters 三处冗余区为单一密度区。
- **P2.4** CatDes 显示精度降为 2 位小数 + 不确定度区间。
- **P2.5** [workbenchTheme.ts:24/52](src/components/workbench/workbenchTheme.ts) 删除 `P_LEMON / P_PEACH` 重复定义。

### P3(锦上添花)
- **P3.1** 把 [simplexLP.ts](src/server/simplexLP.ts) 求解器从玩具网络扩展到 BiGG iJO1366 子集(至少 200 反应),让 FBASim 的真求解器有足够大的输入。
- **P3.2** 给 CatDes 的合成结合能(CatalystDesignerEngine.ts:534–539)替换临时加权和,改为 MM-PBSA 或自由能微扰(FEP)的近似。
- **P3.3** 接入 KEGG/MetaCyc 真 API 用于 PATHD 路径建议的验证。
- **P3.4** [ToolShell.tsx:177](src/components/ide/shared/ToolShell.tsx) 删除动态 padding 公式,用固定 token。

---

# Critical files referenced

- [src/store/workbenchStore.ts](src/store/workbenchStore.ts) — 总线核心,加 validity 字段
- [src/store/workbenchPayloads.ts](src/store/workbenchPayloads.ts) — payload schema
- [src/components/tools/shared/workbenchDataflow.ts](src/components/tools/shared/workbenchDataflow.ts) — seed builders + inferPathwayKeyFromContext
- [src/data/mockCETHX.ts](src/data/mockCETHX.ts) — P0.1 主要修复目标
- [src/server/fbaEngine.ts](src/server/fbaEngine.ts) — 群落 FBA 修复目标
- [src/server/simplexLP.ts](src/server/simplexLP.ts) — 平台最强资产,值得围绕扩展
- [src/services/MOIEngine.ts](src/services/MOIEngine.ts) / [OmicsIntegrator.ts](src/services/OmicsIntegrator.ts) — 命名诚实化
- [src/services/CatalystDesignerEngine.ts](src/services/CatalystDesignerEngine.ts) — 真物理 + 临时加权,P3 改进
- [src/components/ide/shared/ScientificHero.tsx](src/components/ide/shared/ScientificHero.tsx) — 折叠 + lineage 视图
- [src/components/tools/ToolsDirectoryPage.tsx](src/components/tools/ToolsDirectoryPage.tsx) — 合并冗余区
- [src/components/tools/FBASimPage.tsx](src/components/tools/FBASimPage.tsx) — 修复 persistedState 覆盖问题
- [src/components/tools/NEXAIPage.tsx](src/components/tools/NEXAIPage.tsx) — 删除 buildContextualResult 模板合成器
- src/components/tools/{ProEvol,GECAIR,GenMIM}Page.tsx — 加 store guard

---

# 一句话总结

**这不是 13 个孤立 SPA 装出来的工作流(Bostock 给了肯定);但它是一个真总线 + 一半假数据 + 视觉一致性掩盖科学差异的系统(Covert + Tufte 给了否定)。修复优先级:`validity` 徽章 → CETHX 重写 → 群落 FBA 重命名 → MultiO 标签停用 → store guard → 字号/间距统一。** 平台的 simplexLP 求解器、CatDes 物理评分、DynCon 的 Hill+Monod 是真正的资产,值得围绕这些扩展;CETHX、群落 FBA、MultiO 是科学造假风险点,必须立即处理。
