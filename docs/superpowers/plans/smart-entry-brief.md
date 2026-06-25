# Smart Entry System — Claude Code 执行方案

## 前置：在任何改动之前，先执行这些审计命令

```bash
# 1. 确认 app router 结构
find . -name "page.tsx" | grep -v node_modules | sort

# 2. 找到 toolValidity.ts 的实际路径
find . -name "toolValidity*" | grep -v node_modules

# 3. 找到当前 homepage 的文件
find . -path "*/app/page.tsx" -o -path "*/pages/index.tsx" | grep -v node_modules

# 4. 确认 /analyze 页面路径
find . -path "*analyze*" -name "page.tsx" | grep -v node_modules

# 5. 找到 Axon 的路由
find . -path "*axon*" -name "page.tsx" | grep -v node_modules

# 6. 确认现有工具路由（列出所有 app/ 下的 page.tsx）
find ./app -name "page.tsx" | grep -v node_modules | sort
```

把以上输出贴出来，与下方计划对照，路径不一致时以实际路径为准。

---

## 任务总览

创建两个东西，修改一个东西：

| 动作 | 目标 | 说明 |
|------|------|------|
| **新建** | `lib/smart-parser.ts` | 核心解析逻辑，纯函数，无 UI 依赖 |
| **新建** | `app/start/page.tsx` | Smart Entry 主页面 |
| **修改** | `app/page.tsx`（homepage） | Hero 区域加智能输入框 |

**不要碰的文件：**
- `/analyze/page.tsx` — 保持现状，完全不动
- `toolValidity.ts` — 只读取，不修改
- 任何 engine 文件
- `components/Navigation` 或任何导航组件（除非 Hero 修改明确需要）

---

## Phase 1：新建 `lib/smart-parser.ts`

### 完整逻辑

```typescript
// lib/smart-parser.ts

export type InputType =
  | 'DOI'
  | 'STRAIN'
  | 'MOLECULE'
  | 'METRIC'
  | 'FREEFORM'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export type ValidityClass = 'COMPUTATIONAL' | 'AI_ASSISTED'

export interface ParseResult {
  type: InputType
  confidence: ConfidenceLevel
  displayLabel: string       // 中英文都可以，面向用户
  routeTo: string            // 内部路由路径，不带域名
  toolChainDescription: string  // 一句话描述会触发的工具链
  validityClass: ValidityClass
  rawInput: string
}
```

### 解析规则（按优先级从高到低）

**规则 1 — DOI（HIGH confidence）**
```
Pattern: /^10\.\d{4,9}\/\S+/
匹配例子: "10.1038/nature05113", "10.1126/science.1234567"
routeTo: "/analyze?mode=paper&doi=<encoded>"
toolChainDescription: "论文解析 → 路径提取 → 关键酶识别"
validityClass: "AI_ASSISTED"
displayLabel: "学术论文 DOI"
```

**规则 2 — 已知菌株名（HIGH confidence）**
```typescript
const KNOWN_STRAINS: Record<string, string> = {
  // key: lowercase match string, value: display name
  'e. coli': 'E. coli',
  'escherichia coli': 'E. coli',
  'e.coli': 'E. coli',
  's. cerevisiae': 'S. cerevisiae',
  'saccharomyces cerevisiae': 'S. cerevisiae',
  'b. subtilis': 'B. subtilis',
  'bacillus subtilis': 'B. subtilis',
  'c. glutamicum': 'C. glutamicum',
  'corynebacterium glutamicum': 'C. glutamicum',
  'p. putida': 'P. putida',
  'pseudomonas putida': 'P. putida',
  'y. lipolytica': 'Y. lipolytica',
  'yarrowia lipolytica': 'Y. lipolytica',
  'k-12': 'E. coli K-12',
  'bl21': 'E. coli BL21',
  'dh5': 'E. coli DH5α',
  'mg1655': 'E. coli MG1655',
}

匹配方式: input.toLowerCase() 在 KNOWN_STRAINS keys 里找子串匹配
routeTo: "/fba?organism=<strain_key>"
toolChainDescription: "代谢模型加载 → 通量平衡分析 → 改造靶点识别"
validityClass: "COMPUTATIONAL"
displayLabel: "宿主菌株"
```

