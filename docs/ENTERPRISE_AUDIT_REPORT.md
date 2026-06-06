# 🔬 Nexus-Bio 1.0 — 企业级成熟度诊断报告

> **审计日期**: 2026-06-06
> **审计范围**: CLAUDE.md 文档体系、Skill 生态、代码架构、DevOps 基础设施
> **审计方法**: 4 个独立 AI agent 并行审计 + 事实性验证 agent 交叉核验
> **目标标准**: Silicon Valley 企业级（对标 Vercel / Linear / Stripe）

---

## 目录

- [一、总评与评分矩阵](#一总评与评分矩阵)
- [二、P0 — 必须立即修复（阻塞级）](#二p0--必须立即修复阻塞级)
- [三、P1 — 本周必须修复（质量级）](#三p1--本周必须修复质量级)
- [四、P2 — 两周内修复（工程卫生级）](#四p2--两周内修复工程卫生级)
- [五、P3 — 低优先级](#五p3--低优先级)
- [六、CLAUDE.md 详细审计](#六claude-md-详细审计)
- [七、Skill 生态详细审计](#七skill-生态详细审计)
- [八、代码架构详细审计](#八代码架构详细审计)
- [九、DevOps 基础设施详细审计](#九devops-基础设施详细审计)
- [十、推荐项目团队结构](#十推荐项目团队结构)
- [十一、完整修改路线图](#十一完整修改路线图)

---

## 一、总评与评分矩阵

### 综合评分: 4.1 / 10 🔴

| 维度 | 评分 | 等级 | 核心问题 |
|------|------|------|----------|
| CLAUDE.md 文档体系 | **3.4/10** | 🔴 | 事实性错误、缺失关键章节、无 ADR |
| Skill/Command 生态 | **2.5/10** | 🔴 | 仅 2 个 skill，8 个关键 skill 缺失 |
| 代码架构质量 | **6.5/10** | 🟡 | 结构扎实但有类型泄漏、巨型组件、代码重复 |
| DevOps/基础设施 | **4.1/10** | 🔴 | 零 CI/CD、零监控、SQLite 冷启动丢失 |

### 评分等级说明

- 🔴 **0-3**: 严重缺失，阻塞生产部署
- 🟡 **4-6**: 原型级，需要系统性改进
- 🟢 **7-10**: 企业级，可接受

---

## 二、P0 — 必须立即修复（阻塞级）

### P0-1: 零 CI/CD — 任何 push 直接部署到生产

**现状**: `.github/workflows/` 目录不存在。`.github/` 目录仅有 `ISSUE_TEMPLATE/`（含 3 个 YAML 模板）。`vercel.json` 仅含 `framework`、`buildCommand`、`installCommand`，无预部署检查。

**影响**: 任何对 `main` 分支的 commit 都会直接部署到生产环境，无自动化验证。

**修改方案**:

**步骤 1**: 创建 GitHub Actions 工作流目录
```
文件: .github/workflows/ci.yml (新建)
```

**步骤 2**: 写入 CI 配置内容
```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit          # Type check
      - run: npm test                    # 76 test files
      - run: npm run build               # Build check
```

**步骤 3**: 创建 `.env.example`（详见 P0-4）

**步骤 4**: 在 GitHub 仓库设置中启用 Branch Protection
- Settings → Branches → Add rule for `main`
- ✅ Require status checks to pass before merging
- ✅ Select `quality-gates` as required check
- ✅ Require pull request reviews (至少 1 人)

**步骤 5**: 验证
- 创建一个测试 PR，确认 CI pipeline 运行
- 确认 PR 无法在 CI 失败时合并

---

### P0-2: 零监控 — 无日志、无错误追踪、无告警

**现状**:
- 整个 `app/api/` 目录仅有 3 处 `console.log/error/info`（在 `fba/route.ts` 和 `workbench/route.ts`）
- 无 Sentry、Datadog、LogRocket 等错误监控
- 无 `/api/health` 健康检查端点
- Edge Runtime 超时 `TIMEOUT_MS = 12000` 硬编码，无超时事件观测
- 无机制检测 AI provider 全部失败或 SQLite 数据库损坏

**修改方案**:

**步骤 1**: 安装 Sentry
```bash
npx @sentry/wizard@latest -i nextjs
```
这会自动修改以下文件：
- `next.config.mjs`（添加 Sentry webpack 插件）
- 创建 `sentry.client.config.ts`
- 创建 `sentry.server.config.ts`
- 创建 `sentry.edge.config.ts`

**步骤 2**: 在 `next.config.mjs` 中确认 Sentry 插件已添加
```javascript
// next.config.mjs 顶部应有
import { withSentryConfig } from "@sentry/nextjs";

// 导出应被 withSentryConfig 包裹
export default withSentryConfig(nextConfig, {
  silent: true,
  org: "nexus-bio",
  project: "nexus-bio-web",
});
```

**步骤 3**: 创建健康检查端点
```
文件: app/api/health/route.ts (新建)
```
```typescript
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
  });
}
```

**步骤 4**: 在 `analyze/route.ts` 中添加超时观测
```typescript
// 在 TIMEOUT_MS 使用处（约第 340 行附近）
const controller = new AbortController();
const timeout = setTimeout(() => {
  controller.abort();
  // 添加 Sentry 捕获
  captureMessage('AI provider timeout', {
    level: 'warning',
    extra: { provider: currentProvider, timeoutMs: TIMEOUT_MS },
  });
}, TIMEOUT_MS);
```

**步骤 5**: 验证
- 部署后访问 `https://nexus-bio-1-0.vercel.app/api/health` 确认返回 `{"status":"ok",...}`
- 在 Sentry dashboard 确认事件接收

---

### P0-3: SQLite 冷启动丢失 — 所有 workbench 数据在 Vercel cold start 时清零

**现状**: `src/server/workbenchDb.ts` 第 1-17 行明确记录 SQLite 在 Vercel cold start 时丢失。迁移到 Turso 的路径已概述但未实现。无备份策略、无迁移系统。

**影响**: 用户的项目状态、实验记录、审计日志在每次 cold start 后全部丢失。

**修改方案（短期 — 本周）**:

**步骤 1**: 在 `app/api/workbench/route.ts` 中添加导出功能
```typescript
// 在 GET handler 中添加 export 参数支持
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('export') === 'true') {
    const state = workbenchDb.getProjectState('default');
    return new NextResponse(JSON.stringify(state, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="workbench-backup.json"',
      },
    });
  }
  // ...existing logic
}
```

**步骤 2**: 在 WorkbenchSyncProvider 中添加 localStorage 双写
```typescript
// src/components/workbench/WorkbenchSyncProvider.tsx
// 在 syncToServer 调用后添加
const localBackup = JSON.stringify(state);
localStorage.setItem('workbench-local-backup', localBackup);
```

**步骤 3**: 添加冷启动恢复逻辑
```typescript
// 在 WorkbenchSyncProvider 初始化时
useEffect(() => {
  const localBackup = localStorage.getItem('workbench-local-backup');
  if (localBackup) {
    try {
      const parsed = JSON.parse(localBackup);
      // 与服务器状态比较 revision，取最新的
      restoreFromBackup(parsed);
    } catch (e) {
      console.warn('Failed to restore local backup:', e);
    }
  }
}, []);
```

**修改方案（长期 — 迁移到 Turso）**:

**步骤 4**: 安装 Turso 客户端
```bash
npm install @libsql/client
```

**步骤 5**: 创建数据库迁移文件
```
文件: src/server/db/migrations/001_initial.sql (新建)
```
```sql
CREATE TABLE IF NOT EXISTS workbench_projects (
  id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_updated
  ON workbench_projects(updated_at);
```

**步骤 6**: 修改 `src/server/workbenchDb.ts`
```typescript
// 替换 better-sqlite3 为 @libsql/client
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
```

**步骤 7**: 在 Vercel 环境变量中添加
```
TURSO_DATABASE_URL=libsql://nexus-bio-your-org.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

**步骤 8**: 验证
- 部署后创建一个 workbench 项目
- 触发 cold start（等待 Vercel function 休眠，约 5-10 分钟）
- 重新访问确认数据仍在

---

### P0-4: CLAUDE.md 有事实性错误

**现状**: 经 agent 验证，以下条目与实际代码库不一致：

| # | 错误 | 实际情况 | 验证方式 |
|---|------|----------|----------|
| 1 | "All 13 Tool Pages" | 表格有 **14 行**（含 ScSpatialPage） | 计数 CLAUDE.md 表格行 |
| 2 | `next.config.js` 在目录树中 | 仅存在 `next.config.mjs` | `ls` 确认 |
| 3 | 目录树缺少 API routes | 缺 `kegg/route.ts`、`scspatial/ingest/route.ts`、`scspatial/query/route.ts` | `ls app/api/` 确认 |
| 4 | `__tests__/ Jest unit tests` 一行带过 | 实际有 **76 个测试文件**，含 benchmark 脚本 | `find __tests__ -name "*.ts"` 确认 |

**修改方案**:

**步骤 1**: 修复工具数量
```
文件: CLAUDE.md 第 184 行附近
修改: "All 13 Tool Pages" → "All 14 Tool Pages"
```

**步骤 2**: 修复目录树中的配置文件名
```
文件: CLAUDE.md 项目结构树部分
修改: "├── next.config.js" → "├── next.config.mjs"
```

**步骤 3**: 在目录树的 `app/api/` 部分添加缺失的 routes
```
在现有 api/ 列表中添加:
│   ├── kegg/route.ts           ← KEGG pathway database proxy
│   └── scspatial/
│       ├── ingest/route.ts     ← Single-cell spatial data ingestion
│       └── query/route.ts      ← Single-cell spatial query
```

**步骤 4**: 在 "Supporting API Routes" 表格中添加缺失条目
```markdown
| `app/api/kegg/route.ts` | Edge | KEGG pathway database CORS proxy |
| `app/api/scspatial/ingest/route.ts` | Node.js | Single-cell spatial data ingestion |
| `app/api/scspatial/query/route.ts` | Edge | Single-cell spatial data query |
```

**步骤 5**: 扩展测试章节
```
将 "__tests__/ Jest unit tests" 替换为:

├── __tests__/                        76 Jest unit test files
│   ├── workflow/                     Workflow-specific tests
│   └── *.test.ts                     Per-module tests (engines, API, utils, domain)
├── jest.config.cjs                   Jest configuration (ts-jest, jsdom)
```

**步骤 6**: 添加 Getting Started 章节（在 "Tech Stack" 之后）
```markdown
## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+

### Local Development
```bash
# 1. Clone and install
git clone https://github.com/zhangze1007/Nexus-bio-1.0.git
cd Nexus-bio-1.0
npm install

# 2. Environment variables
cp .env.example .env.local
# Edit .env.local and add your API keys:
#   GROQ_API_KEY=your-groq-key
#   GEMINI_API_KEY=your-gemini-key

# 3. Start dev server
npm run dev
# → http://localhost:3000

# 4. Run tests
npm test

# 5. Type check
npx tsc --noEmit
```

### Without API Keys
The app runs without API keys but AI features (analyze, paper search) will return 503.
All tool page simulations (FBA, kinetics, thermodynamics, etc.) work offline.
```

**步骤 7**: 添加 FORBIDDEN 文件理由说明
```markdown
### FORBIDDEN Files — Rationale

| File | Reason |
|------|--------|
| `IDETopBar.tsx` | Auto-generated by IDE scaffold system; manual edits will be overwritten |
| `IDESidebar.tsx` | Auto-generated by IDE scaffold system; manual edits will be overwritten |
| `IDEShell.tsx` | Auto-generated by IDE scaffold system; manual edits will be overwritten |
| `DBTLflowPage.tsx` | Externally reviewed and locked; changes require review protocol (see `docs/external-review-protocol.md`) |
| `GECAIRPage.tsx` | Externally reviewed and locked; changes require review protocol |
| `ProEvolPage.tsx` | Externally reviewed and locked; changes require review protocol |
```

---

## 三、P1 — 本周必须修复（质量级）

### P1-1: TypeScript `strict: false` — 类型系统形同虚设

**现状**: `tsconfig.json` 第 11-13 行：
```json
"strict": false,
"strictNullChecks": true,
"noImplicitAny": true,
```

`strict: false` 禁用了以下检查：
- `strictBindCallApply`
- `strictFunctionTypes`
- `strictPropertyInitialization`
- `noImplicitThis`
- `alwaysStrict`

**修改方案**:

**步骤 1**: 备份当前配置
```bash
cp tsconfig.json tsconfig.json.backup
```

**步骤 2**: 开启 `strictFunctionTypes`（风险最低，先开这个）
```json
// tsconfig.json
"strict": false,
"strictNullChecks": true,
"noImplicitAny": true,
"strictFunctionTypes": true,        // 新增
```

**步骤 3**: 运行类型检查，修复所有错误
```bash
npx tsc --noEmit 2>&1 | head -50
```

**步骤 4**: 逐个开启剩余选项（每次一个，修复完再开下一个）
```json
"strictBindCallApply": true,         // 第二批
"noImplicitThis": true,              // 第三批
"strictPropertyInitialization": true, // 第四批（风险最高，需要改 class 定义）
```

**步骤 5**: 最终目标 — 完全开启 strict
```json
"strict": true,
// 删除单独的 strictNullChecks、noImplicitAny（strict 已包含它们）
```

**步骤 6**: 验证
```bash
npx tsc --noEmit   # 零错误
npm test           # 所有测试通过
npm run build      # 构建成功
```

---

### P1-2: `GeneratedPathway` 接口缺字段 — NEXAIPage 用 `as any` 绕过

**现状**: `src/types.ts` 第 118-130 行的 `GeneratedPathway` 接口缺少 `bottleneck_enzymes` 和 `axon_interaction` 字段。`NEXAIPage.tsx` 在第 59、60、294 行用 `(pathway as any)` 强制访问。相关类型 `BottleneckEnzyme`、`AxonInteraction`、`AxonEnrichedResponse` 已在 `types.ts` 第 460-492 行定义。

**修改方案**:

**步骤 1**: 打开 `src/types.ts`

**步骤 2**: 找到 `GeneratedPathway` 接口（第 118 行）

**步骤 3**: 添加缺失字段
```typescript
export interface GeneratedPathway {
  project_name: string;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  risk_report?: RiskReport;
  yield_optimization_strategies?: string[];
  metadata?: Record<string, unknown>;
  // 以下两个字段是新增的
  bottleneck_enzymes?: BottleneckEnzyme[];
  axon_interaction?: AxonInteraction;
}
```

**步骤 4**: 打开 `src/components/tools/NEXAIPage.tsx`

**步骤 5**: 移除 `as any` 强制转换
```typescript
// 第 59 行: 修改前
const bottlenecks = (pathway as any).bottleneck_enzymes || [];
// 第 59 行: 修改后
const bottlenecks = pathway.bottleneck_enzymes || [];

// 第 60 行: 修改前
const axon = (pathway as any).axon_interaction;
// 第 60 行: 修改后
const axon = pathway.axon_interaction;

// 第 294 行: 修改前
const bottlenecks = (pathway as any).bottleneck_enzymes?.length ?? 0;
// 第 294 行: 修改后
const bottlenecks = pathway.bottleneck_enzymes?.length ?? 0;
```

**步骤 6**: 检查 `PaperAnalyzer.tsx` 中是否有类似问题
```bash
grep -n "as any" src/components/PaperAnalyzer.tsx
```
如果有类似 `GeneratedPathway` 的 `as any` 转换，同样修复。

**步骤 7**: 验证
```bash
npx tsc --noEmit
npm test
```

---

### P1-3: 同步 VAE 训练在主线程阻塞 UI

**现状**: `src/components/tools/MultiOPage.tsx` 第 619 行：
```typescript
const vaeResult = useMemo(() => trainMultimodalVAE(OMICS_DATA, 8, 0.5, 100, 0.005), []);
```
100 个 epoch 的 VAE 训练在主线程同步执行，会阻塞 UI 渲染。

**修改方案**:

**步骤 1**: 创建 Web Worker 文件
```
文件: src/workers/vaeWorker.ts (新建)
```
```typescript
import { trainMultimodalVAE } from '../services/MOIEngine';

self.onmessage = (e: MessageEvent) => {
  const { data, latentDim, learningRate, epochs, batchSize } = e.data;
  try {
    const result = trainMultimodalVAE(data, latentDim, learningRate, epochs, batchSize);
    self.postMessage({ type: 'success', result });
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) });
  }
};
```

**步骤 2**: 创建 Worker hook
```
文件: src/hooks/useVAEWorker.ts (新建)
```
```typescript
import { useState, useEffect, useRef } from 'react';

export function useVAEWorker(data: unknown[], latentDim = 8, lr = 0.5, epochs = 100, batchSize = 0.005) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/vaeWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === 'success') {
        setResult(e.data.result);
        setLoading(false);
      } else {
        setError(e.data.error);
        setLoading(false);
      }
    };

    worker.onerror = (e) => {
      setError(String(e));
      setLoading(false);
    };

    worker.postMessage({ data, latentDim, learningRate: lr, epochs, batchSize });

    return () => worker.terminate();
  }, [data, latentDim, lr, epochs, batchSize]);

  return { result, loading, error };
}
```

**步骤 3**: 修改 `MultiOPage.tsx`
```typescript
// 第 619 行: 修改前
const vaeResult = useMemo(() => trainMultimodalVAE(OMICS_DATA, 8, 0.5, 100, 0.005), []);

// 修改后
const { result: vaeResult, loading: vaeLoading } = useVAEWorker(OMICS_DATA, 8, 0.5, 100, 0.005);
```

**步骤 4**: 在 UI 中添加 loading 状态
```typescript
{vaeLoading ? (
  <div className="text-center py-8 text-gray-400">Training VAE model...</div>
) : (
  // 原有的 VAE 结果渲染逻辑
)}
```

**步骤 5**: 验证
```bash
npx tsc --noEmit
# 手动测试: 打开 Multi-Omics 页面，确认 VAE 训练期间 UI 不卡顿
```

---

### P1-4: API 错误格式不统一

**现状**: 5 个 API route 有 3 种错误格式：

| Route | 错误格式 |
|-------|----------|
| `analyze/route.ts` | `{ error: string }` |
| `fba/route.ts` | `{ ok: false, error: string }` |
| `alphafold/route.ts` | 纯文本字符串 |
| `pubchem/route.ts` | `{ error: string }` 或纯文本 |
| `workbench/route.ts` | `{ ok: false, error: string }` |

**修改方案**:

**步骤 1**: 创建统一响应工具
```
文件: src/utils/apiResponse.ts (新建)
```
```typescript
import { NextResponse } from 'next/server';

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json(
    { ok: false, error: message, code } satisfies ApiError,
    { status }
  );
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { ok: true, data } satisfies ApiSuccess<T>,
    { status }
  );
}
```

**步骤 2**: 逐个修改每个 route（以 `alphafold/route.ts` 为例）
```typescript
// 修改前
return new NextResponse('Not found', { status: 404 });

// 修改后
import { errorResponse } from '@/utils/apiResponse';
return errorResponse('UniProt entry not found', 404, 'NOT_FOUND');
```

**步骤 3**: 对所有 5 个 route 重复步骤 2

**步骤 4**: 更新客户端错误处理
```typescript
// 在所有 fetch 调用中统一处理
const res = await fetch('/api/xxx', options);
const json = await res.json();
if (!json.ok) {
  throw new Error(json.error);
}
```

**步骤 5**: 验证
```bash
npx tsc --noEmit
npm test
```

---

### P1-5: 无 CSP header — XSS 风险

**现状**: `next.config.mjs` 第 24-41 行的安全头包含 X-Frame-Options、X-Content-Type-Options、HSTS 等，但缺少 Content-Security-Policy。

**修改方案**:

**步骤 1**: 打开 `next.config.mjs`

**步骤 2**: 在 `headers()` 函数的安全头数组中添加 CSP
```javascript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://3Dmol.org https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.pubchem.ncbi.nlm.nih.gov https://*.ebi.ac.uk",
    "connect-src 'self' https://api.groq.com https://generativelanguage.googleapis.com https://rest.uniprot.org https://*.ebi.ac.uk",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
}
```

**步骤 3**: 验证 CSP 不破坏现有功能
- 3Dmol.js 需要 `https://3Dmol.org` 在 `script-src` 中
- PubChem 图片需要 `https://*.pubchem.ncbi.nlm.nih.gov` 在 `img-src` 中
- AlphaFold PDB 需要 `https://*.ebi.ac.uk` 在 `connect-src` 中
- Recharts 使用 inline styles，需要 `'unsafe-inline'` 在 `style-src` 中

