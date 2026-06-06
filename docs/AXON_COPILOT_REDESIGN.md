# 🤖 Axon Copilot — Full View 重构方案

> **设计标准**: Apple HIG + GitHub Copilot Chat + Claude Code Chat
> **审计方法**: 3 个独立 AI agent 并行审计（现有实现 / 竞品分析 / 上下文模型）
> **日期**: 2026-06-06

---

## 一、现状诊断

### 1.1 当前架构

Axon Copilot 有两个入口：

| 入口 | 文件 | 行数 | 定位 |
|------|------|------|------|
| CopilotSlideOver | `src/components/ide/CopilotSlideOver.tsx` | 526 | Ctrl+K 侧滑面板，轻量级 |
| NEXAIPage | `src/components/tools/NEXAIPage.tsx` | 907 | `/tools/nexai` 全页面，深度阅读 |

两者共享：
- `axonContext.ts` — 工作台→提示词上下文桥接
- `/api/analyze` — AI 端点（Groq → Gemini fallback）
- `axonSessionView.ts` — 会话派生模型

### 1.2 发现的 28 个问题

#### 🔴 严重问题（违反已声明规则）

| # | 问题 | 位置 |
|---|------|------|
| C1 | "Ask" 按钮使用浅色背景 `#f4f7fb`，违反"no light backgrounds"规则 | PromptInput:208, CopilotSlideOver:336 |
| C2 | textarea 的 `outline` 始终可见（非仅 focus 时） | PromptInput:175, CopilotSlideOver:312 |

#### 🟡 高影响 UX 问题

| # | 问题 | 位置 |
|---|------|------|
| H1 | NEXAIPage 3 列网格无移动端适配 | NEXAIPage:372 |
| H2 | 中间列堆叠 7 个区域，信息过载 | NEXAIPage:563-798 |
| H3 | API 调用期间无 loading 指示器 | ResultPanel |
| H4 | 快速提交查询时存在竞态条件（无 AbortController） | NEXAIPage:228 |
| H5 | 侧滑面板无 focus trap | CopilotSlideOver:173 |

#### 🟢 中等影响问题

| # | 问题 | 位置 |
|---|------|------|
| M1 | 引用图节点标签截断为 14 字符 | EvidencePanel:248 |
| M2 | 引用图 hover 无 tooltip | EvidencePanel |
| M3 | SVG 引用图无键盘导航 | EvidencePanel |
| M4 | 重排按钮低于 44px 最小触摸目标 | AutomationDrawer:52 |
| M5 | 历史记录循环（ArrowUp/ArrowDown）不可发现 | PromptInput:81-92 |
| M6 | AxonPlanPanel 无依赖可视化 | AxonPlanPanel |
| M7 | 空闲状态六边形在深色背景上几乎不可见 | ResultPanel:121 |

---

## 二、设计原则（来自 GitHub Copilot + Claude Code）

### 从 GitHub Copilot 学到的

| 原则 | 应用 |
|------|------|
| **上下文可见** | 显示 `#pathway:artemisinin`、`#tool:fbasim` 等上下文芯片 |
| **单列对话流** | 不用气泡，用堆叠卡片，助手消息全宽 |
| **代码块有操作栏** | 每个代码块有 Copy / Apply / Explain 按钮 |
| **流式响应** | 逐 token 显示 + 闪烁光标 + Stop 按钮 |
| **侧边栏 vs 内联** | 侧边栏=思考/探索，内联=执行/编辑 |

### 从 Claude Code 学到的

| 原则 | 应用 |
|------|------|
| **工具调用可见** | 每个工具调用是可展开卡片（名称 + 状态 + 输出） |
| **Diff 先于应用** | 修改前显示 diff，用户确认后才执行 |
| **真实进度** | 步骤计数器 + 耗时 + 阶段标签，无假动画 |
| **诚实优先** | 不支持的功能明确报错，不静默降级 |
| **非阻塞** | 用户可在 AI 处理时继续工作 |

