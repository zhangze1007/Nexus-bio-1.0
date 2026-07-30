# ML 真实化计划（Real-AI-Everywhere Plan）

> 目标：项目里每一个"以 ML/AI 算法模拟"的工具,底层都真的是 AI/ML 在算——真模型 / 真 embedding / 真后端 + 验证 + 诚实结果——而不是启发式凑数。**渐进式做,一次一个。**
> 现状底账来源:`src/config/toolValidity.ts`(项目自己的诚实标注)+ 代码核查 + 已完成的变体效应实验。

---

## 0. "真 AI" 的验收标准(每个组件都按这条)

沿用变体效应实验那套纪律,一个 ML 组件算"真"当且仅当:

1. **真模型 / 真 embedding 在算**——不是 hand-tuned 权重、不是确定性启发式冒充学习。
2. **原语已对标**——底层数值实现(Ridge/GP/UMAP/统计量…)先对 sklearn/scipy/参照库验过(就像我们验 Ridge=sklearn)。
3. **真数据出真结果**——喂真实验/公开数据,不 mock。
4. **诚实结果 + 诚实 tier**——报真跑出的数;`toolValidity` 的 tier 只有在挣到时才升(demo→partial→real)。

**只有全中,才把它标成"真 AI"。** 少一条就如实标 partial/demo。

---

## 1. ML 全景现状表(照 toolValidity + 代码)

| 组件 | 文件 | 现状(诚实) | 要"真 AI"缺什么 |
|---|---|---|---|
| **变体效应 fitness 预测** | `ProEvolCampaignEngine` / `proevolML` / 新 `learningCurve.mts` | ✅ **已真**:ESM-2 embedding + Ridge,对标 sklearn/scipy、真 BLAT DMS、学习曲线过预注册判据 | 已达标——**产品化**成 ProEvol 的预测器(点击→预测) |
| ProEvol 常规 fitness 打分 | `ProEvolCampaignEngine` | 确定性启发式(BLOSUM62 0.4 + ΔΔG 0.3 + burial 0.3);ESM-2 toggle 默认 **OFF** | 把上面那条真模型接进来当默认预测器 |
| **逆折叠**(CatDes) | `inverseFoldingEngine` | k-NN/消息传递/PSSM 是真的,但 **"所有权重 hand-tuned,不是学的"**;ESM-2 已接线 | 换成真学习模型(ProteinMPNN,需后端)或诚实标为启发式 |
| **MOFA+ 多组学因子**(MultiO) | `multiOmicsPipeline` / `MOIEngine` | 真变分贝叶斯 **仅在 Python 后端**;浏览器降级 = 确定性线性嵌入(**不是 VAE**) | 把真 Python 后端接通/托管;因子对标 MOFA2 |
| **UMAP**(MultiO/ScSpatial) | `umapEngine` | 真 UMAP 在 Python 后端;客户端降级确定性 | 接通/托管真 UMAP;对标 umap-learn |
| **scanpy/squidpy 空间**(ScSpatial) | `ScSpatialEngine` | 真流程仅在 Python 后端;离线只有 demo 数据 | 托管后端;Moran's I/聚类对标 scanpy/squidpy |
| **rfdiffusion / de novo 设计** | `rfdiffusion` / `rfdiffusionClient` | **demo——明确不是扩散模型**,启发式占位 | 委托真托管 de novo 模型(`DENOVO_DESIGN_BACKEND`)或保持诚实 demo |
| GP fitness 插值 | `gaussianProcess` | 真确定性 Cholesky-RBF GP(DoE/dbtlflow 用) | 已是真方法;可对标 sklearn/GPy 补一层验证 |
| 通用 ML 训练器 | `models.ts` | 真算法;**Ridge 已验**=sklearn;Lasso/CART/RF 未在真数据上验 | 对标 Lasso/CART/RF;有任务时各给真数据 |
| 基因表达预测 | `geneExpressionPredictor` | 已去桩(用 bottlenecks)但仍启发式 | 有数据则上学习模型,否则诚实标启发式 |
| ESM-2 embedding 服务 | `/api/esm2` / `extract_esm_features.py` | 真 ESM-2(本机已跑通) | 产品化需把它**托管成后端服务** |