**步骤 4**: 部署后测试
- 打开浏览器 DevTools → Console，确认无 CSP 违规
- 测试所有 14 个 tool 页面的功能

---

### P1-6: 无 `.env.example` — 新开发者不知道需要哪些环境变量

**修改方案**:

**步骤 1**: 创建 `.env.example`
```
文件: .env.example (新建)
```
```bash
# Nexus-Bio 1.0 — Environment Variables
# Copy this file to .env.local and fill in your keys

# ─────────────────────────────────────────────
# Required — AI Provider Keys
# ─────────────────────────────────────────────
# Groq API (primary) — https://console.groq.com
GROQ_API_KEY=

# Google Gemini (fallback) — https://aistudio.google.com
GEMINI_API_KEY=

# ─────────────────────────────────────────────
# Optional — Database (for persistent workbench)
# ─────────────────────────────────────────────
# Turso database URL (leave empty to use ephemeral SQLite)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# ─────────────────────────────────────────────
# Auto-set by Vercel — do not set locally
# ─────────────────────────────────────────────
# NODE_ENV=development
# VERCEL=
```

**步骤 2**: 确认 `.gitignore` 包含 `.env.local` 但不包含 `.env.example`
```bash
grep -E "\.env" .gitignore
```

**步骤 3**: 验证
```bash
git status  # .env.example 应该是 untracked
```

