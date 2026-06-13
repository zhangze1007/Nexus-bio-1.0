# Nexus-Bio 1.0 科学完整性差距分析

> **日期:** 2026-06-13
> **状态:** 差距分析报告（非设计方案）
> **目标:** 识别每个工具缺失的科研必需能力，按严重程度分级

---

## 分级标准

- 🔴 **CRITICAL** — 没有这个能力，科学家无法做真实研究
- 🟡 **IMPORTANT** — 有了更好，没有也能用但效果打折
- 🟢 **NICE-TO-HAVE** — 锦上添花，不影响核心研究流程

---

## 1. PATHD (通路设计器)

### 现有能力
- 模板化通路搜索（硬编码 Artemisinin 演示通路）
- KEGG 通路数据注入（Direction A 已完成）
- 热力学可行性评估（Alberty 变换 ΔG'）

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| P1 | **逆合成分析（Retrosynthesis）** | 🔴 CRITICAL | RetroRules/RetroPath 反应规则库 | Hatzimanikatis group, EPFL; Carbonell et al. (2018) *Bioinformatics* |
| P2 | **自动化通路筛选** | 🔴 CRITICAL | 基于热力学 ΔG' + 通量约束的通路排序 | Noor et al. (2014) *Bioinformatics* |
| P3 | **异源通路适配** | 🟡 IMPORTANT | 密码子优化 + 启动子/RBS 强度匹配 | Salis et al. (2009) *Nature Biotechnology* |
| P4 | **通路长度/复杂度约束** | 🟡 IMPORTANT | 最短路径算法 + 通路复杂度评分 | Faust et al. (2009) *BMC Bioinformatics* |

**为什么 CRITICAL：** 没有逆合成分析，PATHD 只能查找已知通路，不能为新目标分子自动设计路线。这是从"演示工具"到"研究工具"的核心跨越。

---

## 2. FBASim (通量平衡分析)

### 现有能力
- 两阶段单纯形 LP（FBA）
- FVA（通量变异性分析）
- pFBA（简约 FBA）
- GPR 规则解析 + 基因敲除分析
- BiGG 数据库集成（Direction A）
- iJO1366 基因组尺度模型子集

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| F1 | **OptKnock（基因敲除策略）** | 🔴 CRITICAL | 双层 MILP：内层 FBA + 外层最大化产物 | Burgard et al. (2003) *Biotechnol Bioeng* |
| F2 | **FSEOF（过表达靶点扫描）** | 🔴 CRITICAL | 强制增加产物通量，扫描自然增加的反应 | Choi et al. (2010) *BMC Bioinformatics* |
| F3 | **RobustKnock（鲁棒敲除）** | 🟡 IMPORTANT | 保证最低产量的敲除策略 | Tepper & Shlomi (2010) *BMC Bioinformatics* |
| F4 | **ROOM（调控开关最小化）** | 🟡 IMPORTANT | MILP 预测基因敲除后的转录响应 | Shlomi et al. (2005) *Nature Biotechnology* |
| F5 | **动态 FBA（dFBA）** | 🟡 IMPORTANT | 时间序列 FBA，模拟代谢物浓度变化 | Mahadevan et al. (2002) *Metab Eng* |
| F6 | **社区 FBA（真正的联合 LP）** | 🟡 IMPORTANT | 多物种联合优化，不是后处理缩放 | Klitgord & Segrè (2010) *PLOS Comput Biol* |
| F7 | **OptForce（强制干预靶点）** | 🟢 NICE-TO-HAVE | 识别需要强制改变通量的反应 | Ranganathan et al. (2010) *PLOS Comput Biol* |
| F8 | **代谢通量分析（MFA）** | 🟢 NICE-TO-HAVE | ¹³C 标记实验数据拟合 | Sauer (2006) *Nat Rev Microbiol* |

**为什么 CRITICAL：** OptKnock 和 FSEOF 是代谢工程菌株设计的核心算法。没有它们，FBASim 只能"分析"现有通量，不能"设计"改造策略。

---

## 3. CETHX (细胞热力学)

