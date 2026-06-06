# 🎨 Nexus-Bio 1.0 — UI/UX 审计报告

> **审计标准**: Apple Human Interface Guidelines + Stripe/Vercel/Linear 设计质量
> **审计方法**: 3 个独立 AI agent 并行审计（设计系统 / UX 交互 / 视觉质感）
> **审计日期**: 2026-06-06

---

## 总评

| 维度 | 评分 | 等级 |
|------|------|------|
| 设计系统（颜色/字体/间距） | **7.4/10** | 🟡 |
| UX 交互（导航/层级/认知负荷） | **4.8/10** | 🔴 |
| 视觉质感（3D/图表/动效） | **6.5/10** | 🟡 |
| **综合** | **6.2/10** | 🟡 |

**一句话诊断**: Landing page 达到 Vercel 水准（9/10），但工具内部页面像一个功能完整的 prototype 而不是产品（5.5/10）。

---

## 一、设计系统审计（7.4/10）

### 1.1 颜色 — 7/10

**做得好的**:
- 三层深色背景体系清晰：`#0d0f14`（shell）、`#10131a`（sidebar）、`#050505`（canvas）
- 五色 pastel 强调色（mint/sky/lilac/peach/coral）和谐且有功能映射
- CSS 自定义属性与 token 文件镜像一致

**关键问题**:

| # | 问题 | 严重度 | 位置 |
|---|------|--------|------|
| 1 | `ink: '#20252B'` 和 `chipText: '#20252B'` 在深色背景上不可见（对比度 ~1.1:1） | 🔴 | `workbenchTheme.ts:61,64` |
| 2 | **549 处**白色文字透明度低于 30%（`rgba(255,255,255,0.12)` 对比度 ~1.3:1） | 🔴 | 全项目 SVG 标签、元数据文字 |
| 3 | Hero.tsx 子标签 `rgba(148,163,184,0.4)` 对比度 ~2.1:1 | 🟡 | `Hero.tsx:336` |
| 4 | 颜色语义不明确 — 无 primary/secondary/tertiary 命名 | 🟡 | 全局 |

**修改方案**:

**步骤 1**: 修复 `ink` 和 `chipText`
```
文件: src/components/workbench/workbenchTheme.ts
修改: ink: '#20252B' → ink: 'rgba(250, 246, 240, 0.96)'
修改: chipText: '#20252B' → chipText: 'rgba(250, 246, 240, 0.96)'
```

**步骤 2**: 全局搜索替换低对比度文字
```bash
# 找到所有 rgba(255,255,255,0.12) 的文字用途
grep -rn "rgba(255,255,255,0\.1[0-5]" src/components/ --include="*.tsx"
# 最低透明度提升到 0.25（对比度 ~2.7:1，仍低于 AA 但对装饰性文字可接受）
```

**步骤 3**: 创建语义颜色 token
```typescript
// 在 workbenchTheme.ts 中添加
textPrimary:   'rgba(250, 246, 240, 0.96)',  // 主要文字
textSecondary: 'rgba(217, 225, 235, 0.68)',  // 次要文字
textTertiary:  'rgba(217, 225, 235, 0.45)',  // 辅助文字（最低）
textDisabled:  'rgba(217, 225, 235, 0.25)',  // 禁用状态
```

---

### 1.2 字体 — 7.5/10

**做得好的**:
- 三字体系统设计合理：Public Sans（UI）、IBM Plex Mono（数据）、Space Grotesk（品牌）
- 5 级字体阶梯（10/12/14/18/24px）有 Tufte 设计理念

**关键问题**:

| # | 问题 | 严重度 | 数量 |
|---|------|--------|------|
| 1 | **9px 文字遍布全项目** — Apple HIG 最低 11px | 🔴 | 50+ 处 |
| 2 | **8px 文字存在** — ThreeScene、CellImageViewer | 🔴 | 10+ 处 |
| 3 | 字体阶梯有断层 — 18px 和 24px 之间无过渡 | 🟡 | — |
| 4 | `globals.css` 用 rem，`tokens.ts` 用 px，两套体系未统一 | 🟡 | — |