---

## 四、P2 — 两周内修复（工程卫生级）

### P2-1: 13 个 tool page 重复设计 token

**现状**: 每个 tool page 独立声明 `PANEL_BG`、`BORDER`、`LABEL`、`VALUE`、`INPUT_BG`、`INPUT_BORDER`、`INPUT_TEXT`、`GLASS`。全部源自 `PATHD_THEME` 但组装为本地常量。

**修改方案**:

**步骤 1**: 创建共享主题 hook
```
文件: src/hooks/useToolTheme.ts (新建)
```
```typescript
import { useMemo } from 'react';

export function useToolTheme() {
  return useMemo(() => ({
    panelBg: 'rgba(13,15,20,0.92)',
    border: 'rgba(200,216,232,0.12)',
    label: '#8899aa',
    value: '#C8D8E8',
    inputBg: 'rgba(16,19,26,0.8)',
    inputBorder: 'rgba(200,216,232,0.15)',
    inputText: '#C8D8E8',
    glass: 'rgba(200,216,232,0.05)',
  }), []);
}
```

**步骤 2**: 在每个 tool page 中替换
```typescript
// 修改前 (以 CellFreePage.tsx 为例)
const PANEL_BG = 'rgba(13,15,20,0.92)';
const BORDER = 'rgba(200,216,232,0.12)';
// ... 8 个常量

// 修改后
import { useToolTheme } from '../../hooks/useToolTheme';
const theme = useToolTheme();
// 使用 theme.panelBg, theme.border 等
```