### Nexus-Bio 特有原则

| 原则 | 来源 |
|------|------|
| **科学诚实** | 不伪造工作台状态，缺失字段直接省略 |
| **有界上下文** | 注入提示词的每个字段有长度上限 |
| **关注点分离** | Copilot 建议，用户决定；工具有效载荷由工具页面写入 |
| **渐进披露** | 默认显示综合文本，证据图和原始 JSON 一键展开 |

---

## 三、重构方案 — 逐步执行

### Phase A: 紧急修复（2 小时）

#### A1: 修复浅色按钮（违反 dark-theme 规则）

**文件 1**: `src/components/tools/nexai/PromptInput.tsx`

**查找**（约第 208 行）:
```typescript
background: '#f4f7fb',
color: '#111318',
```

**替换为**:
```typescript
background: 'rgba(175, 195, 214, 0.2)',
color: T.VALUE,
border: `1px solid rgba(175, 195, 214, 0.3)`,
```

**查找**（hover 状态，同文件）:
```typescript
background: '#ffffff',
```

**替换为**:
```typescript
background: 'rgba(175, 195, 214, 0.3)',
```

**文件 2**: `src/components/ide/CopilotSlideOver.tsx`

**查找**（约第 336 行）:
```typescript
background: '#f4f7fb',
color: '#111318',
```

**替换为**:
```typescript
background: 'rgba(175, 195, 214, 0.2)',
color: T.VALUE,
border: `1px solid rgba(175, 195, 214, 0.3)`,
```

**验证**: `npx tsc --noEmit` + `npm test`

---

#### A2: 修复 textarea outline（仅 focus 时显示）

**文件 1**: `src/components/tools/nexai/PromptInput.tsx`

**查找**（约第 175 行）:
```typescript
outline: '2px solid rgba(175,195,214,0.5)',
```

**替换为**:
```typescript
outline: 'none',
```

**添加 focus 样式**（在 textarea 的 `onFocus`/`onBlur` 处理中）:
```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid rgba(175,195,214,0.5)';
}}
onBlur={(e) => {
  e.currentTarget.style.outline = 'none';
}}
```

**文件 2**: `src/components/ide/CopilotSlideOver.tsx`（约第 312 行）— 同样修改。

**验证**: `npx tsc --noEmit` + `npm test`

---

#### A3: 添加 AbortController 防止竞态条件

**文件**: `src/components/tools/NEXAIPage.tsx`

**查找** `runQuery` 函数（约第 228 行），在函数开头添加：

```typescript
const abortRef = useRef<AbortController | null>(null);

const runQuery = async (queryOverride?: string) => {
  const query = (queryOverride ?? query).trim();
  if (!query || loading) return;

  // 取消上一个未完成的请求
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;

  setLoading(true);
  // ... 现有逻辑 ...

  // 在 fetch 调用中添加 signal
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ /* ... */ }),
    signal: controller.signal,
  });

  // 在处理响应前检查是否被取消
  if (controller.signal.aborted) return;

  // ... 现有响应处理逻辑 ...
};
```

**在组件卸载时清理**:
```typescript
useEffect(() => {
  return () => abortRef.current?.abort();
}, []);
```

**验证**: `npx tsc --noEmit` + `npm test`

---

### Phase B: 对话界面重构（4 小时）

#### B1: 创建 ChatMessage 组件

参考 GitHub Copilot 的单列对话流（非气泡），创建统一的消息组件。

**文件**: `src/components/tools/nexai/ChatMessage.tsx`（新建）

