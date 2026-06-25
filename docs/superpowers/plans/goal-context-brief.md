# Goal Context & WorkflowBanner — Claude Code 执行方案

## 前置审计（任何改动之前先跑）

```bash
# 1. 确认 layout 文件位置
find . -name "layout.tsx" | grep -v node_modules | sort

# 2. 确认各工具页面的实际路径
find . -path "*/tools/*/page.tsx" | grep -v node_modules | sort

# 3. 确认 /start/page.tsx 已存在
find . -path "*/start/page.tsx" | grep -v node_modules

# 4. 确认 smart-parser.ts 的实际路径
find . -name "smart-parser.ts" | grep -v node_modules

# 5. 列出 components/ 目录
find . -path "*/components/*.tsx" | grep -v node_modules | sort | head -30
```

把输出对照下方方案，路径不一致时以实际路径为准。

---

## 任务总览

| 动作 | 文件 | 说明 |
|------|------|------|
| **新建** | `lib/goal-context.ts` | 纯函数模块，管理 sessionStorage + 工具链定义 |
| **新建** | `components/WorkflowBanner.tsx` | 持久化进度条，跨页面显示 |
| **新建** | `components/NextStepButton.tsx` | 各工具页面底部的"下一步"按钮 |
| **修改** | `app/layout.tsx` | 加入 `<WorkflowBanner />` |
| **修改** | `app/start/page.tsx` | 确认跳转时写入 sessionStorage |
| **修改** | 8 个工具页面 | 各自底部加 `<NextStepButton currentStepId="..." />` |

**绝对不动的文件：**
- 所有 engine 文件
- `toolValidity.ts`
- `smart-parser.ts`（只读取其类型，不修改）
- 任何工具页面的核心计算逻辑

---

## Phase 1：新建 `lib/goal-context.ts`

这是整个系统的数据核心，纯 TypeScript，零 React 依赖。

### 完整代码

```typescript
// lib/goal-context.ts

import type { InputType } from './smart-parser'

// ─── Types ────────────────────────────────────────────────

export interface WorkflowStep {
  id: string       // 唯一标识，用于匹配当前页面
  label: string    // 显示名称
  route: string    // 跳转路径（不含域名）
}

export interface GoalContext {
  goal: string              // 原始用户输入，如 "artemisinin"
  inputType: InputType      // 来自 smart-parser 的类型
  chain: WorkflowStep[]     // 完整工具链
  currentStepIndex: number  // 当前在链中的位置（0-indexed）
  startedAt: string         // ISO timestamp
}

// ─── Workflow Chain Definitions ───────────────────────────

export const WORKFLOW_CHAINS: Record<InputType, WorkflowStep[]> = {
  MOLECULE: [
    { id: 'pathd',       label: 'Pathway Discovery',      route: '/tools/pathd' },
    { id: 'fbasim',      label: 'FBA Simulation',         route: '/tools/fbasim' },
    { id: 'enzyme',      label: 'Enzyme Design',          route: '/tools/inversefolding' },
    { id: 'crispr',      label: 'CRISPR Multiplex',       route: '/tools/multiplexcrispr' },
  ],
  STRAIN: [
    { id: 'fbasim',      label: 'FBA Simulation',         route: '/tools/fbasim' },
    { id: 'strain',      label: 'Strain Design',          route: '/tools/straindesign' },
    { id: 'circuit',     label: 'Genetic Circuit',        route: '/tools/circuitcompiler' },
  ],
  METRIC: [
    { id: 'fbasim',      label: 'FBA Simulation',         route: '/tools/fbasim' },
    { id: 'strain',      label: 'Strain Design Pipeline', route: '/tools/straindesign' },
    { id: 'bioprocess',  label: 'Bioprocess Optimization',route: '/tools/bioprocess' },
  ],
  DOI: [
    { id: 'analyze',     label: 'Paper Analysis',         route: '/analyze' },
    { id: 'pathd',       label: 'Pathway Extraction',     route: '/tools/pathd' },
  ],
  FREEFORM: [
    { id: 'analyze',     label: 'Axon AI Analysis',       route: '/analyze' },
  ],
}

// ─── Storage Key ──────────────────────────────────────────

const STORAGE_KEY = 'nexusbio_goal_context'

// ─── Pure Functions ───────────────────────────────────────

/**
 * 保存 Goal Context 到 sessionStorage。
 * 由 /start/page.tsx 在用户确认时调用。
 */
export function saveGoalContext(ctx: GoalContext): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx))
  } catch {
    // sessionStorage 不可用时静默失败（SSR 环境）
  }
}

/**
 * 从 sessionStorage 读取 Goal Context。
 * 返回 null 表示没有活跃的目标（用户直接访问工具页面）。
 */
export function loadGoalContext(): GoalContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as GoalContext
  } catch {
    return null
  }
}

/**
 * 推进工作流到指定步骤。
 * 由 NextStepButton 在用户点击时调用。
 */
export function advanceToStep(index: number): void {
  const ctx = loadGoalContext()
  if (!ctx) return
  ctx.currentStepIndex = index
  saveGoalContext(ctx)
}

/**
 * 清除 Goal Context（工作流完成 或 用户主动退出）。
 */
export function clearGoalContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* 静默失败 */ }
}

/**
 * 根据 stepId 找到该步骤在 chain 中的 index。
 * 返回 -1 表示该页面不在当前工作流中。
 */
export function findStepIndex(ctx: GoalContext, stepId: string): number {
  return ctx.chain.findIndex(step => step.id === stepId)
}

/**
 * 构建初始 GoalContext，由 /start/page.tsx 调用。
 */
export function buildGoalContext(
  goal: string,
  inputType: InputType
): GoalContext {
  return {
    goal,
    inputType,
    chain: WORKFLOW_CHAINS[inputType] ?? WORKFLOW_CHAINS.FREEFORM,
    currentStepIndex: 0,
    startedAt: new Date().toISOString(),
  }
}
```