**步骤 3**: 对所有 13 个 tool page 重复步骤 2

**步骤 4**: 验证每个页面视觉效果不变
```bash
npx tsc --noEmit
npm test
```

---

### P2-2: 巨型组件拆分（6 个 page 超过 1000 行）

**目标拆分**:

| 文件 | 当前行数 | 目标 | 拆分方式 |
|------|----------|------|----------|
| `DBTLflowPage.tsx` | 1317 | ~400 | 提取 `IterationWaterfall`、`ProtocolGenerator`、`SBOLSerializer` |
| `MultiOPage.tsx` | 1253 | ~400 | 提取 `VAEPanel`、`VolcanoPlot`、`MOFAFactors`、`UMAPEmbedding` |
| `CellFreePage.tsx` | 1169 | ~350 | 提取 `GeneConstructDesigner`、`ExpressionYieldPanel` |
| `FBASimPage.tsx` | 1128 | ~350 | 提取 `KnockoutStrategy`、`ShadowPrices`、`CarbonEfficiency` |
| `MetabolicEngPage.tsx` | 1102 | ~350 | 提取 `FluidSimCanvas`、`StressTestPanel` |
| `NEXAIPage.tsx` | 906 | ~300 | 提取 `CitationNetwork`、`SocraticPanel`、`LiteratureMap` |