**规则 3 — 已知代谢物/分子（HIGH confidence）**
```typescript
const KNOWN_MOLECULES: string[] = [
  // 萜类
  'artemisinin', 'lycopene', 'beta-carotene', 'taxol', 'limonene',
  'linalool', 'geraniol', 'farnesol', 'squalene', 'astaxanthin',
  // 氨基酸
  'lysine', 'threonine', 'valine', 'leucine', 'tryptophan',
  'phenylalanine', 'tyrosine', 'glutamate', 'glutamine',
  // 有机酸
  'succinic acid', 'itaconic acid', 'lactic acid', 'gluconic acid',
  '3-hydroxypropionic acid', '3-hp', 'muconic acid',
  // 醇类
  'ethanol', 'butanol', '1-butanol', '2,3-butanediol', 'isobutanol',
  'isopropanol',
  // 其他平台化合物
  'isoprene', 'farnesene', 'p-coumaric acid', 'naringenin',
  'resveratrol', 'violacein', 'indigoidine',
]

匹配方式: input.toLowerCase().includes(molecule) 逐个检查
routeTo: "/pathway-discovery?target=<molecule>"
toolChainDescription: "路径搜索 → FBA验证 → 关键酶设计"
validityClass: "COMPUTATIONAL"
displayLabel: "目标分子"
```

**规则 4 — 生产指标（MEDIUM confidence）**
```
Pattern: /(\d+(\.\d+)?)\s*(%|fold|g\/[lL]|mg\/[lL]|g\/L|倍|percent)/i
         或 /(提升|增加|优化|improve|increase|boost|yield|产量|titer)/i 且包含数字
匹配例子: "产量提升50%", "10 g/L titer", "3-fold improvement"
routeTo: "/strain-design?goal=metric&value=<encoded_input>"
toolChainDescription: "目标反推 → 改造策略生成 → 可行性评估"
validityClass: "AI_ASSISTED"
displayLabel: "生产指标目标"
confidence: MEDIUM（因为需要更多上下文）
```

**规则 5 — FREEFORM（兜底，LOW confidence）**
```
所有未匹配的输入
routeTo: "/analyze?mode=freeform&q=<encoded_input>"
toolChainDescription: "Axon AI 自由分析（AI辅助，仅供参考）"
validityClass: "AI_ASSISTED"
displayLabel: "自由描述"
```

### 主函数签名

```typescript
export function parseSmartInput(raw: string): ParseResult {
  const input = raw.trim()
  if (!input) throw new Error('Input is empty')

  // 按规则 1 → 5 依次尝试匹配
  // 匹配到即返回，不继续检查
  // ...
}
```

> **注意**：parseSmartInput 是纯函数，不依赖任何 React/Next.js API，不做任何 fetch 调用。

---

## Phase 2：新建 `app/start/page.tsx`

### 页面功能

1. 读取 URL query param `q`（`/start?q=artemisinin`）
2. 若存在 `q`，立即调用 `parseSmartInput(q)` 得到 `ParseResult`
3. 渲染"识别结果卡片" + "确认继续" 按钮
4. 若 `q` 不存在，渲染输入框（允许直接在 /start 输入）

### UI 结构（组件级描述）

```
<main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">

  {/* 标题区 */}
  <h1>Smart Entry</h1>
  <p>输入你的目标，平台自动路由到正确的工具链</p>

  {/* 如果没有 q param，显示输入框 */}
  <InputBox
    placeholder="输入分子名、菌株、DOI、或目标指标..."
    onSubmit={(val) => router.push(`/start?q=${encodeURIComponent(val)}`)}
  />

  {/* 如果有 q param，显示识别结果卡片 */}
  {parseResult && (
    <RecognitionCard
      result={parseResult}
      onConfirm={() => router.push(parseResult.routeTo)}
      onReject={() => router.push('/start')}  // 清空重来
    />
  )}

</main>
```

### RecognitionCard 的具体内容

```
┌─────────────────────────────────────────┐
│  🔍 已识别为：[displayLabel]             │
│                                         │
│  输入内容：[rawInput]                   │
│  识别类型：[type badge]                 │
│  置信度：  [HIGH / MEDIUM / LOW 标签]   │
│                                         │
│  将触发工具链：                         │
│  [toolChainDescription]                 │
│                                         │
│  [validityClass badge]                  │
│  ── 如果是 AI_ASSISTED，额外显示：      │
│  ⚠️ 此路径基于 AI 分析，结果仅供参考    │
│  ── 如果是 COMPUTATIONAL：              │
│  ✅ 此路径包含经验证的计算引擎          │
│                                         │
│  [确认，前往工具链]  [重新输入]         │
└─────────────────────────────────────────┘
```

### validityClass badge 的颜色规范