### 现有能力
- Alberty 变换吉布斯能（pH/温度/离子强度修正）
- 基团贡献法（Mavrovouniotis 1991）
- eQuilibrator API 集成
- 通路级 ΔG 瀑布图

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| T1 | **与 FBA 耦合的基因组尺度热力学分析** | 🔴 CRITICAL | TFA（热力学可行性分析）| Henry et al. (2007) *Metab Eng* |
| T2 | **酶特异性热力学参数** | 🟡 IMPORTANT | 从 BRENDA/Equilibrator 获取每步 ΔG° | Beber et al. (2022) *NAR* |
| T3 | **区间热力学分析** | 🟢 NICE-TO-HAVE | ΔG 范围而非点估计 | Jankowski et al. (2008) *Biophys J* |

**为什么 CRITICAL：** TFA 是验证基因组尺度模型热力学一致性的标准方法。单独评估每个反应的 ΔG 不够——需要验证整个通路的热力学一致性。

---

## 4. CATDES (催化剂设计器)

### 现有能力
- MM-PBSA 风格结合亲和力预测
- BLOSUM62 序列多样化
- 密码子优化
- 代谢通量耦合
- Pareto 前沿排名
- BRENDA 数据库集成（Direction A）

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| C1 | **分子对接（Molecular Docking）** | 🔴 CRITICAL | AutoDock Vina / Glide | Trott & Olson (2010) *J Comput Chem* |
| C2 | **Rosetta 蛋白质稳定性预测** | 🔴 CRITICAL | Rosetta ddG / FlexddG | Park et al. (2016) *PLOS Comput Biol* |
| C3 | **分子动力学模拟** | 🟡 IMPORTANT | GROMACS / OpenMM | Abraham et al. (2015) *SoftwareX* |
| C4 | **ML 引导的定向进化** | 🟡 IMPORTANT | 贝叶斯优化 + 适应度景观模型 | Biswas et al. (2021) *PNAS* |
| C5 | **de novo 酶设计** | 🟢 NICE-TO-HAVE | RosettaEnzEnsemble / ProteinMPNN | Jumper et al. (2021) *Nature* |

**为什么 CRITICAL：** 没有分子对接和 Rosetta 稳定性预测，CatDes 的结合亲和力预测只是粗略估计。对于真实的酶工程，需要原子级别的结构分析。

---

## 5. CELLFREE (无细胞沙盒)

### 现有能力
- 资源感知 TX-TL ODE 模型
- Levenberg-Marquardt 动力学拟合
- 体外→体内启发式预测
- BRENDA 常量注入（Direction A）

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| CF1 | **标定参数（从文献/实验）** | 🔴 CRITICAL | 系统化参数标定流程 | Stogbauer et al. (2012) *Integr Biol* |
| CF2 | **多种无细胞提取物类型** | 🟡 IMPORTANT | E. coli S30, 芽孢杆菌, 麦胚, 兔网织红细胞 | — |
| CF3 | **能量再生系统设计** | 🟡 IMPORTANT | PEP/Creatine phosphate/3-PGA 再生优化 | Calhoun & Swartz (2005) *Biotechnol Bioeng* |
| CF4 | **放大预测** | 🟢 NICE-TO-HAVE | 从微量反应到生物反应器的放大因子 | — |

**为什么 CRITICAL：** 当前参数是启发式默认值，没有从真实实验数据标定。这使得预测结果不可靠。

---

## 6. DYNCON (动态控制)

### 现有能力
- RK4 ODE 求解器
- Hill 函数反馈
- Monod 生长模型
- PID 控制器

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| D1 | **模型预测控制（MPC）** | 🟡 IMPORTANT | 滚动时域优化 | Henson (2001) *Comput Chem Eng* |
| D2 | **代谢控制分析（MCA）** | 🟡 IMPORTANT | 控制系数 + 弹性系数 | Kacser & Burns (1973) *Symp Soc Exp Biol* |
| D3 | **鲁棒控制设计** | 🟢 NICE-TO-HAVE | H∞ 控制 / μ 综合 | — |
| D4 | **真实生物反应器数据拟合** | 🟢 NICE-TO-HAVE | 从实验数据拟合 Monod/Hill 参数 | — |

---

## 7. GECAIR (基因电路推理器)