**修改方案**:

**步骤 1**: 提升最低字体大小
```
全局替换:
fontSize: '8px' → fontSize: '10px'
fontSize: '9px' → fontSize: '10px'
```

**注意**: SVG 轴标签在小尺寸下需要保持可读性，可接受 10px 作为绝对最低。

**步骤 2**: 统一字体单位
```
globals.css 中:
--text-xs: 0.6875rem  (11px)  ← 与 tokens.ts 的 T.FS_XS: '10px' 不一致
统一为: --text-xs: 0.625rem (10px)
```

**步骤 3**: 补充字体阶梯断层
```typescript
// tokens.ts 中添加
FS_XXL: '20px',  // 介于 18 和 24 之间
```

---

### 1.3 间距 — 8/10

**做得好的**:
- 4px 网格系统（4/8/16/24/32px）与 Apple HIG 一致
- ToolShell body padding 一致使用 `8px 16px 16px`

**关键问题**:

| # | 问题 | 位置 |
|---|------|------|
| 1 | ScientificFigureFrame 使用 `padding: 14px`、`gap: 12px` — 不在 4px 网格上 | `ScientificFigureFrame.tsx:36-37` |
| 2 | SectionLabel 使用 `margin: 0 0 10px` — 不在网格上 | 多个 tool page |
| 3 | Hero 和 tool pages 使用不同的间距体系 | Hero 用 `clamp()`，tools 用固定 px |

**修改方案**:
```
ScientificFigureFrame: padding: '14px' → '16px', gap: '12px' → '12px'（可接受，接近 SP_MD）
SectionLabel: margin: '0 0 10px' → '0 0 8px'（对齐 SP_SM）
```

---

### 1.4 视觉一致性 — 7/10

**关键问题**:

| # | 问题 | 详情 |
|---|------|------|
| 1 | **10+ 种 border-radius 值**（8/9/10/12/14/16/18/20/30/999/50%） | token 定义了 4 种（8/12/16/20），但实际使用远超 |
| 2 | **6+ 种阴影模式** | warm sepia shadow `rgba(96,74,56,0.08)` 在深色背景上不可见 |
| 3 | **3 种 token 导入路径** | `PATHD_THEME`、`T`、`toolTokens` 三套并存 |
| 4 | `inset 0 1px 0 rgba(255,255,255,0.82)` 在 ScientificFigureFrame 中太亮 | 其他组件用 6-28% |

**修改方案**:

**步骤 1**: 标准化 border-radius 为 4 级
```typescript
// tokens.ts
R_SM:  '8px',   // chips, badges
R_MD:  '12px',  // inputs, small cards
R_LG:  '16px',  // panels
R_XL:  '20px',  // feature cards
```

**步骤 2**: 创建阴影 token 注册表
```typescript
SHADOW_LOW:    '0 2px 8px rgba(0,0,0,0.18)',
SHADOW_MEDIUM: '0 8px 24px rgba(0,0,0,0.28)',
SHADOW_HIGH:   '0 16px 48px rgba(0,0,0,0.38)',
```

**步骤 3**: 统一 token 导入路径
所有 tool page 只从 `useToolTheme()` 导入，不再直接导入 `PATHD_THEME` 和 `T`。

---

## 二、UX 交互审计（4.8/10）

### 2.1 导航 — 6/10

**核心问题**: 两套完全不同的导航系统

| 页面 | 导航组件 | 体验 |
|------|---------|------|
| 首页 `/` | `TopNav`（4 个链接） | 简洁的顶栏 |
| 工具 `/tools/*` | `IDETopBar` + `IDESidebar` | 完全不同的 chrome |

**问题**: 用户从首页进入工具时，感觉像切换了应用。

**修改方案**:

**步骤 1**: 统一导航为单一持久 shell
- Sidebar 从首页到所有工具页面都可见
- TopNav 内容合并到 IDETopBar 中
- 首页搜索栏与 sidebar 共存，不互相替代

**步骤 2**: Sidebar 默认展开（320px），显示标签
- 当前默认 80px 只显示图标，新用户无法区分 14 个工具
- 用户学会后可手动折叠