---

## Phase 2：新建 `components/WorkflowBanner.tsx`

### 功能

- 挂载时读 sessionStorage
- 无 context → render null（完全不占空间）
- 有 context → 显示目标 + 进度条 + 关闭按钮
- 监听 `pathname` 变化，自动更新"当前步骤"高亮

### 完整代码

```tsx
// components/WorkflowBanner.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  loadGoalContext,
  clearGoalContext,
  findStepIndex,
  type GoalContext,
} from '@/lib/goal-context'

export default function WorkflowBanner() {
  const [ctx, setCtx] = useState<GoalContext | null>(null)
  const pathname = usePathname()

  // 每次路径变化时重新读 sessionStorage
  useEffect(() => {
    setCtx(loadGoalContext())
  }, [pathname])

  if (!ctx) return null

  const activeIndex = findStepIndex(ctx, getStepIdFromPath(pathname))

  function handleDismiss() {
    clearGoalContext()
    setCtx(null)
  }

  return (
    <div className="w-full bg-muted/50 border-b border-border px-4 py-2 flex items-center gap-4 text-sm">
      {/* 目标标签 */}
      <span className="text-muted-foreground shrink-0">目标：</span>
      <span className="font-medium text-foreground shrink-0 max-w-[120px] truncate">
        {ctx.goal}
      </span>

      {/* 进度链 */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
        {ctx.chain.map((step, index) => {
          const isDone    = index < activeIndex
          const isCurrent = index === activeIndex
          const isPending = index > activeIndex

          return (
            <div key={step.id} className="flex items-center gap-1 shrink-0">
              {/* Step pill */}
              <span
                className={[
                  'px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
                  isDone    ? 'bg-green-100 text-green-700 line-through opacity-60' : '',
                  isCurrent ? 'bg-primary text-primary-foreground' : '',
                  isPending ? 'bg-muted text-muted-foreground' : '',
                ].join(' ')}
              >
                {isDone ? '✓ ' : ''}{step.label}
              </span>

              {/* Arrow (不在最后一步后显示) */}
              {index < ctx.chain.length - 1 && (
                <span className="text-muted-foreground text-xs">→</span>
              )}
            </div>
          )
        })}
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={handleDismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="退出工作流"
      >
        ✕
      </button>
    </div>
  )
}

/**
 * 根据当前 pathname 推断 stepId。
 * 路径到 stepId 的映射，与 WORKFLOW_CHAINS 保持一致。
 */
function getStepIdFromPath(pathname: string): string {
  if (pathname.includes('/pathd'))           return 'pathd'
  if (pathname.includes('/fbasim'))          return 'fbasim'
  if (pathname.includes('/inversefolding'))  return 'enzyme'
  if (pathname.includes('/multiplexcrispr')) return 'crispr'
  if (pathname.includes('/straindesign'))    return 'strain'
  if (pathname.includes('/circuitcompiler')) return 'circuit'
  if (pathname.includes('/bioprocess'))      return 'bioprocess'
  if (pathname.includes('/analyze'))         return 'analyze'
  return ''  // 不在工作流中的页面，返回空字符串
}
```