### 现有能力
- Hill 方程逻辑门（AND/OR/NOT）
- ODE 耦合门动态
- 相空间热力图

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| G1 | **随机模拟（Gillespie）** | 🔴 CRITICAL | Gillespie SSA / τ-leaping | Gillespie (1977) *J Phys Chem* |
| G2 | **CRISPRi/a 调控元件设计** | 🟡 IMPORTANT | dCas9 结合位点 + sgRNA 设计 | Qi et al. (2013) *Cell* |
| G3 | **生物传感器设计** | 🟡 IMPORTANT | 转录因子-配体结合 + 信号传导 | — |
| G4 | **多基因电路组合** | 🟢 NICE-TO-HAVE | 电路组合库设计 + 筛选 | — |

**为什么 CRITICAL：** 基因表达本质上是随机的。确定性 ODE 不能捕捉噪声引起的双稳态、随机共振等关键现象。

---

## 8. GENMIM (基因最小化)

### 现有能力
- 贪心 CRISPRi 靶点排名
- GPR 规则解析
- 必需基因列表

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| GM1 | **FSEOF（通量扫描）** | 🔴 CRITICAL | 强制目标通量扫描过表达靶点 | Choi et al. (2010) *BMC Bioinformatics* |
| GM2 | **MOMA（代谢最小化调整）** | 🟡 IMPORTANT | 最小化代谢状态变化的敲除策略 | Segrè et al. (2002) *PNAS* |
| GM3 | **基因组规模必需性分析** | 🟡 IMPORTANT | 从模型预测必需基因，而非硬编码列表 | — |

---

## 9. MULTIO (多组学整合)

### 现有能力
- ALS 因子分解
- 线性编码器/解码器（非 VAE）
- PCA 3D 投影（非 UMAP）

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| M1 | **MOFA+（真正的多组学因子分析）** | 🔴 CRITICAL | 变分稀疏贝叶斯因子分析 | Argelaguet et al. (2020) *Mol Syst Biol* |
| M2 | **真正的 VAE** | 🔴 CRITICAL | 变分自编码器 + 重参数化技巧 | Lopez et al. (2018) *Nat Methods* |
| M3 | **真正的 UMAP** | 🟡 IMPORTANT | 流形学习降维 | McInnes et al. (2018) *arXiv* |
| M4 | **NMF（非负矩阵分解）** | 🟡 IMPORTANT | 非负约束因子分析 | Lee & Seung (1999) *Nature* |
| M5 | **因果网络推断** | 🟢 NICE-TO-HAVE | 贝叶斯网络 / PC 算法 | — |

**为什么 CRITICAL：** 当前实现明确标注"NOT MOFA+, NOT a VAE, NOT UMAP"。ALS 和线性编码器不能捕捉非线性关系，不能提供不确定性估计。

---

## 10. SCSPATIAL (单细胞空间转录组)

### 现有能力
- QC/过滤/归一化
- HVG 选择（Seurat v3 VST）
- KNN + Louvain 聚类
- Moran's I 空间自相关
- PAGA 轨迹推断

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| S1 | **细胞间通讯分析** | 🔴 CRITICAL | CellChat / NicheNet | Jin et al. (2021) *Nat Commun* |
| S2 | **空间可变基因检测** | 🟡 IMPORTANT | SpatialDE / SPARK | Sun et al. (2020) *Nat Methods* |
| S3 | **配体-受体相互作用** | 🟡 IMPORTANT | 受体-配体数据库 + 空间共表达 | — |
| S4 | **Visium/10x 数据格式支持** | 🟡 IMPORTANT | 标准空间转录组数据格式 | — |

---

## 11. DBTLFLOW (DBTL 循环)

### 现有能力
- 迭代追踪
- SBOL v3 序列化
- Delta pack 管理

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| DB1 | **贝叶斯优化** | 🔴 CRITICAL | 高斯过程 + 采集函数 | González et al. (2014) *JMLR* |
| DB2 | **自动化实验设计（DOE）** | 🟡 IMPORTANT | 全因子/分数因子/响应曲面设计 | — |
| DB3 | **高通量筛选集成** | 🟡 IMPORTANT | 微孔板/液滴微流控数据导入 | — |
| DB4 | **自动化组装方案生成** | 🟢 NICE-TO-HAVE | Golden Gate/Gibson 组装方案 | — |