**通用拆分步骤（以 MultiOPage 为例）**:

**步骤 1**: 识别子组件边界
```bash
# 找到所有 return 语句中的顶层 JSX 块
grep -n "return (" src/components/tools/MultiOPage.tsx
```

**步骤 2**: 创建子组件目录
```
mkdir -p src/components/tools/multi-o/
```

**步骤 3**: 提取第一个子组件
```
文件: src/components/tools/multi-o/VAEPanel.tsx (新建)
```
将 MultiOPage 中 VAE 相关的 state、useMemo、JSX 复制到新文件。

**步骤 4**: 在原文件中替换为子组件引用
```typescript
import { VAEPanel } from './multi-o/VAEPanel';
// 在原来的位置使用 <VAEPanel data={omicsData} />
```

**步骤 5**: 重复步骤 3-4 直到所有子组件提取完成

**步骤 6**: 验证
```bash
npx tsc --noEmit
npm test
# 手动测试: 打开页面确认功能正常
```

---

### P2-3: Store 层依赖组件层 — 架构倒置

**现状**:
- `workbenchStore.ts` 从 `components/tools/shared/workbenchConfig.ts` 导入
- `workbenchStore.ts` 从 `components/workbench/workbenchExecution.ts` 导入

**修改方案**:

**步骤 1**: 创建 domain 配置目录
```bash
mkdir -p src/config
```

**步骤 2**: 移动纯数据/函数文件
```bash
mv src/components/tools/shared/workbenchConfig.ts src/config/workbenchConfig.ts
mv src/components/tools/shared/workbenchGraph.ts src/config/workbenchGraph.ts
mv src/components/workbench/workbenchExecution.ts src/config/workbenchExecution.ts
```

**步骤 3**: 更新所有导入路径
```bash
# 找到所有引用旧路径的文件
grep -rn "from.*components/tools/shared/workbenchConfig" src/
grep -rn "from.*components/tools/shared/workbenchGraph" src/
grep -rn "from.*components/workbench/workbenchExecution" src/

# 逐个更新为新路径
# from '../../components/tools/shared/workbenchConfig'
# → from '../../config/workbenchConfig'
```

**步骤 4**: 验证依赖方向正确
```bash
# store/ 不应再从 components/ 导入
grep -rn "from.*components" src/store/
# 应该返回空结果
```

**步骤 5**: 验证
```bash
npx tsc --noEmit
npm test
```

---

### P2-4: 无 E2E 测试

**修改方案**:

**步骤 1**: 安装 Playwright
```bash
npm init playwright@latest
```

**步骤 2**: 创建第一个 E2E 测试
```
文件: e2e/homepage.spec.ts (新建)
```
```typescript
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});

test('navigate to tools', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.locator('text=Pathway Designer')).toBeVisible();
});

test('FBA simulation runs', async ({ page }) => {
  await page.goto('/tools/fbasim');
  await page.click('text=Run Simulation');
  await expect(page.locator('text=Flux')).toBeVisible({ timeout: 10000 });
});
```

**步骤 3**: 在 CI 中添加 E2E 步骤
```yaml
# .github/workflows/ci.yml 中添加
e2e:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npx playwright install --with-deps
    - run: npx playwright test
```

**步骤 4**: 验证
```bash
npx playwright test --ui   # 本地可视化运行
```

---

### P2-5: 无 bundle analysis

**修改方案**:

**步骤 1**: 安装 bundle analyzer
```bash
npm install -D @next/bundle-analyzer
```

**步骤 2**: 修改 `next.config.mjs`
```javascript
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// 在文件末尾
export default withBundleAnalyzer(withSentryConfig(nextConfig, { ... }));
```

**步骤 3**: 添加分析脚本到 `package.json`
```json
{
  "scripts": {
    "analyze": "ANALYZE=true npm run build"
  }
}
```

**步骤 4**: 运行分析
```bash
npm run analyze
```
会自动打开浏览器显示 treemap，可查看 Three.js、Recharts 等库的实际体积。

**步骤 5**: 设置体积预算（可选）
```javascript
// next.config.mjs
const nextConfig = {
  experimental: {
    optimizePackageImports: ['recharts', 'framer-motion'],
  },
};
```

---

## 五、P3 — 低优先级

### P3-1: `SemanticSearch.tsx` 和 `CellImageViewer.tsx` 中的 `any` 类型

**评估**: 这些是外部 API 响应解析，API 本身无 TypeScript 类型定义。`any` 是务实选择，可接受。如需改进，可为每个 API 定义 `interface`。

### P3-2: Recharts tooltip 组件的 `any` props

**评估**: 这是 Recharts 库的已知类型缺陷。社区 issue 尚未解决。可接受。

### P3-3: `use3Dmol.ts` 中 `viewer: any`