**步骤 3**: 添加全局"返回首页"按钮
- IDETopBar 中的 "Home" 面包屑链接视觉权重太低（11px）
- 提升为可见的按钮

---

### 2.2 信息层级 — 5/10

**核心问题**: 工具页面信息密度过高

| 工具 | 同时可见的交互控件数 | Apple 标准 |
|------|---------------------|-----------|
| FBASimPage | 15+ | 3-5 |
| MultiOPage | 12+ | 3-5 |
| CellFreePage | 10+ | 3-5 |

**修改方案**:

**步骤 1**: 添加渐进式披露（Progressive Disclosure）
- 每个工具默认显示"简化视图"：最重要的输出 + 2-3 个关键参数
- 添加"显示高级控件"展开按钮
- 将 4 个 tab 的内容按重要性排序，最重要的默认显示

**步骤 2**: 为每个工具页面添加明确的主 CTA
- FBASimPage 没有"运行模拟"按钮 — 模拟在 mount 时自动运行但用户不知道
- 添加"▶ Run Simulation"按钮 + loading 状态反馈

**步骤 3**: 提升字体大小
- 所有 9px → 10px
- 所有 8px → 10px
- 轴标签最低 9px

---

### 2.3 交互模式 — 6/10

**做得好的**:
- Framer Motion 过渡动画一致
- Sidebar 折叠/展开行为设计合理
- Validity badges（REAL/PARTIAL/DEMO）建立信任
- `usePersistedState` 保留滑块值

**关键问题**:

| # | 问题 | 修改方案 |
|---|------|----------|
| 1 | **无 loading skeleton** | 为每个工具页面添加 shimmer placeholder |
| 2 | **破坏性操作无确认** | "Clear knockouts" 按钮需要确认对话框 |
| 3 | **可点击元素视觉反馈弱** | knockout 按钮 `background: transparent` + `border: rgba(255,255,255,0.06)` 几乎不可见 |
| 4 | **无重置按钮** | 滑块值无法恢复默认 |

**修改方案**:

**步骤 1**: 创建 `Skeleton` 组件
```typescript
// src/components/shared/Skeleton.tsx
export function Skeleton({ width, height, borderRadius = '8px' }: {
  width: string; height: string; borderRadius?: string;
}) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  );
}
```

**步骤 2**: 提升按钮对比度
```
knockout 按钮:
border: '1px solid rgba(255,255,255,0.06)' → '1px solid rgba(255,255,255,0.15)'
```

---

### 2.4 认知负荷 — 4/10

**核心问题**: 术语无解释

| 术语 | 用户需要理解什么 | 当前解释 |
|------|----------------|---------|
| FBASim | Flux Balance Analysis | ❌ 无 |
| CETHX | Cell Thermodynamics | ❌ 无 |
| CATDES | Catalyst Design | ❌ 无 |
| GECAIR | Gene Circuit AI Reasoner | ❌ 无 |
| GENMIM | Gene Minimization | ❌ 无 |
| DYNCON | Dynamic Control | ❌ 无 |
| REAL/PARTIAL/DEMO | 有效性层级 | ❌ 仅 hover tooltip |

**修改方案**:

**步骤 1**: 为每个工具名称添加 hover tooltip
```typescript
// 在 toolRegistry.ts 中添加 description 字段
{
  id: 'fbasim',
  name: 'FBASim',
  description: 'Flux Balance Analysis — 计算代谢网络中每条反应的流量分布',
  tooltip: 'FBA 是代谢工程的基础工具。它通过线性规划找到最优的代谢流量分配。',
}
```

**步骤 2**: 在工具页面头部添加"What is this?"链接
```typescript
// 在 ToolShell header 中添加
<details>
  <summary style={{ cursor: 'pointer', color: PATHD_THEME.label, fontSize: '11px' }}>
    What is FBA?
  </summary>
  <p style={{ fontSize: '12px', lineHeight: 1.6 }}>
    Flux Balance Analysis (FBA) uses linear programming to predict metabolic fluxes.
    It finds the optimal distribution of reaction rates that maximizes growth while
    respecting mass balance constraints.
  </p>
</details>
```