**为什么 CRITICAL：** 没有贝叶斯优化，DBTL 学习循环只能用启发式权重，不能系统化地探索参数空间。

---

## 12. PROEvol (蛋白质进化)

### 现有能力
- 多轮定向进化模拟
- 家族原型变异库
- 收敛追踪

### 缺失能力

| # | 能力 | 严重程度 | 算法/工具 | 文献来源 |
|---|------|---------|----------|---------|
| PE1 | **ML 引导的定向进化** | 🔴 CRITICAL | 贝叶斯优化 + 深度适应度模型 | Biswas et al. (2021) *PNAS* |
| PE2 | **结构基础适应度预测** | 🟡 IMPORTANT | Rosetta ΔΔG + 序列-结构关系 | — |
| PE3 | **高通量变体分析** | 🟡 IMPORTANT | DMS 数据拟合 + 适应度景观重建 | — |

---

## 13. 流程完整性缺口（无工具覆盖）

| # | 缺失环节 | 严重程度 | 说明 |
|---|---------|---------|------|
| X1 | **密码子优化工具** | 🔴 CRITICAL | 当前 CatDes 有基础密码子优化，但没有独立的、支持多物种的密码子优化工具 |
| X2 | **RBS/启动子强度计算器** | 🔴 CRITICAL | Salis RBS Calculator 是标准工具，我们没有 |
| X3 | **质粒设计工具** | 🟡 IMPORTANT | 复制子、选择标记、克隆位点设计 |
| X4 | **发酵工艺优化** | 🟡 IMPORTANT | 培养基组成、DO/pH/温度控制策略 |
| X5 | **下游处理设计** | 🟢 NICE-TO-HAVE | 分离纯化工艺设计 |
| X6 | **LIMS/ELN 集成** | 🟡 IMPORTANT | 实验室信息管理系统对接 |
| X7 | **机器人组装集成** | 🟢 NICE-TO-HAVE | BioBrick/Golden Gate 自动化组装 |

---

## 竞品对比

| 能力 | Nexus-Bio | COBRApy | COPASI | TeselaGen | Benchling |
|------|-----------|---------|--------|-----------|-----------|
| FBA/FVA/pFBA | ✅ | ✅ | ❌ | ❌ | ❌ |
| OptKnock | ❌ | ✅ (COBRA Toolbox) | ❌ | ❌ | ❌ |
| FSEOF | ❌ | ✅ (StrainDesign) | ❌ | ❌ | ❌ |
| 动力学 ODE | ✅ | ❌ | ✅ | ❌ | ❌ |
| 随机模拟 | ❌ | ❌ | ✅ (Gillespie) | ❌ | ❌ |
| 分子对接 | ❌ | ❌ | ❌ | ❌ | ❌ |
| DNA 组装设计 | ❌ | ❌ | ❌ | ✅ | ✅ |
| LIMS/ELN | ❌ | ❌ | ❌ | ❌ | ✅ |
| 热力学分析 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 单细胞分析 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 多组学整合 | ✅ (有限) | ❌ | ❌ | ❌ | ❌ |
| AI 研究助手 | ✅ | ❌ | ❌ | ✅ | ✅ |

---

## 建议执行优先级

### Phase 1: CRITICAL 缺失（必须补齐才能做真实研究）
1. **FBASim**: OptKnock + FSEOF 算法
2. **PATHD**: 逆合成分析（RetroRules 集成）
3. **CATDES**: 分子对接 + Rosetta 稳定性
4. **MULTIO**: 真正的 MOFA+ + VAE
5. **GECAIR**: Gillespie 随机模拟
6. **DBTLflow**: 贝叶斯优化
7. **PROEvol**: ML 引导定向进化

### Phase 2: IMPORTANT 缺失（提升研究质量）
8. **SCSPATIAL**: 细胞间通讯分析
9. **CELLFREE**: 参数标定
10. **GENMIM**: FSEOF + MOMA
11. **DYNCON**: MPC + MCA
12. **X1-X2**: 密码子优化 + RBS Calculator

### Phase 3: NICE-TO-HAVE（锦上添花）
13. 分子动力学模拟
14. 发酵工艺优化
15. LIMS/ELN 集成