---

## Phase 3：新建 `components/NextStepButton.tsx`

### 功能

- 接收 `currentStepId` prop
- 读 sessionStorage 找到下一步
- 如果没有下一步（最后一步）→ 显示"完成 ✓"并清除 context
- 如果当前页面不在链中 → render null

```tsx
// components/NextStepButton.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  loadGoalContext,
  advanceToStep,
  clearGoalContext,
  findStepIndex,
  type GoalContext,
} from '@/lib/goal-context'

interface Props {
  currentStepId: string
}

export default function NextStepButton({ currentStepId }: Props) {
  const [ctx, setCtx] = useState<GoalContext | null>(null)
  const router = useRouter()

  useEffect(() => {
    setCtx(loadGoalContext())
  }, [])

  if (!ctx) return null

  const currentIndex = findStepIndex(ctx, currentStepId)
  if (currentIndex === -1) return null  // 该页面不在当前工作流

  const nextStep = ctx.chain[currentIndex + 1] ?? null
  const isLastStep = !nextStep

  function handleNext() {
    if (!ctx) return
    if (isLastStep) {
      clearGoalContext()
      // 可选：跳回 /start 或留在当前页
      return
    }
    advanceToStep(currentIndex + 1)
    router.push(nextStep!.route)
  }

  return (
    <div className="mt-8 pt-6 border-t border-border flex justify-end">
      <button
        onClick={handleNext}
        className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"
      >
        {isLastStep ? (
          <>工作流完成 ✓</>
        ) : (
          <>下一步：{nextStep!.label} →</>
        )}
      </button>
    </div>
  )
}
```

---

## Phase 4：修改 `app/layout.tsx`

在 `<body>` 内部，所有内容**之前**加入 `<WorkflowBanner />`。

```tsx
// 在文件顶部加 import
import WorkflowBanner from '@/components/WorkflowBanner'

// 在 <body> 内加（具体位置在现有 Navbar 下方，main 内容上方）
<body>
  <Navbar />              {/* 现有导航，不动 */}
  <WorkflowBanner />      {/* 新加，在导航下方 */}
  <main>
    {children}
  </main>
</body>
```

> 先读 layout.tsx 全文，找到正确的插入位置，不要猜测。

---

## Phase 5：修改 `app/start/page.tsx`

在用户点击"确认，前往工具链"时，在 `router.push()` **之前**插入：

```typescript
import { buildGoalContext, saveGoalContext } from '@/lib/goal-context'

// 在 onConfirm handler 里：
function handleConfirm() {
  // 1. 构建并保存 Goal Context
  const ctx = buildGoalContext(parseResult.rawInput, parseResult.type)
  saveGoalContext(ctx)

  // 2. 再跳转（原有逻辑不变）
  router.push(parseResult.routeTo)
}
```