```typescript
'use client';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';

export type MessageRole = 'user' | 'assistant' | 'system';

interface ChatMessageProps {
  role: MessageRole;
  content: string;
  timestamp?: number;
  confidence?: number;
  citations?: number;
  isLoading?: boolean;
  actions?: Array<{ label: string; onClick: () => void; accent?: string }>;
}

export function ChatMessage({
  role, content, timestamp, confidence, citations, isLoading, actions,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '12px 16px',
      borderRadius: '16px',
      background: isUser
        ? 'rgba(175, 195, 214, 0.08)'
        : isSystem
          ? 'rgba(147, 203, 82, 0.06)'
          : 'rgba(255, 255, 255, 0.03)',
      border: `1px solid ${isUser
        ? 'rgba(175, 195, 214, 0.12)'
        : isSystem
          ? 'rgba(147, 203, 82, 0.12)'
          : 'rgba(255, 255, 255, 0.06)'}`,
    }}>
      {/* Header: role badge + timestamp */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '10px', fontFamily: T.MONO,
      }}>
        <span style={{
          padding: '2px 6px', borderRadius: '6px',
          background: isUser ? 'rgba(175,195,214,0.15)' : isSystem ? 'rgba(147,203,82,0.15)' : 'rgba(232,163,161,0.15)',
          color: isUser ? T.SKY : isSystem ? '#93CB52' : T.CORAL,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {isUser ? 'You' : isSystem ? 'System' : 'Axon'}
        </span>
        {timestamp && (
          <span style={{ color: PATHD_THEME.label }}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {confidence !== undefined && (
          <span style={{ color: confidence > 0.7 ? '#93CB52' : confidence > 0.4 ? T.APRICOT : T.CORAL }}>
            {(confidence * 100).toFixed(0)}% confidence
          </span>
        )}
        {citations !== undefined && citations > 0 && (
          <span style={{ color: PATHD_THEME.label }}>
            {citations} citation{citations > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{
          display: 'flex', gap: '4px', padding: '8px 0',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: PATHD_THEME.label,
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      ) : (
        <div style={{
          fontFamily: T.SANS, fontSize: '13px', lineHeight: 1.65,
          color: PATHD_THEME.value, whiteSpace: 'pre-wrap',
        }}>
          {content}
        </div>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              style={{
                padding: '4px 10px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${action.accent ?? 'rgba(255,255,255,0.12)'}`,
                color: action.accent ?? PATHD_THEME.label,
                fontFamily: T.MONO, fontSize: '10px', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

#### B2: 创建 ContextChips 组件

参考 GitHub Copilot 的 `#file` 引用芯片，显示 Axon 拥有的上下文。

**文件**: `src/components/tools/nexai/ContextChips.tsx`（新建）

```typescript
'use client';
import { useWorkbenchStore } from '../../../store/workbenchStore';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

export function ContextChips() {
  const project = useWorkbenchStore(s => s.project);
  const analyzeArtifact = useWorkbenchStore(s => s.analyzeArtifact);
  const evidenceItems = useWorkbenchStore(s => s.evidenceItems);
  const selectedEvidenceIds = useWorkbenchStore(s => s.selectedEvidenceIds);
  const currentToolId = useWorkbenchStore(s => s.currentToolId);
  const workflowControl = useWorkbenchStore(s => s.workflowControl);

  const chips: Array<{ label: string; value: string; accent: string }> = [];

  if (project?.title) {
    chips.push({ label: 'Project', value: project.title, accent: T.SKY });
  }
  if (analyzeArtifact?.targetProduct) {
    chips.push({ label: 'Target', value: analyzeArtifact.targetProduct, accent: T.MINT });
  }
  if (currentToolId) {
    chips.push({ label: 'Tool', value: currentToolId, accent: T.LILAC });
  }
  if (evidenceItems.length > 0) {
    const selected = selectedEvidenceIds.length;
    chips.push({
      label: 'Evidence',
      value: `${selected}/${evidenceItems.length} selected`,
      accent: T.APRICOT,
    });
  }
  if (workflowControl?.status && workflowControl.status !== 'idle') {
    chips.push({
      label: 'Workflow',
      value: workflowControl.status,
      accent: workflowControl.status === 'blocked' ? T.CORAL : T.MINT,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div style={{
      display: 'flex', gap: '6px', flexWrap: 'wrap',
      padding: '6px 0',
    }}>
      {chips.map((chip, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '6px',
          background: `${chip.accent}15`,
          border: `1px solid ${chip.accent}30`,
          fontFamily: T.MONO, fontSize: '9px',
          color: chip.accent, letterSpacing: '0.05em',
        }}>
          <span style={{ opacity: 0.6 }}>#{chip.label.toLowerCase()}</span>
          {chip.value}
        </span>
      ))}
    </div>
  );
}
```