---

## 2. 一条绕不开的地基:模型服务后端

**几乎所有"真深度 AI"(ESM、MOFA+、scanpy、ProteinMPNN、rfdiffusion)都需要 Python / 托管模型后端。** 平台是"浏览器原生"(TS/Vercel),后端不在时就**降级成确定性启发式**——这就是现状表里一半组件"partial/demo"的根因。

所以"生产环境里到处是真 AI"有个**架构前提**:决定这些模型**在哪跑**。诚实说:

- 变体效应实验里 ESM 是在**你本机**跑的;要变成"用户点一下→真 ESM 预测",ESM 必须**托管成一个后端服务**(Python sidecar / 托管推理 / serverless GPU)。Vercel-only 做不到。
- 这不是一个工具的事,是**一个决定**:先把一个模型服务后端立起来,后面每个深度模型工具都复用它。

**建议:第一个产品化(ProEvol 变体预测)时,顺带把这个后端的最小版立起来**——之后 MOFA+/UMAP/scanpy 只是往同一个后端加端点。

---

## 3. 渐进顺序(一次一个,按杠杆排)

**ML-1 — 变体效应预测产品化(旗舰,料已备齐).**
把已验证 + 已训练的 ESM+Ridge 模型接成 ProEvol 的真预测器:用户提交变体 → 后端 ESM embedding → 训练好的 Ridge → 预测 fitness + 诚实不确定度。这一步同时**立起第 2 节那个模型服务后端的最小版**。先做零样本 baseline + 一页 write-up + `partial` tier,再接 UI。

**ML-2 — 接通已存在的真模型后端(中杠杆,模型已有、只差接线).**
MOFA+、UMAP、scanpy/squidpy——这些"真模型"代码已在,只是常降级。把它们接到 ML-1 立起来的后端,并各自对标(MOFA2 / umap-learn / scanpy),把 tier 从 partial 挣到 real。

**ML-3 — 替换 hand-tuned 启发式(高杠杆但要托管模型).**
逆折叠 → ProteinMPNN;rfdiffusion → 真 de novo 模型。这些要托管大模型,成本高;**先判断值不值**(逆折叠对你的楔子重要吗?),不重要就诚实保持启发式标注,别硬上。

**ML-0(横切,任何时候)— 补齐原语验证.**
`models.ts` 的 Lasso/CART/RF、`gaussianProcess` 的 GP,对标 sklearn/GPy——沙箱就能生成参照,便宜,给上层结果打地基。

---

## 4. 每步的"完成"长什么样

- ML-1:后端跑 ESM 出真 embedding → Ridge 预测 → 前端点击拿到数 + 区间;write-up 说清"预测的是已发表 assay 内的留出变体";tier=partial。
- ML-2:每个组件的真后端可用 + 输出对标参照库在容差内 + 诚实结果;够格才升 real。
- ML-3:真模型接入并对标(如序列恢复率 / 结构合理性);否则维持诚实 demo。
- 横切:每个 ML 原语有对标测试(=sklearn/scipy/参照库),就像 Ridge 那样。

---

## 5. 不逞强(诚实边界)

- **不是每个都要上大模型。** 有些"启发式"其实够用、或上真模型不值——那就**诚实标注**,而不是硬塞一个跑不动/维护不起的模型。真实化 ≠ 无脑堆模型。
- **托管深度模型有真成本**(算力、钱、运维)。ML-3 之前先算账。
- **降级路径要诚实**:后端不在时的确定性回退,UI 必须明示"这不是真模型结果"(现在的 DataSourceBadge/validity tier 已经在做,保持)。

---

*一句话:你已经有第一个真 AI 结果(变体效应)。这份计划把它变成模板 + 一张诚实的全景图,让"到处都是真 AI"能一个一个、带着验证和诚实标注地推进——第一步是把它产品化并顺手立起模型服务后端,后面的深度模型都复用它。*

---

## 6. ML-2 结果(三项外部验证 + 修掉的真 bug)

