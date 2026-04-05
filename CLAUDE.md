# Nexus-Bio 1.0 — Claude Code Context

## 项目背景
合成生物学代谢通路可视化平台。由 Zhang Ze Foo（马来西亚 STPM 学生）在 gap year 期间用华为平板在 48 小时内 build 完成。

**核心工作流：**
```
论文 → AI 提取代谢通路 → 3D 可视化 → 点击节点 → 结构/模拟
```

**网站地址：** nexus-bio-1-0.vercel.app  
**GitHub：** github.com/zhangze1007/Nexus-bio-1.0  
**品牌名：** Nexus-Bio（不是 SynPath Bio，不要改这个名字）

---

## 技术栈

```
前端：React + TypeScript + Vite + Tailwind CSS v3 + Framer Motion
3D：  Three.js + @react-three/fiber + @react-three/drei + 3Dmol.js (CDN)
AI：  Groq API (primary) + Gemini API (fallback)
部署：Vercel (Hobby plan, free tier)
```

---

## 目录结构

```
/
├── api/
│   ├── gemini.ts        ← AI endpoint (Edge Runtime, Groq primary + Gemini fallback)
│   ├── alphafold.ts     ← AlphaFold CORS proxy
│   └── pubchem.ts       ← PubChem SDF proxy (by CID or name search)
├── src/
│   ├── App.tsx          ← 主应用，无 PDBExplorer section（已整合进 NodePanel）
│   ├── types.ts         ← PathwayNode, PathwayEdge, MolecularStructure 等
│   └── components/
│       ├── Hero.tsx              ← 导航 + 主页
│       ├── ThreeScene.tsx        ← 3D pathway 可视化（pastel palette，Lambert materials）
│       ├── NodePanel.tsx         ← 3-tab 科研工作台（Overview/Structure/Kinetics）
│       ├── PaperAnalyzer.tsx     ← AI 论文分析（Groq primary）
│       ├── SemanticSearch.tsx    ← 6数据库并行搜索
│       ├── MoleculeViewer.tsx    ← PubChem 小分子 3D（白色背景）
│       ├── CellImageViewer.tsx   ← 细胞显微图像（Wikipedia+CIL+IDR 三源并行）
│       ├── KineticPanel.tsx      ← 酶动力学模拟（MM + RK4 ODE）
│       ├── ThermodynamicsPanel.tsx ← 代谢物热力学（ΔG 计算）
│       ├── PDBExplorer.tsx       ← 蛋白质结构（已整合进 NodePanel，独立文件保留）
│       ├── ContactFlow.tsx       ← 联系方式
│       └── DevModePanel.tsx      ← 开发者模式
├── vercel.json          ← 不要修改
├── terms.html
└── privacy.html
```

---

## 关键设计决定（不要改）

### 颜色系统
```
节点颜色：Pastel tones（#C8D8E8, #C8E0D0, #DDD0E8, #E8DCC8 等）
背景：#111318 → #16181c 渐变
网格：#2c2c2c / #1e1e1e
材质：meshLambertMaterial（不用 meshStandardMaterial，避免白色闪烁）
Tone mapping：THREE.LinearToneMapping（不用 ACES，会导致高光爆白）
```

### NodePanel Tab 系统
```
Tab 1: Overview    — Summary + Evidence Trace + Connections（折叠）+ External IDs
Tab 2: Structure   — 智能切换：
                     酶节点 + ENZYME_ALPHAFOLD → AlphaFold/RCSB 旋转蛋白质
                     核酸 → RCSB_STRUCTURES 参考结构
                     代谢物分子 → PubChem 3D conformer
                     生物实体（cell/tissue等）→ CellImageViewer 显微图像
Tab 3: Analysis    — 酶 → KineticPanel（MM + RK4）
                     代谢物 → ThermodynamicsPanel（ΔG）
```

### API 架构
```
api/gemini.ts (Edge Runtime):
  Groq llama-3.3-70b-versatile (primary)
  → Groq llama3-70b-8192 (backup)
  → Gemini 2.0-flash-lite
  → Gemini 1.5-flash
  → 503 error
```

---

## Environment Variables（Vercel 里设置，不要在代码里 hardcode）

```
GROQ_API_KEY    ← Groq API key
GEMINI_API_KEY  ← Google Gemini API key
```

**重要：永远不要把 API key 写进代码或让用户在聊天里发送 key。**

---

## GOTCHAS（Claude 经常犯的错误）

1. **背景色** — 永远不要用 `#FFFFFF`, `#F5F7FA`, `#F2F5F8` 或任何浅色背景。只用深色主题：`#0d0f14`, `#10131a`
2. **Mock 响应** — 永远不要返回硬编码的 mock 数据，无论用户输入什么。所有响应必须基于真实输入动态生成
3. **禁止修改的文件** — 永远不要修改这些文件：`IDEShell.tsx`, `IDETopBar.tsx`, `IDESidebar.tsx`, `ProEvolPage.tsx`, `GECAIRPage.tsx`, `DBTLflowPage.tsx`
4. **API 调用顺序** — 永远是：Groq llama-3.3-70b FIRST，Gemini 作为 fallback SECOND。不要颠倒
5. **科学算法** — 每个工具必须使用真实的科学算法，不能用占位符计算（placeholder calculations）

---

## 已知问题和注意事项

1. `ThreeScene.tsx` 用 `meshLambertMaterial` — 不要改回 `meshStandardMaterial`，会白色闪烁
2. AlphaFold 通过 `/api/alphafold` proxy — 不能直接 fetch EBI，有 CORS
3. PubChem 通过 `/api/pubchem` proxy — 同上
4. `vercel.json` 有 rewrites for `/terms` 和 `/privacy` — 不要删
5. 3Dmol.js 从 CDN 加载（`https://3Dmol.org/build/3Dmol-min.js`）— 不是 npm 包

---

## 展示节点数据（pathwayData.json）

Artemisinin 生物合成通路（Ro et al., Nature 2006）：
- acetyl_coa → hmg_coa → mevalonate → fpp → amorpha_4_11_diene → artemisinic_acid → artemisinin

AlphaFold 数据：
```typescript
const ENZYME_ALPHAFOLD = {
  amorpha_4_11_diene: { afId: 'Q9AR04', pdbId: '2ON5' },
  artemisinic_acid:   { afId: 'Q8LKJ5', pdbId: '3CLA' },
  fpp:                { afId: 'P08836', pdbId: '1FPS' },
  hmg_coa:            { afId: 'P12683', pdbId: '1DQA' },
};
```

PubChem CIDs：
```typescript
const SHOWCASE_PUBCHEM_CIDS = {
  acetyl_coa: 444493, hmg_coa: 439400, mevalonate: 441,
  fpp: 445483, amorpha_4_11_diene: 11230765,
  artemisinic_acid: 5362031, artemisinin: 68827,
};
```

---

## 用户体验原则（Zhang Ze 的要求）

1. **极致视觉质感** — 不能为了功能降低设计品质
2. **科研可信度** — AI 生成内容必须有溯源，Evidence Trace 是核心
3. **Progressive Disclosure** — 核心信息先显示，细节点击展开
4. **工作流串联** — 每个功能是下一个的入口，不是孤立的 section
5. **诚实告知** — 没有 3D 结构时告诉用户为什么，而不是只显示 error

---

## 联系方式（ContactFlow）
- Email: fuchanze@gmail.com
- LinkedIn: linkedin.com/in/zhangze-foo-3575ba359

---

## 当前状态
网站功能完整，已部署在 Vercel。正在进入测试和优化阶段，准备 LinkedIn launch。