---

#### B3: 重构 NEXAIPage 布局 — 对话流

**核心改动**: 将中间列从 7 层堆叠改为对话流布局。

**文件**: `src/components/tools/NEXAIPage.tsx`

**当前布局**（中间列，7 层堆叠）:
```
1. Agentic mode toggle bar
2. PromptInput
3. Surface view tabs
4. Main reading surface (ResultPanel / AgentSessionViewer / EvidencePanel)
5. RawJsonDrawer
6. AutomationDrawer
7. Secondary panels (plan + log)
```

**新布局**（对话流 + 底部固定输入）:
```
┌─────────────────────────────────────────────┐
│  ContextChips (工作台上下文)                   │
├─────────────────────────────────────────────┤
│                                             │
│  ChatMessage (user)                         │
│  ChatMessage (assistant) + actions          │
│  ChatMessage (user)                         │
│  ChatMessage (assistant) + actions          │
│  ...                                        │
│                                             │
├─────────────────────────────────────────────┤
│  [Agentic toggle] [Session] [Evidence] tabs │
├─────────────────────────────────────────────┤
│  PromptInput (固定在底部)                     │
└─────────────────────────────────────────────┘
```

**修改步骤**:

**步骤 1**: 在 NEXAIPage 中添加 conversation state

```typescript
// 在 state 声明区域添加
const [messages, setMessages] = useState<Array<{
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  confidence?: number;
  citations?: number;
  actions?: Array<{ label: string; onClick: () => void }>;
}>>([]);
```

**步骤 2**: 修改 `runQuery` 函数，在发送前添加 user 消息，在响应后添加 assistant 消息

```typescript
// 在 runQuery 开头添加
setMessages(prev => [...prev, {
  role: 'user',
  content: query,
  timestamp: Date.now(),
}]);

// 在收到响应后添加
setMessages(prev => [...prev, {
  role: 'assistant',
  content: result.answer,
  timestamp: Date.now(),
  confidence: result.confidence,
  citations: result.citations?.length ?? 0,
  actions: result.next_steps?.map(step => ({
    label: step,
    onClick: () => handleAction(step),
  })),
}]);
```

**步骤 3**: 重构中间列 JSX