```
COMPUTATIONAL → 绿色背景，白字："✓ 计算引擎验证"
AI_ASSISTED   → 黄色背景，深色字："⚠ AI 辅助 · 仅供参考"
```

---

## Phase 3：修改 Homepage Hero（`app/page.tsx`）

### 改动范围

**只动 Hero section 内部。** 在现有 Hero 区域加一个输入框，不动任何其他 section（Features、Tools 列表、Footer 等）。

### 要加的内容

在 Hero 的主标题和副标题**之后**，加：

```tsx
<div className="w-full max-w-2xl mx-auto mt-8">
  <div className="flex gap-2">
    <input
      type="text"
      placeholder="输入目标分子、菌株、DOI 或生产指标..."
      className="flex-1 px-4 py-3 rounded-lg border border-border bg-background text-sm"
      value={heroInput}
      onChange={(e) => setHeroInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && heroInput.trim()) {
          router.push(`/start?q=${encodeURIComponent(heroInput.trim())}`)
        }
      }}
    />
    <button
      onClick={() => {
        if (heroInput.trim()) {
          router.push(`/start?q=${encodeURIComponent(heroInput.trim())}`)
        }
      }}
      className="px-6 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
    >
      开始 →
    </button>
  </div>
  <p className="text-xs text-muted-foreground mt-2 text-center">
    支持：分子名 · 菌株 · DOI · 生产指标
  </p>
</div>
```

需要在 homepage 组件顶部加：
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
```

> 如果 `app/page.tsx` 已经是 client component，不要重复添加 `'use client'`。先读文件确认。

---

## 执行顺序

```
Step 1: 跑上方所有 audit 命令，确认实际路径
Step 2: 新建 lib/smart-parser.ts（纯逻辑，无副作用）
Step 3: 写单元测试验证解析逻辑（见下方）
Step 4: 新建 app/start/page.tsx
Step 5: 读取 app/page.tsx 全文，再修改 Hero 区域
Step 6: 本地运行 npm run dev，手动测试以下用例
```

---

## 验证测试用例（Step 3）

在 `lib/__tests__/smart-parser.test.ts` 或直接在 terminal 写 inline test：

```typescript
const tests = [
  { input: '10.1038/nature05113',     expectedType: 'DOI',      expectedConfidence: 'HIGH' },
  { input: 'E. coli K-12',            expectedType: 'STRAIN',   expectedConfidence: 'HIGH' },
  { input: 'e.coli',                  expectedType: 'STRAIN',   expectedConfidence: 'HIGH' },
  { input: 'artemisinin',             expectedType: 'MOLECULE', expectedConfidence: 'HIGH' },
  { input: 'lycopene biosynthesis',   expectedType: 'MOLECULE', expectedConfidence: 'HIGH' },
  { input: '产量提升50%',              expectedType: 'METRIC',   expectedConfidence: 'MEDIUM' },
  { input: '10 g/L titer',            expectedType: 'METRIC',   expectedConfidence: 'MEDIUM' },
  { input: 'optimize my pathway',     expectedType: 'FREEFORM', expectedConfidence: 'LOW' },
  { input: 'how to increase yield',   expectedType: 'FREEFORM', expectedConfidence: 'LOW' },
]
```

所有 9 个用例必须 pass 再进行 Step 4。

---

## 边界情况处理

| 情况 | 处理方式 |
|------|----------|
| 输入为空字符串 | 不触发跳转，输入框 border 变红 |
| 输入纯空格 | `.trim()` 后等同于空，不跳转 |
| URL 中 q param 包含特殊字符 | 始终用 `encodeURIComponent` / `decodeURIComponent` |
| 分子名大小写混合 | 统一转 lowercase 再匹配 |
| DOI 带 https://doi.org/ 前缀 | 先 strip 前缀再匹配 Pattern |
| 同时匹配多个规则（如 "artemisinin E. coli"） | 按规则优先级取第一个匹配，confidence 降为 MEDIUM |

---

## 绝对不允许做的事

1. **不要修改任何 engine 文件**（fbaEngine, pathwayEngine 等）
2. **不要修改 toolValidity.ts**
3. **不要删除或改动 /analyze 页面**
4. **不要在 smart-parser.ts 里加任何 fetch/API 调用**——它是纯同步函数
5. **不要在 Homepage 加超过这里描述的内容**——只加输入框，不动其他 section
6. **不要自动安装新的 npm 包**，用现有依赖解决
7. **不要改动任何 CSS 变量或 Tailwind config**