**步骤 3**: 添加全局术语表
```
文件: src/components/shared/Glossary.tsx (新建)
```

---

### 2.5 入门体验 — 3/10

**核心问题**: 零首次访问引导

| 场景 | 当前体验 | 理想体验 |
|------|---------|---------|
| 首次访问首页 | 看到搜索栏 + 4 个能力标签 | 3 步引导 overlay |
| 首次进入工具目录 | 看到 14 个工具卡片 | 推荐入口 + 工作流说明 |
| 首次打开工具 | 看到全部控件 | 简化视图 + "开始"按钮 |
| 空状态 | "No entries yet" | 引导用户创建第一个条目 |

**修改方案**:

**步骤 1**: 创建首次访问引导组件
```typescript
// src/components/shared/OnboardingOverlay.tsx
// 3 步引导：
// 1. "Nexus-Bio 是一个 4 阶段研究工作台" + 工作流图
// 2. "从这里开始" → 指向 Recommended 区域
// 3. "随时问 Axon" → 指向 Copilot 按钮
```

**步骤 2**: 使用 localStorage 记录是否已完成引导
```typescript
const hasSeenOnboarding = localStorage.getItem('nexus-bio-onboarding-done');
if (!hasSeenOnboarding) {
  showOnboardingOverlay();
}
```

---

## 三、视觉质感审计（6.5/10）

### 3.1 3D 渲染 — 6.5/10

**做得好的**:
- 自定义 GLSL 流体模拟（HeroFluidCanvas）达到专业水准
- InstancedMesh 粒子系统正确使用 GPU instancing
- 语义化节点颜色 + 形状变体
- 相机框架系统精细（光学内边距、FOV 计算）

**关键问题**:

| # | 问题 | 影响 | 修改难度 |
|---|------|------|----------|
| 1 | **LinearToneMapping** — 最平的色调映射 | 场景看起来平淡 | 1 行修改 |
| 2 | **零阴影** — 无 castShadow/receiveShadow | 节点"悬浮"无锚定感 | 5 行修改 |
| 3 | **无后处理** — 无 bloom、SSAO、FXAA | 缺少"科学仪器"质感 | 中等 |
| 4 | **Stock grid helper** — 灰色网格看起来像 CAD | 不像科学工具 | 10 行修改 |

**最高影响力的单一修改**（5 行代码）:

```typescript
// ThreeScene.tsx 约第 1171 行
// 修改前
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1.0;

// 修改后
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// 在 Scene 组件中添加（约第 440 行附近）
<directionalLight
  position={[4, 10, 6]}
  intensity={0.30}
  castShadow
  shadow-mapSize={[512, 512]}
/>
```

**效果**: ACES 色调曲线压缩高光、提升暗部，创造电影级深度。阴影让节点"落地"而非悬浮。

---

### 3.2 数据可视化 — 7/10

**做得好的**:
- `chartTheme.ts` 是全项目设计最好的文件 — Okabe-Ito 色盲安全调色板、语义化状态颜色、glassmorphism tooltip
- `ConfidenceLineChart` 达到出版物质量
- FluxMap 力导向布局 + 流量编码

**关键问题**:

| # | 问题 | 位置 |
|---|------|------|
| 1 | **轴标签太小**（5.5-7px） | MultiOPage、FluxMap、所有手写 SVG 图表 |
| 2 | **固定 SVG viewBox** — 不响应容器大小 | 所有工具图表 |
| 3 | **FluxMap 用直线而非 Bezier 曲线** — 不符合 Escher 标准 | `FluxMap.tsx` |
| 4 | **PCA biplot 载荷向量按角度均匀分布** — 装饰性而非科学准确 | `MultiOPage.tsx` |

**修改方案**:

**步骤 1**: 提升轴标签最低字号
```
全局替换: fontSize="5.5" → fontSize="9"
全局替换: fontSize="6" → fontSize="9"
全局替换: fontSize="7" → fontSize="9"
```