```typescript
// 替换现有的中间列内容
<div style={{
  display: 'flex', flexDirection: 'column',
  height: '100%', overflow: 'hidden',
}}>
  {/* Context chips */}
  <div style={{ padding: '8px 16px', borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}` }}>
    <ContextChips />
  </div>

  {/* Conversation stream */}
  <div style={{
    flex: 1, overflowY: 'auto',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  }}>
    {messages.length === 0 && (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: '16px',
        color: PATHD_THEME.label, fontFamily: T.SANS,
      }}>
        <div style={{ fontSize: '32px', opacity: 0.3 }}>⬡</div>
        <div style={{ fontSize: '14px' }}>Ask Axon about your research</div>
        <div style={{ fontSize: '11px', opacity: 0.6 }}>
          Axon has access to your workbench state, pathway data, and evidence.
        </div>
      </div>
    )}
    {messages.map((msg, i) => (
      <ChatMessage key={i} {...msg} />
    ))}
    {loading && (
      <ChatMessage role="assistant" content="" isLoading timestamp={Date.now()} />
    )}
    <div ref={messagesEndRef} />
  </div>

  {/* Mode tabs (compact) */}
  {(result || agenticMode) && (
    <div style={{
      display: 'flex', gap: '2px', padding: '4px 16px',
      borderTop: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
    }}>
      {['answer', 'evidence', 'session'].map(tab => (
        <button key={tab} onClick={() => setSurfaceView(tab as any)}
          style={{
            padding: '4px 10px', borderRadius: '6px', border: 'none',
            background: surfaceView === tab ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: surfaceView === tab ? T.VALUE : PATHD_THEME.label,
            fontFamily: T.MONO, fontSize: '10px', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
          {tab}
        </button>
      ))}
    </div>
  )}

  {/* Input (fixed at bottom) */}
  <div style={{ padding: '8px 16px', borderTop: `1px solid ${PATHD_THEME.sepiaPanelBorder}` }}>
    <PromptInput
      value={query}
      onChange={setQuery}
      onSubmit={() => runQuery()}
      loading={loading}
      placeholder="Ask about pathways, enzymes, thermodynamics..."
    />
  </div>
</div>
```

**步骤 4**: 将 ResultPanel、EvidencePanel、AgentSessionViewer 移到侧边栏或抽屉中

当 `surfaceView` 切换时，显示对应的面板（覆盖在对话流上方，或在右侧栏中）。

---

### Phase C: 交互增强（3 小时）

#### C1: 添加 loading 动画到 ChatMessage

在 `ChatMessage.tsx` 中已包含 loading 状态的三点脉冲动画。需要在 `globals.css` 中添加：

```css
@keyframes pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
```

#### C2: 添加 Stop 生成按钮

**文件**: `src/components/tools/nexai/PromptInput.tsx`

在 loading 状态时，将 "Ask Axon" 按钮替换为 "Stop" 按钮：

```typescript
{loading ? (
  <button
    onClick={onStop}
    style={{
      padding: '8px 16px', borderRadius: '12px',
      background: 'rgba(250, 128, 114, 0.15)',
      border: '1px solid rgba(250, 128, 114, 0.3)',
      color: T.CORAL, fontFamily: T.SANS, fontSize: '12px',
      cursor: 'pointer',
    }}
  >
    Stop
  </button>
) : (
  <button onClick={onSubmit} /* ... 现有样式 ... */>
    Ask Axon
  </button>
)}
```

#### C3: 将 next_steps 转为可点击操作

**文件**: `src/components/tools/nexai/ChatMessage.tsx`（已在 B1 中包含 actions 支持）

在 NEXAIPage 中，解析 result.next_steps 并转为 actions：

```typescript
const actions = result?.next_steps?.map(step => {
  // 解析 "Run FBA simulation" → 导航到 /tools/fbasim
  const toolMatch = step.match(/(?:run|check|use|open)\s+(\w+)/i);
  if (toolMatch) {
    const toolName = toolMatch[1].toLowerCase();
    const toolRoutes: Record<string, string> = {
      fba: '/tools/fbasim', fbasim: '/tools/fbasim',
      cethx: '/tools/cethx', catdes: '/tools/catdes',
      dyncon: '/tools/dyncon', cellfree: '/tools/cellfree',
      pathd: '/tools/pathd', genmim: '/tools/genmim',
    };
    const route = toolRoutes[toolName];
    if (route) {
      return {
        label: step,
        onClick: () => router.push(route),
        accent: T.SKY,
      };
    }
  }
  return { label: step, onClick: () => {} };
}) ?? [];
```

#### C4: 引用图 tooltip

**文件**: `src/components/tools/nexai/EvidencePanel.tsx`

在 SVG 节点上添加 `<title>` 元素：

```typescript
// 在每个 node circle 内添加
<title>{n.title} ({n.year}) — Relevance: {(n.relevance * 100).toFixed(0)}%</title>
```

同时将标签截断从 14 字符提升到 24 字符：

```typescript
// 查找
n.title.slice(0, 14)
// 替换为
n.title.length > 24 ? n.title.slice(0, 24) + '…' : n.title
```

#### C5: 侧滑面板 focus trap

**文件**: `src/components/ide/CopilotSlideOver.tsx`

在 panel div 上添加 focus trap 逻辑：

```typescript
// 在 panel 打开时
useEffect(() => {
  if (!open) return;
  const panel = panelRef.current;
  if (!panel) return;

  const focusable = panel.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  panel.addEventListener('keydown', handleTab);
  first?.focus();
  return () => panel.removeEventListener('keydown', handleTab);
}, [open]);
```

---

### Phase D: 响应式适配（2 小时）

#### D1: NEXAIPage 移动端布局

**文件**: `src/components/tools/NEXAIPage.tsx`

将固定 3 列网格改为响应式：

```typescript
// 查找
columns="200px 1fr 200px"

// 替换为（使用 CSS 媒体查询）
// 在 ToolShell 外包裹一个 div，或使用 responsive grid
```

在 `globals.css` 中添加：

```css
@media (max-width: 768px) {
  .nexai-layout {
    grid-template-columns: 1fr !important;
  }
  .nexai-left-rail,
  .nexai-right-rail {
    display: none;
  }
}
```

---

## 四、文件修改清单

| # | 文件 | 操作 | 复杂度 |
|---|------|------|--------|
| 1 | `src/components/tools/nexai/PromptInput.tsx` | 修复按钮颜色 + outline + 添加 Stop 按钮 | 低 |
| 2 | `src/components/ide/CopilotSlideOver.tsx` | 修复按钮颜色 + outline + focus trap | 低 |
| 3 | `src/components/tools/nexai/ChatMessage.tsx` | 新建 — 对话消息组件 | 中 |
| 4 | `src/components/tools/nexai/ContextChips.tsx` | 新建 — 上下文芯片组件 | 低 |
| 5 | `src/components/tools/NEXAIPage.tsx` | 重构布局为对话流 + 添加 AbortController + conversation state | 高 |
| 6 | `src/components/tools/nexai/EvidencePanel.tsx` | tooltip + 标签截断提升 | 低 |
| 7 | `app/globals.css` | 添加 pulse 动画 + 响应式断点 | 低 |

---

## 五、执行顺序

| 阶段 | 任务 | 预计耗时 | 依赖 |
|------|------|----------|------|
| A1 | 修复浅色按钮 | 15 min | 无 |
| A2 | 修复 textarea outline | 10 min | 无 |
| A3 | 添加 AbortController | 20 min | 无 |
| B1 | 创建 ChatMessage 组件 | 30 min | 无 |
| B2 | 创建 ContextChips 组件 | 20 min | 无 |
| B3 | 重构 NEXAIPage 布局 | 2 hr | B1, B2 |
| C1 | loading 动画 | 10 min | B1 |
| C2 | Stop 按钮 | 15 min | A1 |
| C3 | next_steps 可点击 | 30 min | B1 |
| C4 | 引用图 tooltip | 15 min | 无 |
| C5 | focus trap | 20 min | 无 |
| D1 | 移动端适配 | 1 hr | B3 |

**总计**: ~6 小时

---

## 六、验证清单

每个阶段完成后：

```bash
npx tsc --noEmit          # 零类型错误
npm test                   # 625 测试全通过
npm run build              # 构建成功
```

Phase B 完成后额外验证：
- 打开 `/tools/nexai`，确认对话流布局正确
- 发送查询，确认消息以 ChatMessage 格式显示
- 确认 ContextChips 显示工作台状态
- 确认 loading 状态有三点脉冲动画
- 确认 Stop 按钮在 loading 时出现

Phase C 完成后额外验证：
- 确认 next_steps 是可点击的按钮
- 确认引用图 hover 显示 tooltip
- 确认侧滑面板 Tab 键不逃逸

Phase D 完成后额外验证：
- 在 768px 宽度下确认单列布局
- 确认左右栏在移动端隐藏

---

> **下一步**: 从 Phase A 开始执行（紧急修复，2 小时内完成）