---

## Phase 6：在 8 个工具页面加 `<NextStepButton />`

每个工具页面只需在页面最底部加一行，不动任何其他内容：

```tsx
import NextStepButton from '@/components/NextStepButton'

// 页面 JSX 最底部（在最外层 div 的结尾处）：
<NextStepButton currentStepId="pathd" />
```

各页面对应的 stepId：

| 文件路径 | currentStepId |
|----------|---------------|
| `app/tools/pathd/page.tsx` | `"pathd"` |
| `app/tools/fbasim/page.tsx` | `"fbasim"` |
| `app/tools/inversefolding/page.tsx` | `"enzyme"` |
| `app/tools/multiplexcrispr/page.tsx` | `"crispr"` |
| `app/tools/straindesign/page.tsx` | `"strain"` |
| `app/tools/circuitcompiler/page.tsx` | `"circuit"` |
| `app/tools/bioprocess/page.tsx` | `"bioprocess"` |
| `app/analyze/page.tsx` | `"analyze"` |

> 先用 `find` 命令确认这 8 个文件的实际路径，再修改。路径错误是最常见的 Claude Code 失误。

---

## 执行顺序

```
Step 1  跑所有 audit 命令，确认路径
Step 2  新建 lib/goal-context.ts
Step 3  新建 components/WorkflowBanner.tsx
Step 4  新建 components/NextStepButton.tsx
Step 5  修改 app/layout.tsx（加 WorkflowBanner）
Step 6  修改 app/start/page.tsx（加 saveGoalContext 调用）
Step 7  修改 8 个工具页面（加 NextStepButton，每个文件先 read 再 edit）
Step 8  npm run dev，手动测试完整流程（见下方）
```

---

## 验证测试（Step 8 必须手动过）

```
测试 1 — 完整 MOLECULE 流程：
  1. 首页输入 "artemisinin" → 回车
  2. /start 页面显示"目标分子 HIGH"识别卡
  3. 点击"确认" → 跳转到 /tools/pathd
  4. 页面顶部出现 Banner：
     "目标：artemisinin  [Pathway Discovery] → FBA Simulation → Enzyme Design → CRISPR Multiplex  ✕"
  5. 页面底部出现按钮："下一步：FBA Simulation →"
  6. 点击 → 跳到 /tools/fbasim
  7. Banner 更新：✓ Pathway Discovery → [FBA Simulation] → Enzyme Design → CRISPR Multiplex
  ✅ Pass 条件：Banner 高亮随路由变化

测试 2 — 直接访问工具页面（无 context）：
  1. 新标签页直接访问 /tools/pathd
  2. Banner 不显示
  3. NextStepButton 不显示
  ✅ Pass 条件：页面与修改前完全相同

测试 3 — 关闭 Banner：
  1. 完整流程进行中，点击 Banner 右侧 ✕
  2. Banner 消失
  3. 刷新页面，Banner 不再出现
  ✅ Pass 条件：sessionStorage 已清除

测试 4 — STRAIN 流程：
  1. 首页输入 "E. coli K-12"
  2. 确认 → /tools/fbasim
  3. Banner 链：[FBA Simulation] → Strain Design → Genetic Circuit
  ✅ Pass 条件：链与 MOLECULE 不同
```

---

## 绝对不允许做的事

1. **不要把 GoalContext 存入 localStorage**——用 sessionStorage，关标签页自动清除
2. **不要在 goal-context.ts 里 import 任何 React**——纯 TypeScript 模块
3. **不要在 layout.tsx 里 import WorkflowBanner 时加 'use client'**——layout 本身可以是 server component，WorkflowBanner 内部自己声明 'use client'
4. **不要修改任何工具页面的现有 JSX 结构**——只在最底部追加 `<NextStepButton />`
5. **不要在 WorkflowBanner 里 hardcode 任何步骤名**——全部从 sessionStorage 读取
6. **不要跳过 audit 命令直接开始改文件**