**评估**: 3Dmol.js 通过 CDN 加载，无 TypeScript 类型定义。可创建 `types/3dmol.d.ts` 声明文件，但优先级低。

---

## 六、CLAUDE.md 详细审计

### 评分矩阵

| # | 维度 | 评分 | 说明 |
|---|------|------|------|
| 1 | 完整性 | 7/10 | 顶层覆盖好，但 Axon 子系统、trust/policy 系统、workflow 系统完全未记录 |
| 2 | 准确性 | 6/10 | 多处过时条目（next.config.js、"13" vs 14 tools、缺 API routes） |
| 3 | 可操作性 | 7/10 | 对现有开发者强，对新人弱（无 setup 指南） |
| 4 | 架构决策记录 | 2/10 | 无 ADR。关键决策不可见 |
| 5 | 安全 | 3/10 | 仅 "don't hardcode keys"。无认证、rate limiting、输入验证文档 |
| 6 | 测试 | 4/10 | 76 个测试存在但策略未记录 |
| 7 | CI/CD | 2/10 | 无 pipeline、无分支策略、无部署文档 |
| 8 | 错误处理 | 3/10 | Error boundary 存在但模式未记录 |
| 9 | 性能 | 2/10 | 无预算、无目标、无 bundle 分析 |
| 10 | 无障碍 | 1/10 | 基本不存在 |
| 11 | 国际化 | 1/10 | 未提及 |
| 12 | 依赖管理 | 2/10 | 无更新策略、无审计流程 |
| 13 | 贡献指南 | 1/10 | 无 CONTRIBUTING.md |
| 14 | 许可证 | 8/10 | MIT 存在，未在 CLAUDE.md 中引用 |

### 缺失的关键章节

1. **Getting Started** — 无 `npm install` / `npm run dev` 指南
2. **Axon 子系统** — `src/services/` 中 38 个文件的编排框架零文档
3. **Trust/Policy 系统** — `trustPolicyEngine.ts`、`policyDslEvaluator.ts` 等未记录
4. **Workflow 系统** — `workflowStateMachine.ts`、`workflowRegistry.ts` 等未记录
5. **Security 章节** — 无认证、rate limiting、CORS、SSRF 防护文档
6. **Testing 章节** — 无测试策略、覆盖率目标、运行方式
7. **Architecture Decision Records** — 无 ADR

---

## 七、Skill 生态详细审计

### 现状：仅 2 个 skill

| Skill | 路径 | 类型 | 状态 |
|-------|------|------|------|
| `/nexus-bio-viz` | `.claude/commands/nexus-bio-viz.md` | Slash command | 🟡 可用但有缺陷 |
| `nexus-bio-audit` | `.claude/workflows/nexus-bio-audit.js` | Workflow | 🔴 可能无法执行 |

### `/nexus-bio-viz` 详细审计

| 维度 | 评分 | 问题 |
|------|------|------|
| 清晰度 | 8/10 | 结构良好，步骤明确 |
| 范围 | 8/10 | 专注可视化升级，范围合适 |
| 可复用性 | 6/10 | 仅对可视化工作有用 |
| 参数化 | 4/10 | `[ToolName]` 无校验、无有效值列表、无默认行为 |
| 错误处理 | 3/10 | 无文件不存在处理、无 tsc 失败策略、无回滚指导 |
| 集成度 | 9/10 | 引用正确的文件路径和模式 |

**具体修复**:

**步骤 1**: 添加参数校验
```markdown
## Parameters
- `ToolName` (required): One of:
  `ScSpatial`, `MultiO`, `FBASim`, `ProEvol`, `GECAIR`, `GenMIM`,
  `NEXAI`, `DBTLflow`, `DynCon`, `CETHX`, `CellFree`, `CATDES`

## Guard Step
Before proceeding, verify:
1. `src/components/tools/${ToolName}Page.tsx` exists
2. `ToolName` is not in the FORBIDDEN list (DBTLflow, GECAIR, ProEvol)
```

**步骤 2**: 添加错误处理
```markdown
## Error Recovery
If `npx tsc --noEmit` fails after your changes:
1. Read the error message carefully
2. If the error is in your changes, fix the type error
3. If the error is pre-existing, revert your changes and report
4. Never commit changes that break type checking
```

### `nexus-bio-audit.js` 详细审计

| 维度 | 评分 | 问题 |
|------|------|------|
| 清晰度 | 7/10 | 冗长但具体 |
| 范围 | 6/10 | 5 个 phase 太多，单个 phase 本身就够一个完整审计 |
| 可复用性 | 5/10 | 硬编码为 Nexus-Bio 路径 |
| 参数化 | 2/10 | 无参数，无法选择只审计安全或只审计 API |
| 错误处理 | 3/10 | phase 间无错误处理 |
| 集成度 | 7/10 | 引用正确但有过时引用 |

**关键问题**: 使用 `phase()` / `agent()` DSL — 这不是标准 Claude Code API，可能无法执行。

**修复**: 转换为标准 `.md` slash command 格式，或验证 DSL 是否在当前版本中可用。

### 缺失的 skill 清单

| 缺失 Skill | 优先级 | 文件路径 | 用途 |
|------------|--------|----------|------|
| `/nexus-bio-test` | 🔴 Critical | `.claude/commands/nexus-bio-test.md` | 运行测试、覆盖率、生成测试模板 |
| `/nexus-bio-deploy` | 🔴 Critical | `.claude/commands/nexus-bio-deploy.md` | 部署前检查、环境验证、rollback |
| `/nexus-bio-review` | 🟡 High | `.claude/commands/nexus-bio-review.md` | 代码审查 checklist |
| `/nexus-bio-tool` | 🟡 High | `.claude/commands/nexus-bio-tool.md` | 脚手架：新 tool page |
| `/nexus-bio-api` | 🟡 High | `.claude/commands/nexus-bio-api.md` | 脚手架：新 API route |
| `/nexus-bio-security` | 🟢 Medium | `.claude/commands/nexus-bio-security.md` | 快速安全扫描 |
| `/nexus-bio-perf` | 🟢 Medium | `.claude/commands/nexus-bio-perf.md` | Bundle 分析 + 性能分析 |
| `/nexus-bio-migrate` | 🟢 Low | `.claude/commands/nexus-bio-migrate.md` | 数据库迁移辅助 |