**步骤 2**: FluxMap 添加 Bezier 曲线
```typescript
// 替换 <line> 为 <path>，使用二次贝塞尔曲线
const mx = (from.x + to.x) / 2 + (to.y - from.y) * 0.1; // 控制点偏移
const my = (from.y + to.y) / 2 - (to.x - from.x) * 0.1;
<path d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`} ... />
```

---

### 3.3 动效 — 6/10

**做得好的**:
- Hero.tsx 入场动画达到 Vercel 水准（9/10）
- CETHX 有 SVG path drawing 动画
- NodePanel 使用 spring physics

**关键问题**:

| # | 问题 | 影响 |
|---|------|------|
| 1 | **无页面过渡动画** — 路由切换是瞬间替换 | 感觉像"点击并祈祷" |
| 2 | **无 skeleton loading** — 工具加载时显示空白 | 用户不知道在等什么 |
| 3 | **Recharts `isAnimationActive={false}`** — 图表瞬间出现无叙事感 | 视觉上生硬 |

**修改方案**:

**步骤 1**: 添加路由过渡动画
```typescript
// app/layout.tsx 中包裹 children
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

**步骤 2**: 为 Recharts 启用入场动画
```
isAnimationActive={false} → isAnimationActive={true}
animationDuration={800}
animationEasing="ease-out"
```

---

## 四、优先级排序 — 修改路线图

### 🔴 P0 — 立即修改（最大视觉影响）

| # | 修改 | 预计耗时 | 视觉影响 |
|---|------|----------|----------|
| 1 | ThreeScene: LinearToneMapping → ACESFilmicToneMapping + 阴影 | 15 min | ⭐⭐⭐⭐⭐ |
| 2 | 全局字体最低 8px/9px → 10px | 30 min | ⭐⭐⭐⭐ |
| 3 | 修复 `ink`/`chipText` 不可见 token | 5 min | ⭐⭐⭐ |
| 4 | FluxMap: 直线 → Bezier 曲线 | 30 min | ⭐⭐⭐ |

### 🟡 P1 — 本周修改（UX 改善）

| # | 修改 | 预计耗时 | UX 影响 |
|---|------|----------|---------|
| 5 | Sidebar 默认展开 + 显示标签 | 1 hr | ⭐⭐⭐⭐⭐ |
| 6 | 添加首次访问引导 overlay | 2 hr | ⭐⭐⭐⭐ |
| 7 | 工具页面添加"What is this?"解释 | 1 hr | ⭐⭐⭐⭐ |
| 8 | 添加 skeleton loading 状态 | 2 hr | ⭐⭐⭐ |
| 9 | 路由过渡动画 | 1 hr | ⭐⭐⭐ |

### 🟢 P2 — 两周内修改（细节打磨）

| # | 修改 | 预计耗时 |
|---|------|----------|
| 10 | 标准化 border-radius 为 4 级 | 2 hr |
| 11 | 创建阴影 token 注册表 | 1 hr |
| 12 | 统一 token 导入路径 | 2 hr |
| 13 | 渐进式披露（简化视图/高级视图） | 4 hr |
| 14 | 轴标签字号提升 | 1 hr |

---

## 五、对比分析

| 维度 | Nexus-Bio 当前 | Apple 标准 | 差距 |
|------|---------------|-----------|------|
| 最小字体 | 8px | 11px | -3px |
| 对比度 | 最低 1.1:1 | 最低 4.5:1 | -3.4 |
| border-radius 值 | 10+ 种 | 4 种 | +6 |
| 导航系统 | 2 套 | 1 套 | +1 |
| 首次访问引导 | 无 | 必须有 | 缺失 |
| 页面过渡 | 无 | 必须有 | 缺失 |
| Loading skeleton | 无 | 必须有 | 缺失 |
| 3D 阴影 | 无 | 必须有 | 缺失 |

---

> **结论**: Nexus-Bio 的 landing page 达到了 Vercel/Stripe 水准，但工具内部页面的 UI/UX 与 Apple 标准有显著差距。最大的改进杠杆是：(1) 3D 色调映射 + 阴影，(2) 字体大小提升，(3) 导航统一，(4) 首次访问引导。这 4 项修改完成后，产品质感将从"功能原型"提升到"专业工具"。
