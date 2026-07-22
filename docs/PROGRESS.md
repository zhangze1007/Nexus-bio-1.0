# 进度快照（Progress Snapshot）

> 更新：2026-07-22 · 两份计划：干湿闭环（已完成）+ 算法研究级优化（进行中）。
> 说明：**T1 = "不再是假算桩"（realness 兜底）≠ 科学正确**；正确性由 **T2（对标参照实现）** 证明。

---

## ① 干湿闭环 — DRY_WET_INTEGRATION_PLAN.md ✅ 全部完成

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0-1 | 预测契约 `PredictionRecordV1` | ✅ 已 review |
| P0-2 | 证伪引擎（预登记阈值 + verdict） | ✅ 已 review |
| P0-3 | 可复现（seeded rng + determinism 守卫） | ✅ 已 review |
| P1-1 | 协议可执行 + manifest（身份键贯穿） | ✅ 已 review |
| P1-2 | LIMS/ELN 双向 + 溯源强制 | ✅ 已 review |
| P1-3 | 单位归一 + QC 闸 | ✅ 已 review |
| P2-1 | 回流拓宽 + 贝叶斯（含 P2-1.0 reconciliation） | ✅ 已 review |
| P2-2 | DoE 主动学习（EI/UCB → 协议导出） | ✅ 已 review |

端到端闭环有测试证明：falsified → propose → approve → 种子按预期方向移动。

**遗留小项（不阻断闭环）**：证伪 dashboard / DoE 建议两个 UI 面板未做；`createdAt` 时间戳非确定性、`normalizeUnit` 对不兼容单位静默原值返回、贝叶斯"覆盖率当观测置信度"方差映射待标定、`deckModel` 384 孔容量校验——均记录在案。

---

## ② 算法研究级优化 — ALGORITHM_OPTIMIZATION_PLAN.md（进行中）

三条线（T1 去桩 / T2 对标 / T3 数值·性能）× 四簇。**完成矩阵**：

| 工具/引擎 | 簇 | T1 去桩 | T2 对标 | T3 数值·性能 | 参照 |
|---|---|:--:|:--:|:--:|---|
| **FBA** | 代谢 | ✅ | ✅ 0% 误差 | ✅ | COBRApy（夹具已入仓）|
| looplessFBA | 代谢 | ✅ | — | — | — |
| CETHX 热力学 | 代谢 | ✅ | ⛔ 夹具 | — | eQuilibrator |
| 13C-MFA | 代谢 | ✅ | — | — | — |
| 动力学 ODE | 代谢 | n/a | ⛔ 夹具 | — | COPASI |
| CatDes ΔΔG / 逆折叠 / rfdiffusion / 调控 / 质粒 / RBS | 蛋白酶 | ✅ | ⛔ 夹具 | — | FoldX |
| planKnockdowns / Cas12a / gRNA / DNA 组装 / BGC | 基因组线路 | ✅ | ⛔ 夹具 | — | CHOPCHOP |
| MPC / UMAP / 差异表达 / ScSpatial / 基因表达 | 组学仿真 | ✅ | ⛔ 夹具 | — | scanpy / Squidpy / SimBiology |

**跨阶段地基**：realness 守卫 ✅、reference runner ✅、determinism 守卫 ✅（复用 P0-3）。

**额外完成的正确性修复**：`.includes("o2"/"glu")` 交换误判 bug 在 `solveDynamicFBA` + 三个菌株设计模块（FSEOF/OptKnock/RobustKnock）**全仓根除**，统一走精确 metabolite-id 路径。

### 分线小结

- **T1 去桩求真：四簇全清 ✅** — ~35 个假算桩全部关闭。这条线做完了。
- **T2 对标验证：仅 FBA 完成** — FBA 对 COBRApy biomass 0% 误差、有真夹具。其余全部 **⛔ 卡在参照夹具**。
- **T3 数值·性能：仅 FBA 完成** — 其余待做。

---

## 主要未完成 = T2/T3 对标验证线，瓶颈是参照夹具

| 参照工具 | 用于 | 沙箱可否直接生成 | 计划 |
|---|---|---|---|
| COBRApy | FBA | ✅ 已生成 | 完成 |
| eQuilibrator | CETHX ΔG'° | ❌ 数据库上 GB | 手工整已发表 ΔG'°（pH 7.0 / I 0.25 M）或本地导出脚本 |
| COPASI | 动力学 ODE | ❌ | curate / 本地导出 |
| FoldX | CatDes ΔΔG | ❌ | curate 已知 ΔΔG 突变集 |
| CHOPCHOP | gRNA | ❌ | curate |
| scanpy / Squidpy | 组学 / ScSpatial | ⚠️ 可能可装 | 待试 |

## 跟进项（两份计划共有）
- `rbac.ts:122` 忽略 `projectId` 的**潜在越权**——独立安全修复，不占算法线。
- 干湿闭环两个 UI 面板。
- 上述几个 determinism / 启发式 nit。

---

*一句话：**"去桩求真"整条线 + 整个干湿闭环已完成；剩余主要是"把每个工具对标到参照实现"的验证线，目前只过了 FBA。** 下一步瓶颈是为其余工具准备参照夹具。*