### 缺失的基础设施

| 文件 | 状态 | 用途 |
|------|------|------|
| `.claude/settings.json` | ❌ 不存在 | 项目级 Claude 配置（模型、权限、工具） |
| `CONTRIBUTING.md` | ❌ 不存在 | 贡献指南（commit 规范、PR 流程、代码风格） |
| `.env.example` | ❌ 不存在 | 环境变量模板 |

---

## 八、代码架构详细审计

### 8.1 关注点分离 — 评分: 7/10

**做得好的**:
- 模拟引擎正确提取到 `src/services/`
- FBA 引擎在 `src/server/fbaEngine.ts`，通过 API route 调用
- 工具页面通过 service 层客户端调用 API

**违规**:
- `NEXAIPage.tsx` 第 57-96 行的 `pathwayToResult()` 是 40 行数据转换函数，应提取到 `src/utils/`
- `NEXAIPage.tsx` 第 259 行直接 `fetch('/api/analyze')` 而非通过 service 层
- 13 个 tool page 重复声明设计 token

### 8.2 状态管理 — 评分: 8/10

**Zustand vs XState 边界清晰**:
- `uiStore` — 临时 UI 状态（选择、面板、遥测）
- `workbenchStore` — 持久项目状态（证据、工具负载、工作流控制）
- XState machines — 有限状态转换（idle/simulating/stress_test/equilibrium）

**无状态重复** — `metabolicMachine` 拥有模拟参数，`workbenchStore` 拥有工具负载，正交。

**类型安全漏洞**:
- `src/store/workbenchStore.ts:1069` — `undefined as any`

### 8.3 API 层 — 评分: 6/10

**Runtime 选择正确**:
- Edge: analyze, alphafold, pubchem（简单代理）
- Node.js: fba（LP 求解器）、workbench（better-sqlite3）

**错误格式不统一** — 详见 P1-4

**输入验证好但不一致**:
- analyze: `sanitizePromptInput()`、rate limiting、CSRF
- workbench: origin check、body size limit
- alphafold: UniProt regex
- pubchem: CID 数值校验
- fba: `asNumber()`/`asObjective()`/`asSpecies()` 辅助函数（本地，未共享）

### 8.4 组件架构 — 评分: 7/10

**共享组件提取合理**: ToolShell、MetricCard、WorkbenchRangeSlider 等

**巨型组件**: 6 个 page 超过 1000 行 — 详见 P2-2

**FORBIDDEN 文件真正隔离**: 无交叉引用，验证通过

### 8.5 类型安全 — 评分: 5/10

**tsconfig**: `strict: false`，仅开启 `strictNullChecks` + `noImplicitAny`

**`any` 泄漏统计**:

| 文件 | `any` 数量 | 原因 |
|------|-----------|------|
| `workbenchStore.ts` | 1 | `undefined as any` 类型 hack |
| `NEXAIPage.tsx` | 3 | `GeneratedPathway` 接口缺字段 |
| `SemanticSearch.tsx` | 8 | 外部 API 响应无类型 |
| `PaperAnalyzer.tsx` | 4 | 外部 API 响应无类型 |
| `CellImageViewer.tsx` | 2 | 外部 API 响应无类型 |
| Recharts tooltips | 9 | 库的已知类型缺陷 |

### 8.6 代码重复 — 评分: 5/10

**重复模式**:
1. 设计 token — 13 个文件重复声明
2. `SectionLabel` 组件 — 5+ 个文件重新实现
3. `GridLines` SVG 组件 — 3 个文件重新实现
4. `ParamSlider` 包装器 — 4 个文件重新实现
5. Workbench payload sync useEffect — 每个 tool page 都有

### 8.7 依赖图 — 评分: 8/10

**无循环依赖** — 验证通过

**一个关注点**: `workbenchStore` 从 `components/tools/shared/` 和 `components/workbench/` 导入，形成 store → component 依赖。详见 P2-3。

### 8.8 性能反模式 — 评分: 7/10

**做得好的**:
- MultiOPage 有 11 个 `useMemo` 钩子
- workbench store 使用 `subscribeWithSelector` 中间件
- localStorage 持久化有 500ms 防抖

**问题**:
1. 同步 VAE 训练阻塞主线程 — 详见 P1-3
2. 所有 tool page 静态导入，无代码分割
3. `analyze/route.ts` 内存 rate limiter 在 Edge Runtime 中不可靠

---

## 九、DevOps 基础设施详细审计

### 评分矩阵

| 区域 | 评分 | 关键缺口 |
|------|------|----------|
| CI/CD Pipeline | **2/10** | 完全不存在 |
| 环境管理 | **3/10** | 无 .env.example、无环境区分 |
| 监控与可观测性 | **1/10** | 无日志、无错误追踪、无健康检查 |
| 数据库运维 | **3/10** | 临时 SQLite、无迁移、无备份 |
| 安全基础设施 | **6/10** | 头部和输入验证好；缺 CSP、认证、持久 rate limiting |
| 测试基础设施 | **7/10** | 强 unit test；缺 E2E、coverage 配置、CI 集成 |
| 构建与打包 | **5/10** | 基础优化有；无 bundle 分析或监控 |
| 文档 | **6/10** | README 和项目文档好；缺 API docs、runbook、架构图 |

### 详细发现

**CI/CD (2/10)**:
- `.github/workflows/` 不存在
- 无分支保护策略
- `vercel.json` 极简
- 无预部署检查
- 部署完全手动

**监控 (1/10)**:
- 仅 3 处 `console.log` 在整个 API 目录
- 无 Sentry/Datadog/LogRocket
- 无 `/api/health`
- 无告警机制
- Edge 超时硬编码无观测