本轮 ML-2 对 MultiO / ScSpatial 的三个核心 ML 算法做了外部验证(对夹具 / 闭式解 / 行为指标),**全部在修好真 bug 后通过**。夹具在 `benchmarks/reference/{ml,spatial}/`,测试在 `__tests__/benchmark/`。度量本身先对标 sklearn / scipy / 闭式解验证过(trustworthiness=sklearn、silhouette=sklearn、Pearson=scipy、Moran 有闭式解),再拿去量引擎。

### 三项验证(实测数字)

| 算法 | 引擎 | 验证方式 | 结果 |
|---|---|---|---|
| **UMAP** | `src/server/umapEngine.ts`(ScSpatial 用) | 行为验证:trustworthiness / silhouette,对标线性 PCA 地板 | swiss-roll trustworthiness(k=15)=**0.979**、blobs silhouette=**0.955**,均 **> PCA 地板 0.8775** |
| **MOFA+** | `src/server/mofaPlus.ts`(MultiO 客户端 TS) | 因子恢复:2 个已知隐因子的 \|corr\|(符号+置换不变) | \|corr\| = **0.895 / 0.997**(均 ≥0.80),variance-explained 随因子数单调 |
| **Moran's I** | `src/services/ScSpatialEngine.ts` | 精确对标闭式解 I=(n/S0)·(zᵀWz)/(zᵀz) | 喂入参考行标准化权重矩阵:**精确到 ~1e-7**(0.877143 / −0.067033 / −0.454630) |

### 修掉的 6 个真 bug(全部"修正到所引用的算法",非放宽阈值/改夹具)

1. **UMAP — knnIndex 原地排序**(`src/utils/knnIndex.ts`):`KDTreeIndex.build` 用 `points.sort()` **原地**排了调用方数组,`runUMAP` 输出行序变成排序序而非输入序 → 嵌入与外部按行元数据(标签)错位(也影响 ScSpatial 细胞↔嵌入)。修:构造函数传 `points.slice()`。
2. **UMAP — 吸引力符号反**:正(kNN)边把邻居**推开**而非拉近(数值验证过)。修为规范 UMAP 符号。
3. **UMAP — 排斥被 ×0.01 压死** + 系数错:硬编码 ×0.01 让排斥弱 100 倍、布局坍缩。修为规范排斥梯度 + 钳位 ±4。
4. **UMAP — 假 PCA 初始化**:注释称 "PCA-like" 但实际取原始 dim 0,1 ×10(make_blobs 落 ±100,与 a/b 力校准不兼容)。修为真 2 主成分幂迭代 + 缩放到 ±10。
5. **MOFA+ — τ 重复相乘致 W 发散**:W 更新分子多乘一个 τ(`YtZ = t*s`)使 W ∝ τ;拟合一好 τ↑ → W 爆炸再坍缩、振荡不收敛。修:`YtZ = ZᵀY`(去 τ,分母已含 α/τ)。
6. **Moran's I — 二值有向权重**:`moranICore` 用 w=1、W=边数(二值有向),对称化后各细胞度数不同 → 与闭式解不符。修为对称**行标准化**权重(w=1/度、S0=n)。

### 仍是限制(诚实照写,未夸大)

- **Python 后端可选**:scanpy/squidpy 全量管线、参考 MOFA2、UMAP(对 MultiO)在 Python 后端;后端不在时走 TS 引擎 / 确定性回退,DataSourceBadge / validity 明示。
- **MultiO 主视图是线性投影**(z-score + ALS + linear),不是学出来的非线性嵌入;无 CSV 时用合成 demo 数据 → MultiO tier 保持 **partial**(未升级,因限制仍在)。MultiO 客户端不跑 TS UMAP,UMAP 走 Python 后端。
- **Moran's I 端到端 kNN 并列打破**:引擎自建 kNN 权重时,等距对角邻居的第 4 名选择与夹具不同(12 个边缘细胞度数不同),端到端 0.870 / −0.067 / −0.479(符号正确、\|Δ\|<0.05)。属**权重构建细节**,非公式问题——喂入同一权重矩阵时精确到 ~1e-7。
- **不等同官方实现**:TS UMAP / MOFA+ 是验证过的真算法实现,但不声称等同 scanpy / 官方 MOFA2 / squidpy。