**数据库 (3/10)**:
- SQLite 冷启动丢失（`workbenchDb.ts` 第 1-17 行明确记录）
- 无版本化迁移系统
- 无备份策略
- ✅ WAL 模式、外键、事务包装、索引 — 做得好

**安全 (6/10)**:
- ✅ 安全头部（X-Frame-Options、HSTS、nosniff）
- ✅ CORS 白名单（`src/utils/cors.ts`）
- ✅ Rate limiting（10 req/min per IP）
- ✅ 输入清理（`sanitizePromptInput()`）
- ✅ CSRF 防护（content-type 要求）
- ❌ 无 CSP header
- ❌ 无 `middleware.ts`
- ❌ 无认证（actor ID 是客户端提供的字符串）
- ❌ 内存 rate limiter 冷启动重置
- ❌ FBA route 无 rate limiting

**测试 (7/10)**:
- 76 个测试文件
- Jest 30 + ts-jest + jsdom
- ✅ 覆盖安全函数、引擎正确性、边界
- ❌ 无 E2E 测试
- ❌ 无 coverage 配置
- ❌ 无 CI 集成

---

## 十、推荐项目团队结构

基于以上分析，如果要把 Nexus-Bio 提升到硅谷企业级，需要以下角色：

| 角色 | 职责 | 对应问题 | 优先级 |
|------|------|----------|--------|
| **🏗 Platform Engineer** | CI/CD pipeline、GitHub Actions、Vercel 配置、环境管理 | P0-1, P0-4 | 🔴 立即 |
| **🔒 Security Engineer** | CSP、认证系统、rate limiting 升级、SSRF 防护、依赖审计 | P1-5, P1-6 | 🔴 本周 |
| **📊 SRE / Observability** | Sentry 集成、结构化日志、health check、告警 | P0-2 | 🔴 立即 |
| **🗄 Data Engineer** | SQLite → Turso 迁移、备份策略、数据持久化 | P0-3 | 🔴 立即 |
| **📝 Technical Writer** | CLAUDE.md 修正 + 扩展、ADR、CONTRIBUTING.md、API docs | P0-4, 全部文档 | 🔴 本周 |
| **🧪 QA Engineer** | E2E 测试（Playwright）、coverage 配置、CI 集成 | P2-4 | 🟡 两周内 |
| **⚡ Frontend Architect** | TypeScript strict mode、巨型组件拆分、代码去重、Web Worker | P1-1, P1-2, P1-3, P2-1, P2-2 | 🟡 本周 |
| **🎨 Design System Engineer** | 统一设计 token、提取共享组件、主题系统 | P2-1 | 🟢 两周内 |
| **🤖 DevX Engineer** | 创建全部缺失的 skill、.claude/settings.json、脚手架工具 | Skill 生态 | 🟢 两周内 |

---

## 十一、完整修改路线图

### 第 1 周: 阻塞级修复

| 天 | 任务 | 负责角色 | 产出 |
|----|------|----------|------|
| Day 1 | 创建 `.github/workflows/ci.yml` | Platform Engineer | CI pipeline |
| Day 1 | 创建 `.env.example` | Platform Engineer | 环境模板 |
| Day 1 | 修复 CLAUDE.md 事实性错误 | Technical Writer | 准确的文档 |
| Day 2 | 集成 Sentry | SRE | 错误追踪 |
| Day 2 | 创建 `/api/health` 端点 | SRE | 健康检查 |
| Day 3 | 修复 `GeneratedPathway` 接口 | Frontend Architect | 消除 `as any` |
| Day 3 | 开启 `strictFunctionTypes` | Frontend Architect | 类型安全 +1 |
| Day 4 | VAE 训练迁移到 Web Worker | Frontend Architect | UI 不卡顿 |
| Day 4 | 创建统一 API 响应工具 | Frontend Architect | 错误格式统一 |
| Day 5 | 添加 CSP header | Security Engineer | XSS 防护 |
| Day 5 | SQLite 双写 localStorage | Data Engineer | 数据不丢 |

### 第 2 周: 质量级修复

| 天 | 任务 | 负责角色 | 产出 |
|----|------|----------|------|
| Day 6 | 提取共享设计 token hook | Design System Engineer | 代码去重 |
| Day 6 | 拆分 MultiOPage 和 FBASimPage | Frontend Architect | 组件减半 |
| Day 7 | 拆分 CellFreePage 和 NEXAIPage | Frontend Architect | 组件减半 |
| Day 7 | 移动 workbenchConfig 到 src/config | Frontend Architect | 架构修正 |
| Day 8 | 创建 CONTRIBUTING.md | Technical Writer | 贡献指南 |
| Day 8 | 添加 ADR 模板 + 前 3 个 ADR | Technical Writer | 决策记录 |
| Day 9 | 安装 Playwright + 首批 E2E 测试 | QA Engineer | E2E 覆盖 |
| Day 9 | 安装 bundle analyzer | Frontend Architect | 体积监控 |
| Day 10 | 开启更多 TS strict 选项 | Frontend Architect | 类型安全 +2 |

### 第 3-4 周: 工程卫生级

| 周 | 任务 | 负责角色 | 产出 |
|----|------|----------|------|
| Week 3 | 创建 6 个缺失的 skill | DevX Engineer | Skill 生态 |
| Week 3 | 创建 `.claude/settings.json` | DevX Engineer | 项目配置 |
| Week 3 | 扩展 E2E 测试覆盖 | QA Engineer | 全流程覆盖 |
| Week 4 | SQLite → Turso 迁移 | Data Engineer | 持久化数据库 |
| Week 4 | 拆分剩余巨型组件 | Frontend Architect | 所有 page < 500 行 |
| Week 4 | 完全开启 `strict: true` | Frontend Architect | 完整类型安全 |

---

> **报告生成**: 2026-06-06 by Claude Code Audit Team
> **验证方法**: 4 个独立 agent 并行审计 + 1 个验证 agent 交叉核验所有文件引用
> **下一步**: 选择一个 P0 任务开始执行，或使用 `/nexus-bio-deploy` skill 检查部署就绪状态
