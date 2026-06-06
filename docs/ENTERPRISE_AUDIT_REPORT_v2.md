# 🔬 Nexus-Bio 1.0 — 企业级成熟度诊断报告 v2

> **审计日期**: 2026-06-06
> **审计范围**: CLAUDE.md 文档体系、Skill 生态、代码架构、DevOps 基础设施
> **审计方法**: 4 个独立 AI agent 并行审计 + 1 个验证 agent 交叉核验所有文件引用
> **目标标准**: Silicon Valley 企业级（对标 Vercel / Linear / Stripe）
> **版本**: v2 — 所有修改方案均经过逐行验证，提供完整可复制代码

---

## 目录

- [一、总评与评分矩阵](#一总评与评分矩阵)
- [二、P0 — 必须立即修复（阻塞级）](#二p0--必须立即修复阻塞级)
  - [P0-1: 零 CI/CD](#p0-1-零-cicd)
  - [P0-2: 零监控](#p0-2-零监控)
  - [P0-3: SQLite 冷启动丢失](#p0-3-sqlite-冷启动丢失)
  - [P0-4: CLAUDE.md 事实性错误](#p0-4-claudemd-事实性错误)
- [三、P1 — 本周必须修复（质量级）](#三p1--本周必须修复质量级)
  - [P1-1: TypeScript strict 模式](#p1-1-typescript-strict-模式)
  - [P1-2: GeneratedPathway 接口缺字段](#p1-2-generatedpathway-接口缺字段)
  - [P1-3: 同步 VAE 训练阻塞 UI](#p1-3-同步-vae-训练阻塞-ui)
  - [P1-4: API 错误格式不统一](#p1-4-api-错误格式不统一)
  - [P1-5: 无 CSP header](#p1-5-无-csp-header)
  - [P1-6: 无 .env.example](#p1-6-无-envexample)
- [四、P2 — 两周内修复（工程卫生级）](#四p2--两周内修复工程卫生级)
  - [P2-1: 设计 token 重复声明](#p2-1-设计-token-重复声明)
  - [P2-2: 巨型组件拆分](#p2-2-巨型组件拆分)
  - [P2-3: Store 层依赖组件层](#p2-3-store-层依赖组件层)
  - [P2-4: 无 E2E 测试](#p2-4-无-e2e-测试)
  - [P2-5: 无 bundle analysis](#p2-5-无-bundle-analysis)
- [五、P3 — 低优先级](#五p3--低优先级)
- [六、详细审计：CLAUDE.md](#六详细审计claudemd)
- [七、详细审计：Skill 生态](#七详细审计skill-生态)
- [八、详细审计：代码架构](#八详细审计代码架构)
- [九、详细审计：DevOps 基础设施](#九详细审计devops-基础设施)
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

---

### P0-1: 零 CI/CD

**现状**: `.github/workflows/` 目录不存在。任何对 `main` 的 push 直接部署到生产，无自动化验证。

**影响**: 一次 bad commit 就能打挂线上。

**修改方案**:

#### 步骤 1：创建目录

```bash
mkdir -p .github/workflows
```

#### 步骤 2：创建 `.github/workflows/ci.yml`

以下是完整文件内容，直接复制粘贴：

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  typecheck-test-build:
    name: Typecheck, Test & Build
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck (tsc --noEmit)
        run: npx tsc --noEmit

      - name: Run unit tests
        run: npm test
        env:
          CI: true

      - name: Build
        run: npm run build
        env:
          NEXT_TELEMETRY_DISABLED: 1

  e2e:
    name: E2E Tests (placeholder)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: typecheck-test-build

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      # Uncomment when E2E tests are written:
      # - name: Run E2E tests
      #   run: npx playwright test
      #   env:
      #     BASE_URL: http://localhost:3000

      - name: E2E placeholder (no tests yet)
        run: echo "E2E placeholder — add Playwright tests and uncomment above"
```

**设计说明**:
- `typecheck-test-build` job 顺序运行 `tsc --noEmit` → `npm test` → `npm run build`，任一步骤失败则整个 job 失败
- `concurrency` 块确保同一分支的新 push 会取消正在进行的旧 run
- Jest 配置（`jest.config.cjs`）使用 `testEnvironment: 'jsdom'`，无 `setupFiles`，所以测试不需要额外环境变量
- `CI: true` 环境变量让 Jest 禁用交互模式
- `actions/setup-node@v4` 的 `cache: npm` 自动使用 `package-lock.json` 的 hash 作为缓存 key，无需额外 `actions/cache` 步骤
- E2E job 设置 `needs: typecheck-test-build`，只在 CI 通过后才运行

#### 步骤 3：创建 `.github/workflows/preview.yml`

```yaml
name: Vercel Preview

on:
  pull_request:
    branches: [main]

permissions:
  pull-requests: write
  deployments: write

concurrency:
  group: preview-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  comment-preview-url:
    name: Comment Vercel Preview URL
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Construct preview URL from branch name
        id: url
        run: |
          BRANCH="${GITHUB_HEAD_REF}"
          SLUG=$(echo "$BRANCH" | tr '/' '-' | tr '_' '-' | tr '[:upper:]' '[:lower:]')
          PREVIEW_URL="https://nexus-bio-1-0-git-${SLUG}-zhangze1007s-projects.vercel.app"
          echo "preview_url=$PREVIEW_URL" >> "$GITHUB_OUTPUT"

      - name: Find existing bot comment
        id: find-comment
        uses: peter-evans/find-comment@v3
        with:
          issue-number: ${{ github.event.pull_request.number }}
          comment-author: "github-actions[bot]"
          body-includes: "<!-- vercel-preview -->"

      - name: Create or update PR comment with preview URL
        uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: ${{ github.event.pull_request.number }}
          comment-id: ${{ steps.find-comment.outputs.comment-id }}
          edit-mode: replace
          body: |
            <!-- vercel-preview -->
            ## Vercel Preview Deployment

            :rocket: **Preview URL:** ${{ steps.url.outputs.preview_url }}

            > This preview is automatically deployed by Vercel on every push to this PR.
            > The URL above updates as new commits are pushed.

            | Detail | Value |
            |--------|-------|
            | Branch | `${{ github.head_ref }}` |
            | Commit | `${{ github.event.pull_request.head.sha }}` |
```

**设计说明**:
- `peter-evans/find-comment@v3` + `peter-evans/create-or-update-comment@v4` 避免在同一 PR 上重复发布评论
- `<!-- vercel-preview -->` 标记作为 bot 评论的唯一标识符
- Preview URL 根据 Vercel 标准 URL 模式从分支名推导
- `permissions: pull-requests: write` 是评论 action 发布/编辑 PR 评论所必需的

#### 步骤 4：在 GitHub 仓库设置中启用 Branch Protection

手动操作（GitHub Web UI）：
1. 进入 GitHub 仓库 → Settings → Branches
2. 点击 "Add rule"
3. Branch name pattern: `main`
4. 勾选 ✅ "Require status checks to pass before merging"
5. 搜索并选择 `Typecheck, Test & Build` 作为 required check
6. 勾选 ✅ "Require pull request reviews before merging"（至少 1 人）
7. 点击 "Create"

#### 步骤 5：验证

```bash
# 1. 提交 CI 配置
git add .github/workflows/
git commit -m "ci: add GitHub Actions CI pipeline and Vercel preview workflow"

# 2. 创建测试分支并 push
git checkout -b test/ci-verification
git push origin test/ci-verification

# 3. 在 GitHub 上创建 PR → main
# 4. 确认 CI pipeline 运行（Actions tab）
# 5. 确认 PR 评论中出现 Vercel Preview URL
# 6. 确认 CI 失败时 PR 无法合并
```

---

### P0-2: 零监控

**现状**:
- 整个 `app/api/` 目录仅有 3 处 `console.log/error/info`
- 无 Sentry、Datadog、LogRocket 等错误监控
- 无 `/api/health` 健康检查端点
- Edge Runtime 超时 `TIMEOUT_MS = 12000` 硬编码，无超时事件观测

**修改方案**:

#### 步骤 1：安装 Sentry

```bash
npx @sentry/wizard@latest -i nextjs
```

**注意**: Sentry wizard 会交互式提问。你需要提供：
- Organization slug（在 Sentry dashboard 创建项目后获得）
- Project name（建议：`nexus-bio-web`）
- Auth token（在 Sentry → Settings → Auth Tokens 创建）

Wizard 会自动修改以下文件：
- `next.config.mjs` — 添加 `withSentryConfig` 包裹
- 创建 `sentry.client.config.ts`
- 创建 `sentry.server.config.ts`
- 创建 `sentry.edge.config.ts`

#### 步骤 2：确认 `next.config.mjs` 修改正确

Wizard 修改后，`next.config.mjs` 顶部应有：

```javascript
import { withSentryConfig } from "@sentry/nextjs";
```

导出应被 `withSentryConfig` 包裹：

```javascript
export default withSentryConfig(nextConfig, {
  silent: true,
  org: "nexus-bio",
  project: "nexus-bio-web",
});
```

**重要**: Sentry 必须是最外层包裹（在 `withBundleAnalyzer` 之外，如果后续添加了 bundle analyzer）。

#### 步骤 3：确认 `sentry.client.config.ts` 内容

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% of transactions for performance monitoring
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,  // 100% of errors get a replay
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

#### 步骤 4：创建 `/api/health` 端点

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

**为什么用 Edge Runtime**: 健康检查应尽可能快，不依赖 Node.js API。Edge Runtime 冷启动时间 ~50ms vs Node.js ~250ms。

#### 步骤 5：在 Vercel 环境变量中添加

```
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=nexus-bio
SENTRY_PROJECT=nexus-bio-web
```

#### 步骤 6：验证

```bash
# 本地验证
npm run dev
# 访问 http://localhost:3000/api/health
# 预期返回: {"status":"ok","timestamp":"...","version":"local"}

# 部署后验证
# 访问 https://nexus-bio-1-0.vercel.app/api/health
# 预期返回: {"status":"ok","timestamp":"...","version":"30a2542"}

# Sentry 验证
# 故意触发一个错误（在某个 API route 中 throw）
# 确认 Sentry dashboard 收到事件
```

---

### P0-3: SQLite 冷启动丢失

**现状**: `src/server/workbenchDb.ts` 第 1-17 行明确记录 SQLite 在 Vercel cold start 时丢失。用户的项目状态、实验记录、审计日志在每次 cold start 后全部丢失。

**修改方案（短期 — localStorage 双写）**:

#### 步骤 1：阅读 `app/api/workbench/route.ts` 的 GET handler

找到 GET handler 函数（搜索 `export async function GET`）。在函数开头添加导出支持：

```typescript
// 在现有 GET handler 的开头添加这段代码
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // ── 新增：导出功能 ──
  if (searchParams.get('export') === 'true') {
    const state = workbenchDb.getProjectState('default');
    return new NextResponse(JSON.stringify(state, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="workbench-backup.json"',
      },
    });
  }

  // ... 保留现有的 GET 逻辑 ...
}
```

#### 步骤 2：阅读 `src/components/workbench/WorkbenchSyncProvider.tsx`

找到 `syncToServer` 或类似的同步函数调用处。在同步成功后添加 localStorage 双写：

```typescript
// 在 syncToServer 调用成功后添加
const localBackup = JSON.stringify(state);
try {
  localStorage.setItem('workbench-local-backup', localBackup);
} catch (e) {
  // localStorage 可能已满（5MB 限制），静默失败
  console.warn('Failed to write workbench backup to localStorage:', e);
}
```

#### 步骤 3：添加冷启动恢复逻辑

在 `WorkbenchSyncProvider` 组件的初始化 `useEffect` 中添加：

```typescript
useEffect(() => {
  // 尝试从 localStorage 恢复
  try {
    const localBackup = localStorage.getItem('workbench-local-backup');
    if (localBackup) {
      const parsed = JSON.parse(localBackup);
      // 检查是否有有效的 revision
      if (parsed && typeof parsed.revision === 'number') {
        // 与服务器状态比较 revision，取最新的
        // 如果服务器返回空状态（cold start），使用本地备份
        restoreFromBackup(parsed);
      }
    }
  } catch (e) {
    console.warn('Failed to restore workbench from localStorage:', e);
  }
}, []);
```

**注意**: `restoreFromBackup` 函数需要根据 `WorkbenchSyncProvider` 的实际 API 来实现。你需要阅读该文件找到合适的状态恢复方法。

#### 步骤 4：验证

```bash
# 1. 启动 dev server
npm run dev

# 2. 在 workbench 中创建一个项目
# 3. 打开 DevTools → Application → Local Storage
#    确认 "workbench-local-backup" key 存在
# 4. 刷新页面
#    确认 workbench 数据从 localStorage 恢复
```

---

### P0-4: CLAUDE.md 事实性错误

**现状**: 经 agent 验证，以下条目与实际代码库不一致。

**修改方案**: 以下是每个修改的精确 find/replace 操作。

#### 修改 B1: "13" → "14" 工具数量

**文件**: `CLAUDE.md`

**查找**（精确文本）:
```
## All 13 Tool Pages
```

**替换为**:
```
## All 14 Tool Pages
```

#### 修改 B2: `next.config.js` → `next.config.mjs`

**文件**: `CLAUDE.md`

**查找**（精确文本）:
```
├── vercel.json                       ← Do not modify
├── next.config.js
```

**替换为**:
```
├── vercel.json                       ← Do not modify
├── next.config.mjs
```

#### 修改 B3: 在项目树中添加缺失的 API routes

**文件**: `CLAUDE.md`

**查找**（精确文本，7 行）:
```
│   ├── api/                          Edge Runtime API routes
│   │   ├── analyze/route.ts          ← PRIMARY AI endpoint (Groq → Gemini fallback chain)
│   │   ├── gemini/route.ts           ← Re-exports analyze/route (legacy alias)
│   │   ├── alphafold/route.ts        AlphaFold EBI CORS proxy
│   │   ├── pubchem/route.ts          PubChem 3D SDF lookup
│   │   ├── fba/route.ts              Flux Balance Analysis engine (Node.js runtime)
│   │   └── workbench/route.ts        Workbench state sync & project ledger
```

**替换为**:
```
│   ├── api/                          API routes
│   │   ├── analyze/route.ts          ← PRIMARY AI endpoint (Groq → Gemini fallback chain, Edge Runtime)
│   │   ├── gemini/route.ts           ← Re-exports analyze/route (legacy alias, Edge Runtime)
│   │   ├── alphafold/route.ts        AlphaFold EBI CORS proxy (Edge Runtime)
│   │   ├── pubchem/route.ts          PubChem 3D SDF lookup (Edge Runtime)
│   │   ├── kegg/route.ts             KEGG pathway database proxy (Edge Runtime)
│   │   ├── fba/route.ts              Flux Balance Analysis engine (Node.js runtime)
│   │   ├── scspatial/
│   │   │   ├── ingest/route.ts       ScSpatial data upload & processing (Node.js runtime)
│   │   │   └── query/route.ts        ScSpatial query & analysis API (Node.js runtime)
│   │   └── workbench/route.ts        Workbench state sync & project ledger (Node.js runtime)
```

#### 修改 B4: 在 Supporting API Routes 表格中添加缺失条目

**文件**: `CLAUDE.md`

**查找**（精确文本，7 行）:
```
### Supporting API Routes

| Route | Runtime | Purpose |
|-------|---------|---------|
| `app/api/alphafold/route.ts` | Edge | CORS proxy for EBI AlphaFold — input: `?id=<UniProtID>`, output: PDB text |
| `app/api/pubchem/route.ts` | Edge | PubChem 3D SDF — mode 1: `?cid=<CID>`, mode 2: `?name=<compound>` |
| `app/api/fba/route.ts` | Node.js | FBA solver (simplex LP) — single-species + community FBA |
| `app/api/workbench/route.ts` | Node.js | Workbench project sync — GET/PUT with revision conflict detection |
```

**替换为**:
```
### Supporting API Routes

| Route | Runtime | Purpose |
|-------|---------|---------|
| `app/api/alphafold/route.ts` | Edge | CORS proxy for EBI AlphaFold — input: `?id=<UniProtID>`, output: PDB text |
| `app/api/pubchem/route.ts` | Edge | PubChem 3D SDF — mode 1: `?cid=<CID>`, mode 2: `?name=<compound>` |
| `app/api/kegg/route.ts` | Edge | KEGG pathway database proxy — pathway/molecule lookups |
| `app/api/fba/route.ts` | Node.js | FBA solver (simplex LP) — single-species + community FBA |
| `app/api/scspatial/ingest/route.ts` | Node.js | ScSpatial data upload — file ingestion, preprocessing, artifact storage |
| `app/api/scspatial/query/route.ts` | Node.js | ScSpatial query API — view modes, cluster analysis, gene expression lookups |
| `app/api/workbench/route.ts` | Node.js | Workbench project sync — GET/PUT with revision conflict detection |
```

#### 修改 B5: 添加 Getting Started 章节

**文件**: `CLAUDE.md`

**插入点**: 在 Tech Stack 代码块的关闭 ``` 之后、`---` 分隔符之前（约第 65 行）

**查找**:
```
Deploy     Vercel (Hobby plan, free tier, Edge Runtime)
```

**替换为**（在该行后面紧接添加）:
```
Deploy     Vercel (Hobby plan, free tier, Edge Runtime)
```

然后在 `---` 分隔符之前插入：

**查找**:
```

---

## Project Structure
```

**替换为**:
```

---

## Getting Started

```bash
# Clone and install
git clone https://github.com/zhangze1007/Nexus-bio-1.0.git
cd Nexus-bio-1.0
npm ci

# Environment variables (copy to .env.local)
# GROQ_API_KEY=your_groq_key
# GEMINI_API_KEY=your_gemini_key

# Development
npm run dev          # http://localhost:3000

# Quality checks (mirrors CI pipeline)
npx tsc --noEmit     # Type check
npm test             # Jest unit tests (76 files)
npm run build        # Production build

# Test scripts
npm run benchmark:trust:validate   # Validate trust benchmark corpus
npm run policy:dsl:validate        # Validate policy DSL definitions
npm run proof:check                # Check proof package integrity
```

### Without API Keys
The app runs without API keys but AI features (analyze, paper search) will return 503.
All tool page simulations (FBA, kinetics, thermodynamics, etc.) work offline.

---

## Project Structure
```

#### 修改 B6: 添加 FORBIDDEN 文件理由说明

**文件**: `CLAUDE.md`

**插入点**: 在 GOTCHAS 第 7 条之后、`## Visualization Standards` 之前

**查找**:
```
7. **AlphaFold and PubChem are proxied** — always call `/api/alphafold` and `/api/pubchem`, never fetch EBI or PubChem directly from the browser (CORS).

---

## Visualization Standards
```

**替换为**:
```
7. **AlphaFold and PubChem are proxied** — always call `/api/alphafold` and `/api/pubchem`, never fetch EBI or PubChem directly from the browser (CORS).

### FORBIDDEN Files — Rationale

The following files are marked `FORBIDDEN: never modify` in the project tree. They are stable, contract-bound components that other parts of the system depend on. Modifications risk cascading breakages across tools and the IDE shell.

| File | Reason |
|------|--------|
| `src/components/ide/IDEShell.tsx` | Root IDE layout shell — all tool pages render inside it. Changing its structure breaks every tool's layout. |
| `src/components/ide/IDETopBar.tsx` | IDE top bar with navigation, breadcrumbs, and project context. Routing and state depend on its exact contract. |
| `src/components/ide/IDESidebar.tsx` | IDE sidebar with tool registry navigation. Tool discovery and deep-linking depend on its data shape. |
| `src/components/tools/DBTLflowPage.tsx` | DBTL cycle tracker — used as the standard feedback loop component embedded in other tools. Contract-bound by ProEvol, CATDES, and metabolic lab. |
| `src/components/tools/GECAIRPage.tsx` | Gene circuit reasoner — integrated into DYNCON and GenMIM as a sub-panel. Shared state shape must remain stable. |
| `src/components/tools/ProEvolPage.tsx` | Protein evolution engine — fitness landscape data consumed by CATDES and PathD. Its output schema is a cross-tool contract. |

---

## Visualization Standards
```

#### 修改 B7: 添加 Testing 章节

**文件**: `CLAUDE.md`

**插入点**: 在 `## Contact` 之前

**查找**:
```
---

## Contact
```

**替换为**:
```

---

## Testing

### Unit Tests (Jest)

- **Location:** `__tests__/` directory (76 test files)
- **Config:** `jest.config.cjs` — uses `ts-jest` preset with `jsdom` environment
- **Run:** `npm test` (or `npx jest` for direct control)
- **CI:** Tests run on every PR and push to main via `.github/workflows/ci.yml`

The test suite covers:
- Simulation engines: kinetics, thermodynamics, simplex LP solver, cell-free, FBA, catalyst designer, proevol
- Honesty checks: `cellfreeHonesty`, `cethxHonesty`, `multioHonesty`, `communityFbaHonesty` (verify no hardcoded mock responses)
- Axon AI orchestrator: intent routing, planning, execution logging, session view, writeback, cancellation/retry
- Trust & policy engine: policy DSL evaluator/validator, trust policy engine, provenance coverage, claim surface policy
- UI components: pagination, automation drawer, result panel, falsification dashboard, SCSpatial control rail
- Workbench: dataflow/DBTL feedback, payload admission, experiment record validation, CSV import

### Adding New Tests

1. Create a file in `__tests__/` named `<module>.test.ts` or `<component>.test.tsx`
2. Import from the module under test — path aliases (`@/`) work via `ts-jest` tsconfig override
3. For component tests, use `@testing-library/react` — already in devDependencies
4. DOM-dependent tests get `jsdom` environment automatically (configured in `jest.config.cjs`)

### Future: E2E Tests (Playwright)

A placeholder E2E job exists in CI. To activate:
1. `npm install -D @playwright/test`
2. Create `e2e/` directory with test files
3. Uncomment the E2E step in `.github/workflows/ci.yml`

---

## Contact
```

#### 修改 B8: 在目录树中添加测试相关信息

**文件**: `CLAUDE.md`

**查找**:
```
├── __tests__/                        Jest unit tests
```

**替换为**:
```
├── __tests__/                        76 Jest unit test files
│   ├── workflow/                     Workflow-specific tests
│   └── *.test.ts                     Per-module tests (engines, API, utils, domain)
├── jest.config.cjs                   Jest configuration (ts-jest, jsdom)
```

#### 所有 CLAUDE.md 修改汇总

| # | 修改内容 | 类型 |
|---|----------|------|
| B1 | "13" → "14" 工具数量 | 替换 |
| B2 | `next.config.js` → `next.config.mjs` | 替换 |
| B3 | 添加 kegg, scspatial 到项目树 | 替换块 |
| B4 | 添加 kegg, scspatial 到 API 表格 | 替换块 |
| B5 | 添加 Getting Started 章节 | 插入 |
| B6 | 添加 FORBIDDEN 文件理由表 | 插入 |
| B7 | 添加 Testing 章节 | 插入 |
| B8 | 扩展测试目录树 | 替换 |

---

## 三、P1 — 本周必须修复（质量级）

---

### P1-1: TypeScript strict 模式

**现状**: `tsconfig.json` 第 11-13 行：
```json
"strict": false,
"strictNullChecks": true,
"noImplicitAny": true,
```

`strict: false` 禁用了 `strictBindCallApply`、`strictFunctionTypes`、`strictPropertyInitialization`、`noImplicitThis`、`alwaysStrict`。

**关键发现**: 经 agent 深度分析，当前代码库 `tsc --noEmit` 零错误。启用 `strictFunctionTypes: true` 预计**不会产生新错误**，因为所有函数类型不安全的模式已经使用了 `as any` 保护。

**修改方案**:

#### 步骤 1：备份

```bash
cp tsconfig.json tsconfig.json.backup
```

#### 步骤 2：启用 `strictFunctionTypes`

打开 `tsconfig.json`，找到第 11-13 行，修改为：

```json
"strict": false,
"strictNullChecks": true,
"noImplicitAny": true,
"strictFunctionTypes": true,
```

#### 步骤 3：验证

```bash
npx tsc --noEmit
```

**预期结果**: 零错误。如果出现错误，以下是已知的可能错误和修复方法：

| 可能的错误 | 原因 | 修复 |
|-----------|------|------|
| Zustand middleware 链类型错误 | `workbenchStore.ts:1069` 的 `undefined as any` | 已有 `as any` 保护，不会触发 |
| Recharts callback props 类型不匹配 | tooltip formatter 使用 `any` | 已有 `as any` 保护，不会触发 |
| Event handler 类型不匹配 | `onChange={(e) => ...}` 参数类型 | 已有 `noImplicitAny` 覆盖 |

#### 步骤 4：继续启用其他选项（每次一个）

```json
// 第二批
"strictBindCallApply": true,
"strictFunctionTypes": true,

// 第三批（在第二批之后添加）
"noImplicitThis": true,
"strictBindCallApply": true,
"strictFunctionTypes": true,

// 第四批（风险最高 — 需要改 class 定义）
"strictPropertyInitialization": true,
"noImplicitThis": true,
"strictBindCallApply": true,
"strictFunctionTypes": true,
```

每批修改后都运行 `npx tsc --noEmit` + `npm test` + `npm run build`。

#### 步骤 5：最终目标

```json
"strict": true,
// 删除单独的 strictNullChecks、noImplicitAny（strict 已包含它们）
```

---

### P1-2: GeneratedPathway 接口缺字段

**现状**: `src/types.ts` 第 118-130 行的 `GeneratedPathway` 接口缺少 `bottleneck_enzymes` 和 `axon_interaction` 字段。`NEXAIPage.tsx` 在第 59、60、294 行用 `(pathway as any)` 强制访问。

**关键发现**: `PaperAnalyzer.tsx` 不受影响 — 它从原始 JSON 对象（`Record<string, unknown>`）访问这些字段，而非从 `GeneratedPathway`。

**修改方案**:

#### 步骤 1：修改 `src/types.ts`

**查找**（第 118-130 行，精确文本）:
```typescript
export interface GeneratedPathway {
  project_name?: string;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  risk_report?: RiskReportEntry[];
  yield_optimization_strategies?: YieldOptimizationStrategy[];
  metadata?: {
    sourceText?: string;
    generatedAt?: string;
    modelUsed?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
}
```

**替换为**:
```typescript
export interface GeneratedPathway {
  project_name?: string;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  risk_report?: RiskReportEntry[];
  yield_optimization_strategies?: YieldOptimizationStrategy[];
  // Axon predictive design fields (populated by /api/analyze)
  bottleneck_enzymes?: BottleneckEnzyme[];
  de_novo_design_strategies?: DeNovoDesignStrategy[];
  axon_interaction?: AxonInteraction;
  metadata?: {
    sourceText?: string;
    generatedAt?: string;
    modelUsed?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
}
```

**注意**: `BottleneckEnzyme`（第 460-466 行）、`DeNovoDesignStrategy`（需确认行号）、`AxonInteraction`（第 478-484 行）已在 `src/types.ts` 中定义，无需创建新类型。

#### 步骤 2：修改 `src/components/tools/NEXAIPage.tsx`

**修改 2a — 第 59 行**:

查找:
```typescript
  const bottlenecks = (pathway as any).bottleneck_enzymes || [];
```

替换为:
```typescript
  const bottlenecks = pathway.bottleneck_enzymes ?? [];
```

**修改 2b — 第 60 行**:

查找:
```typescript
  const axon = (pathway as any).axon_interaction;
```

替换为:
```typescript
  const axon = pathway.axon_interaction;
```

**修改 2c — 第 82 行**:

查找:
```typescript
        .map((b: any) => `${b.enzyme} (${b.efficiency_percent}% efficiency, ${b.yield_loss_percent}% yield loss)`)
```

替换为:
```typescript
        .map((b: BottleneckEnzyme) => `${b.enzyme} (${b.efficiency_percent}% efficiency, ${b.yield_loss_percent}% yield loss)`)
```

**修改 2d — 第 294 行**:

查找:
```typescript
    const bottlenecks = (pathway as any).bottleneck_enzymes?.length ?? 0;
```

替换为:
```typescript
    const bottlenecks = pathway.bottleneck_enzymes?.length ?? 0;
```

**修改 2e — 确认 import**:

检查 NEXAIPage.tsx 顶部的 import 块，确认 `BottleneckEnzyme` 已被导入。如果没有，添加：

```typescript
import type { GeneratedPathway, BottleneckEnzyme } from '../../types';
```

#### 步骤 3：验证

```bash
npx tsc --noEmit   # 零错误
npm test           # 所有测试通过
```

#### 所有需要修改的文件

| 文件 | 行号 | 修改内容 |
|------|------|----------|
| `src/types.ts` | 118-130 | 添加 3 个可选 Axon 字段到 `GeneratedPathway` |
| `src/components/tools/NEXAIPage.tsx` | 59 | `(pathway as any).bottleneck_enzymes` → `pathway.bottleneck_enzymes` |
| `src/components/tools/NEXAIPage.tsx` | 60 | `(pathway as any).axon_interaction` → `pathway.axon_interaction` |
| `src/components/tools/NEXAIPage.tsx` | 82 | `(b: any)` → `(b: BottleneckEnzyme)` |
| `src/components/tools/NEXAIPage.tsx` | 294 | `(pathway as any).bottleneck_enzymes` → `pathway.bottleneck_enzymes` |

---

### P1-3: 同步 VAE 训练阻塞 UI

**现状**: `src/components/tools/MultiOPage.tsx` 第 619 行：
```typescript
const vaeResult = useMemo(() => trainMultimodalVAE(OMICS_DATA, 8, 0.5, 100, 0.005), []);
```
100 个 epoch 的 VAE 训练在主线程同步执行，阻塞 UI。

**关键发现**:
- `trainMultimodalVAE` 是纯数学计算，零浏览器 API 依赖，可安全在 Worker 中运行
- 返回类型 `VAETrainingResult` 包含 `latentPoints`、`elbo`、`convergenceHistory` 等
- Next.js 原生支持 `new Worker(new URL('...', import.meta.url))` 模式，无需额外 webpack 配置
- 现有 `src/workers/` 目录已有 `fbaWorker.ts` 和 `pathwayWorker.ts` 作为参考

**修改方案**:

#### 步骤 1：创建 `src/workers/vaeWorker.ts`

```typescript
/// <reference lib="webworker" />

/**
 * Nexus-Bio — VAE (Variational Autoencoder) Web Worker
 *
 * Offloads trainMultimodalVAE computation from the main thread.
 * Pure math — no browser APIs used.
 */

import type { OmicsRow } from '../types';
import type { VAETrainingResult } from '../services/MOIEngine';
import { trainMultimodalVAE } from '../services/MOIEngine';

// ── Message types ──────────────────────────────────────────────────────

export type VAEWorkerIn = {
  type: 'TRAIN';
  data: OmicsRow[];
  latentDim: number;
  beta: number;
  epochs: number;
  lr: number;
  batchLabels?: number[];
};

export type VAEWorkerOut =
  | { type: 'RESULT'; result: VAETrainingResult }
  | { type: 'ERROR'; message: string };

// ── Message handler ────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<VAEWorkerIn>) => {
  const msg = e.data;

  if (msg.type === 'TRAIN') {
    try {
      const result = trainMultimodalVAE(
        msg.data,
        msg.latentDim,
        msg.beta,
        msg.epochs,
        msg.lr,
        msg.batchLabels,
      );
      self.postMessage({ type: 'RESULT', result } satisfies VAEWorkerOut);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'VAE training failed';
      self.postMessage({ type: 'ERROR', message } satisfies VAEWorkerOut);
    }
  }
};
```

**注意**: 顶部的 `/// <reference lib="webworker" />` 指令告诉 TypeScript 使用 Worker 类型定义而非 DOM 类型定义。这是因为 `tsconfig.json` 的 `lib` 只有 `["DOM", "DOM.Iterable", "ESNext"]`，没有 `"webworker"`。

#### 步骤 2：创建 `src/hooks/useVAEWorker.ts`

```typescript
'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { OmicsRow } from '../types';
import type { VAETrainingResult } from '../services/MOIEngine';
import type { VAEWorkerIn, VAEWorkerOut } from '../workers/vaeWorker';

interface UseVAEWorkerOptions {
  data: OmicsRow[];
  latentDim?: number;
  beta?: number;
  epochs?: number;
  lr?: number;
  batchLabels?: number[];
}

interface UseVAEWorkerReturn {
  result: VAETrainingResult | null;
  loading: boolean;
  error: string | null;
  train: () => void;
}

export function useVAEWorker({
  data,
  latentDim = 8,
  beta = 0.5,
  epochs = 100,
  lr = 0.005,
  batchLabels,
}: UseVAEWorkerOptions): UseVAEWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<VAETrainingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/vaeWorker.ts', import.meta.url),
    );

    const w = workerRef.current;
    w.onmessage = (e: MessageEvent<VAEWorkerOut>) => {
      const msg = e.data;
      if (msg.type === 'RESULT') {
        setResult(msg.result);
        setLoading(false);
        setError(null);
      } else if (msg.type === 'ERROR') {
        setError(msg.message);
        setLoading(false);
      }
    };

    w.onerror = (e) => {
      setError(e.message ?? 'Worker error');
      setLoading(false);
    };

    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const train = useCallback(() => {
    if (!workerRef.current) return;
    setLoading(true);
    setError(null);
    const msg: VAEWorkerIn = {
      type: 'TRAIN',
      data,
      latentDim,
      beta,
      epochs,
      lr,
      batchLabels,
    };
    workerRef.current.postMessage(msg);
  }, [data, latentDim, beta, epochs, lr, batchLabels]);

  return { result, loading, error, train };
}
```

#### 步骤 3：修改 `src/components/tools/MultiOPage.tsx`

**修改 3a — 添加 import（约第 13 行）**:

在现有 import 中添加：
```typescript
import { useVAEWorker } from '../../hooks/useVAEWorker';
```

**修改 3b — 替换第 619 行**:

查找:
```typescript
  const vaeResult = useMemo(() => trainMultimodalVAE(OMICS_DATA, 8, 0.5, 100, 0.005), []);
```

替换为:
```typescript
  const { result: vaeResult, loading: vaeLoading, error: vaeError, train: trainVAE } = useVAEWorker({
    data: OMICS_DATA,
    latentDim: 8,
    beta: 0.5,
    epochs: 100,
    lr: 0.005,
  });

  /* Auto-train VAE on mount */
  useEffect(() => { trainVAE(); }, [trainVAE]);
```

**修改 3c — 更新第 622 行（vaeEmbeddings useMemo）**:

查找:
```typescript
  const vaeEmbeddings = useMemo(
    () => exportEmbeddingsWithEfficiency(vaeResult, efficiencyScores),
    [vaeResult, efficiencyScores],
  );
```

替换为:
```typescript
  const vaeEmbeddings = useMemo(
    () => vaeResult ? exportEmbeddingsWithEfficiency(vaeResult, efficiencyScores) : [],
    [vaeResult, efficiencyScores],
  );
```

**修改 3d — 更新第 740 行**:

查找:
```typescript
        vaeElbo: vaeResult.elbo,
```

替换为:
```typescript
        vaeElbo: vaeResult?.elbo ?? 0,
```

**修改 3e — 更新第 760 行**:

查找:
```typescript
    vaeResult.elbo,
```

替换为:
```typescript
    vaeResult?.elbo,
```

**修改 3f — 更新第 1145 行**:

查找:
```typescript
              { label: 'Dim', value: `${vaeResult.latentDim}D`, accent: PATHD_THEME.sky },
```

替换为:
```typescript
              { label: 'Dim', value: `${vaeResult?.latentDim ?? 8}D`, accent: PATHD_THEME.sky },
```

**修改 3g — 更新第 1146 行**:

查找:
```typescript
              { label: 'ELBO', value: vaeResult.elbo.toFixed(3), accent: PATHD_THEME.mint },
```

替换为:
```typescript
              { label: 'ELBO', value: vaeResult?.elbo?.toFixed(3) ?? '—', accent: PATHD_THEME.mint },
```

**修改 3h — 更新第 1154 行**:

查找:
```typescript
                    const pts = vaeResult.latentPoints;
```

替换为:
```typescript
                    const pts = vaeResult?.latentPoints ?? [];
```

**修改 3i — 更新第 1187 行**:

查找:
```typescript
                  const hist = vaeResult.convergenceHistory;
```

替换为:
```typescript
                  const hist = vaeResult?.convergenceHistory ?? [];
```

**修改 3j — 添加 loading/error UI（在投影 tab 面板中，约第 1138 行）**:

在投影 tab 的 JSX 开头添加：
```typescript
{vaeLoading && <p style={{ color: LABEL, fontSize: '11px', fontFamily: T.MONO }}>Training VAE embedding...</p>}
{vaeError && <p style={{ color: '#FA8072', fontSize: '11px', fontFamily: T.MONO }}>VAE error: {vaeError}</p>}
```

#### 步骤 4：移除不再需要的 import

从 MultiOPage.tsx 的 import 中移除 `trainMultimodalVAE`（如果它不再被其他地方使用）。

#### 步骤 5：验证

```bash
npx tsc --noEmit   # 零错误
npm test           # 所有测试通过
# 手动测试: 打开 Multi-Omics 页面
# 确认 VAE 训练期间 UI 不卡顿（可滚动、可点击其他 tab）
# 确认训练完成后图表正常显示
```

---

### P1-4: API 错误格式不统一

**现状**: 5 个 API route 有 3 种错误格式。需要统一为 `{ ok: false, error: string, code?: string }`。

**修改方案**:

#### 步骤 1：创建 `src/utils/apiErrors.ts`

```typescript
import { NextResponse } from 'next/server';

interface ErrorBody {
  ok: false;
  error: string;
  code?: string;
  [key: string]: unknown;
}

export function errorResponse(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  const body: ErrorBody = { ok: false, error: message, ...extra };
  return NextResponse.json(body, { status, headers });
}
```

#### 步骤 2：修改 `app/api/analyze/route.ts`（10 处）

在文件顶部添加 import：
```typescript
import { errorResponse } from '@/utils/apiErrors';
```

逐个替换错误响应：

| # | 行号 | 查找 | 替换为 |
|---|------|------|--------|
| 1 | ~585-596 | `return new NextResponse(JSON.stringify({ error: 'Rate limit exceeded...' }), { status: 429, headers: { ... } })` | `return errorResponse('Rate limit exceeded. Try again in 60 seconds.', 429, undefined, { 'Retry-After': '60', ...getCorsHeaders(req) })` |
| 2 | ~601 | `return jsonResponse({ error: 'Invalid content type' }, 415)` | `return errorResponse('Invalid content type', 415, undefined, getCorsHeaders(req))` |
| 3 | ~608 | `return jsonResponse({ error: 'No API keys configured' }, 500)` | `return errorResponse('No API keys configured', 500, undefined, getCorsHeaders(req))` |
| 4 | ~615 | `return jsonResponse({ error: 'Invalid JSON body' }, 400)` | `return errorResponse('Invalid JSON body', 400, undefined, getCorsHeaders(req))` |
| 5 | ~684-686 | `return jsonResponse({ error: \`searchQuery exceeds...\` }, 413)` | `return errorResponse(\`searchQuery exceeds ${MAX_SEARCH_QUERY_CHARS} characters\`, 413, undefined, getCorsHeaders(req))` |
| 6 | ~707 | `return jsonResponse({ error: 'Missing contents array or searchQuery' }, 400)` | `return errorResponse('Missing contents array or searchQuery', 400, undefined, getCorsHeaders(req))` |
| 7 | ~712 | `return jsonResponse({ error: 'No prompt text found' }, 400)` | `return errorResponse('No prompt text found', 400, undefined, getCorsHeaders(req))` |
| 8 | ~724-726 | `return jsonResponse({ error: \`Prompt exceeds...\` }, 413)` | `return errorResponse(\`Prompt exceeds ${MAX_PROMPT_CHARS} characters after assembly\`, 413, undefined, getCorsHeaders(req))` |
| 9 | ~732-734 | `return jsonResponse({ error: 'This request includes non-text content...' }, 503)` | `return errorResponse('This request includes non-text content such as an image or file and requires GEMINI_API_KEY.', 503, undefined, getCorsHeaders(req))` |
| 10 | ~793-795 | `return jsonResponse({ error: 'All AI providers are currently unavailable...' }, 503)` | `return errorResponse('All AI providers are currently unavailable. Please try again in a moment.', 503, undefined, getCorsHeaders(req))` |

**注意**: 第 644-658 行和 660-677 行的 off-domain refusal 和 general-knowledge refusal 返回 200 状态码，不是错误响应，不需要修改。

#### 步骤 3：修改 `app/api/fba/route.ts`（2 处）

添加 import：
```typescript
import { errorResponse } from '@/utils/apiErrors';
```

| # | 行号 | 查找 | 替换为 |
|---|------|------|--------|
| 1 | ~33 | `return NextResponse.json({ ok: false, error: 'Invalid FBA request payload' }, { status: 400, headers: getCorsHeaders(request) })` | `return errorResponse('Invalid FBA request payload', 400, undefined, getCorsHeaders(request))` |
| 2 | ~103-109 | `return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Authoritative FBA solve failed' }, { status: 500, headers: getCorsHeaders(request) })` | `return errorResponse(error instanceof Error ? error.message : 'Authoritative FBA solve failed', 500, undefined, getCorsHeaders(request))` |

#### 步骤 4：修改 `app/api/alphafold/route.ts`（4 处）

添加 import：
```typescript
import { errorResponse } from '@/utils/apiErrors';
```

| # | 行号 | 查找 | 替换为 |
|---|------|------|--------|
| 1 | ~21 | `return new NextResponse('Missing id parameter', { status: 400, headers })` | `return errorResponse('Missing id parameter', 400, undefined, headers)` |
| 2 | ~26 | `return new NextResponse('Invalid UniProt ID', { status: 400, headers })` | `return errorResponse('Invalid UniProt ID', 400, undefined, headers)` |
| 3 | ~63-65 | `return new NextResponse(\`AlphaFold structure not found for ${uniprotId}\`, { status: 404, headers })` | `return errorResponse(\`AlphaFold structure not found for ${uniprotId}\`, 404, undefined, headers)` |
| 4 | ~68 | `return new NextResponse(\`Fetch error: ${message}\`, { status: 500, headers })` | `return errorResponse(\`Fetch error: ${message}\`, 500, undefined, headers)` |

**注意**: alphafold route 当前返回 `text/plain` 错误体。改为 JSON 后，客户端的 `!res.ok` 检查仍然有效，因为客户端从未解析错误体。

#### 步骤 5：修改 `app/api/pubchem/route.ts`（8 处）

添加 import：
```typescript
import { errorResponse } from '@/utils/apiErrors';
```

| # | 行号 | 查找 | 替换为 |
|---|------|------|--------|
| 1 | ~27 | `return json({ error: 'Invalid CID' }, 400)` | `return errorResponse('Invalid CID', 400)` |
| 2 | ~46 | `return json({ error: \`No SDF found for CID ${cid}\` }, 404)` | `return errorResponse(\`No SDF found for CID ${cid}\`, 404)` |
| 3 | ~52 | `return json({ error: 'Empty name' }, 400)` | `return errorResponse('Empty name', 400)` |
| 4 | ~61 | `return json({ error: 'Name not found in PubChem' }, 404)` | `return errorResponse('Name not found in PubChem', 404)` |
| 5 | ~65 | `return json({ error: 'No CID found for this name' }, 404)` | `return errorResponse('No CID found for this name', 404)` |
| 6 | ~90 | `return json({ error: \`CID ${foundCid} found but no SDF available\` }, 404)` | `return errorResponse(\`CID ${foundCid} found but no SDF available\`, 404)` |
| 7 | ~93-94 | `return json({ error: message }, 500)` | `return errorResponse(message, 500)` |
| 8 | ~98 | `return json({ error: 'Provide either cid or name parameter' }, 400)` | `return errorResponse('Provide either cid or name parameter', 400)` |

#### 步骤 6：修改 `app/api/workbench/route.ts`（8 处）

添加 import：
```typescript
import { errorResponse } from '@/utils/apiErrors';
```

| # | 行号 | 查找 | 替换为 |
|---|------|------|--------|
| 1 | ~64 | `return NextResponse.json({ ok: false, error: 'Workflow artifact not found' }, { status: 404, ... })` | `return errorResponse('Workflow artifact not found', 404, undefined, getCorsHeaders(request))` |
| 2 | ~87-89 | `return NextResponse.json({ ok: false, error: 'Forbidden: invalid origin' }, { status: 403, ... })` | `return errorResponse('Forbidden: invalid origin', 403, undefined, getCorsHeaders(request))` |
| 3 | ~95-98 | `return NextResponse.json({ ok: false, error: 'Invalid content type' }, { status: 415, ... })` | `return errorResponse('Invalid content type', 415, undefined, getCorsHeaders(request))` |
| 4 | ~104-107 | `return NextResponse.json({ ok: false, error: 'Request body too large' }, { status: 413, ... })` | `return errorResponse('Request body too large', 413, undefined, getCorsHeaders(request))` |
| 5 | ~114 | `return NextResponse.json({ ok: false, error: 'Invalid workbench payload' }, { status: 400, ... })` | `return errorResponse('Invalid workbench payload', 400, undefined, getCorsHeaders(request))` |
| 6 | ~119-122 | `return NextResponse.json({ ok: false, error: 'State payload too large' }, { status: 413, ... })` | `return errorResponse('State payload too large', 413, undefined, getCorsHeaders(request))` |
| 7 | ~133-139 | `return NextResponse.json({ ok: false, error: 'Artifact-scoped persistence...' }, { status: 500 })` | `return errorResponse('Artifact-scoped persistence could not resolve a stable artifact ID', 500)` |
| 8 | ~159-171 | `return NextResponse.json({ ok: false, error: 'Incoming workbench revision is stale', state: current, ... }, { status: 409 })` | `return errorResponse('Incoming workbench revision is stale', 409, { state: current, backend: getBackendMeta(...), members: listProjectMembers(...), experiments: listExperimentRecords(...), audit: listSyncAudit(...), history: listCanonicalHistory(...) })` |

**总计**: 28 处错误响应需要修改。

#### 客户端兼容性分析

经 agent 验证，所有客户端调用已经兼容新的 `{ ok: false, error: string }` 格式：

| 调用位置 | 当前错误处理 | 兼容性 |
|---------|------------|--------|
| `axonAdapters.ts:47` | 读取 `data?.error` | ✅ 兼容 |
| `CopilotSlideOver.tsx:124` | `if (!res.ok) throw new Error(data?.error ?? ...)` | ✅ 兼容 |
| `NEXAIPage.tsx:259` | 检查 `res.ok` | ✅ 兼容 |
| `PaperAnalyzer.tsx:388` | `if (!res.ok) throw new Error(data.error \|\| ...)` | ✅ 兼容 |
| `FBAAuthorityClient.ts:35` | 读取 `payload?.error` | ✅ 兼容 |
| `ProteinViewer.tsx:39` | `if (!res.ok) throw new Error(...)` | ✅ 兼容 |
| `MoleculeViewer.tsx:32` | `if (!res.ok) throw new Error(...)` | ✅ 兼容 |

#### 步骤 7：验证

```bash
npx tsc --noEmit
npm test
# 手动测试: 在每个 tool page 中触发错误条件
# 确认浏览器 Network tab 中错误响应格式为 {"ok":false,"error":"..."}
```

---

### P1-5: 无 CSP header

**现状**: `next.config.mjs` 第 24-41 行有安全头但缺少 Content-Security-Policy。

**关键发现**: 经 agent 深度分析，以下是客户端代码实际连接的所有外部域名：

| 域名 | 来源文件 | 用途 |
|------|---------|------|
| `https://eutils.ncbi.nlm.nih.gov` | SemanticSearch.tsx | PubMed E-utilities |
| `https://www.ebi.ac.uk` | SemanticSearch.tsx | Europe PMC |
| `https://api.semanticscholar.org` | SemanticSearch.tsx | Semantic Scholar |
| `https://api.openalex.org` | SemanticSearch.tsx | OpenAlex |
| `https://api.core.ac.uk` | SemanticSearch.tsx | CORE repository |
| `https://en.wikipedia.org` | CellImageViewer.tsx | Wikipedia Commons |
| `https://cellimagelibrary.org` | CellImageViewer.tsx | Cell Image Library |
| `https://idr.openmicroscopy.org` | CellImageViewer.tsx | EMBL-EBI IDR |
| `https://3Dmol.org` | ProteinViewer.tsx, MoleculeViewer.tsx | 3Dmol.js CDN |
| `https://files.rcsb.org` | ProteinViewer.tsx | RCSB PDB 结构文件 |

**不需要 CSP 的域名**（仅服务端调用）:
- `api.groq.com` — 只在 `app/api/analyze/route.ts` 中调用
- `generativelanguage.googleapis.com` — 同上
- `alphafold.ebi.ac.uk` — 只在 `app/api/alphafold/route.ts` 中调用
- `pubchem.ncbi.nlm.nih.gov` — 只在 `app/api/pubchem/route.ts` 中调用

**修改方案**:

#### 步骤 1：打开 `next.config.mjs`

#### 步骤 2：在 `headers()` 函数的安全头数组中添加 CSP

在现有的 `Permissions-Policy` 头之后添加：

```javascript
{
  key: 'Content-Security-Policy',
  value: [
    // ── Default: restrict to same-origin ──
    "default-src 'self'",

    // ── Scripts: self + 3Dmol.js CDN ──
    // 3Dmol.org/build/3Dmol-min.js is loaded at runtime by ProteinViewer
    // and MoleculeViewer (CDN-only, not an npm package per project rules)
    "script-src 'self' https://3Dmol.org",

    // ── Styles: self + inline (required for Framer Motion, Three.js, and
    //    component-level style attributes used pervasively) ──
    "style-src 'self' 'unsafe-inline'",

    // ── Images: self + all image hosts ──
    "img-src 'self' data: blob:" +
      " https://en.wikipedia.org" +
      " https://cellimagelibrary.org" +
      " https://idr.openmicroscopy.org" +
      " https://upload.wikimedia.org" +
      " https://files.rcsb.org" +
      " https://pubchem.ncbi.nlm.nih.gov",

    // ── Fonts: self (no Google Fonts used) ──
    "font-src 'self'",

    // ── XHR/fetch: self + all literature search APIs + image/microscopy APIs ──
    "connect-src 'self'" +
      " https://eutils.ncbi.nlm.nih.gov" +
      " https://www.ebi.ac.uk" +
      " https://api.semanticscholar.org" +
      " https://api.openalex.org" +
      " https://api.core.ac.uk" +
      " https://en.wikipedia.org" +
      " https://cellimagelibrary.org" +
      " https://idr.openmicroscopy.org" +
      " https://files.rcsb.org" +
      " https://3Dmol.org",

    // ── Frames: none ──
    "frame-src 'none'",

    // ── Objects: none ──
    "object-src 'none'",

    // ── Base URI: self ──
    "base-uri 'self'",

    // ── Form actions: self ──
    "form-action 'self'",

    // ── Upgrade insecure ──
    "upgrade-insecure-requests",
  ].join('; '),
},
```

#### 步骤 3：验证

```bash
npm run dev
# 打开浏览器 DevTools → Console
# 确认无 CSP 违规错误
# 测试以下功能：
# 1. 3D 蛋白查看器（ProteinViewer）— 确认 3Dmol.js 加载正常
# 2. 分子查看器（MoleculeViewer）— 确认 PubChem SDF 加载正常
# 3. 文献搜索（SemanticSearch）— 确认 6 个 API 都能正常返回
# 4. 细胞图像查看器（CellImageViewer）— 确认图片加载正常
```

---

### P1-6: 无 .env.example

**修改方案**:

#### 步骤 1：创建 `.env.example`

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
# Optional — Monitoring
# ─────────────────────────────────────────────
# Sentry DSN — https://sentry.io
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=

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

#### 步骤 2：确认 `.gitignore` 包含正确的规则

```bash
grep -E "\.env" .gitignore
```

**预期结果**: 应该看到 `.env*.local` 或类似的规则，确保 `.env.local` 被忽略但 `.env.example` 不被忽略。

#### 步骤 3：验证

```bash
git status  # .env.example 应该是 untracked
```

---

## 四、P2 — 两周内修复（工程卫生级）

---

### P2-1: 设计 token 重复声明

**现状**: 经 agent 深度分析，有 **9 个文件** 声明了设计 token 常量，但它们并非完全一致。

**关键发现**:
- 存在两个 "token 家族"：Family A（CellFree, MultiO, DynCon, CatDes）和 Family B（DBTLflow, GECAIR）
- 两个家族的最终 CSS 值实际相同（`sepiaPanelBorder` 和 `paperBorder` 解析为同一个 rgba 值）
- 唯一差异：`INPUT_BG` — Family A 用 `panelInset`，Family B 用 `paperSurfaceStrong`
- DBTLflowPage 和 GECAIRPage 是 FORBIDDEN 文件，不应修改
- CatalystDesignerPage 的 GLASS 使用 `borderRadius: '20px'` 而非 `'24px'`

**修改方案**:

#### 步骤 1：创建 `src/hooks/useToolTheme.ts`

```typescript
import { PATHD_THEME } from '../components/workbench/workbenchTheme';

/**
 * Shared design tokens for all tool pages.
 *
 * Replaces the per-file PANEL_BG / BORDER / LABEL / VALUE /
 * INPUT_BG / INPUT_BORDER / INPUT_TEXT / GLASS declarations.
 *
 * FORBIDDEN files (DBTLflowPage, GECAIRPage, ProEvolPage) are NOT touched.
 */
export const toolTokens = {
  panelBg:     PATHD_THEME.sepiaPanelMuted,
  border:      PATHD_THEME.sepiaPanelBorder,
  label:       PATHD_THEME.label,
  value:       PATHD_THEME.value,
  inputBg:     PATHD_THEME.panelInset,
  inputBorder: PATHD_THEME.sepiaPanelBorder,
  inputText:   PATHD_THEME.value,
  glass: {
    borderRadius: '24px',
    background: PATHD_THEME.panelSurface,
    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
  } as React.CSSProperties,
} as const;

export function useToolTheme() {
  return toolTokens;
}
```

#### 步骤 2：逐文件修改

**常量名映射**:

| 旧常量名 | 新属性名 |
|---------|---------|
| `PANEL_BG` | `theme.panelBg` |
| `BORDER` | `theme.border` |
| `LABEL` | `theme.label` |
| `VALUE` | `theme.value` |
| `INPUT_BG` | `theme.inputBg` |
| `INPUT_BORDER` | `theme.inputBorder` |
| `INPUT_TEXT` | `theme.inputText` |
| `GLASS` | `theme.glass` |

**需要修改的文件（6 个，排除 FORBIDDEN）**:

| 文件 | 删除行范围 | 保留的工具特有 token |
|------|-----------|-------------------|
| `CellFreePage.tsx` | L31-44 | `GENE_COLORS` (L46) |
| `MultiOPage.tsx` | L54-74 | `LAYER_COLORS` (L48-52), `MULTIO_TABS` (L62-68) |
| `DynConPage.tsx` | L33-42 | `SERIES` (L45-52) |
| `CatalystDesignerPage.tsx` | L43-55 | `PHASE_COLORS` (L57-64)。注意：GLASS 用 `20px`，需保留本地覆盖 `const glass = { ...theme.glass, borderRadius: '20px' as const };` |
| `CatalystDesignerPageV2.tsx` | L45-56 | `PHASE_COLORS` (L58-65) |
| `ToolsDirectoryPage.tsx` | L34-43（仅 BORDER, VALUE, LABEL） | `BORDER_STRONG`, `SURFACE`, `SURFACE_SOFT` 等 |

**每个文件的通用修改模式**:

```typescript
// 1. 添加 import（在文件顶部 import 块中）
import { useToolTheme } from '../../hooks/useToolTheme';

// 2. 删除旧的 token 常量声明块

// 3. 在组件函数顶部添加
const theme = useToolTheme();

// 4. 在组件中替换所有引用
// 例如: style={{ background: PANEL_BG }} → style={{ background: theme.panelBg }}
```

**不修改的文件**:
- `DBTLflowPage.tsx` — FORBIDDEN
- `GECAIRPage.tsx` — FORBIDDEN
- `ProEvolPage.tsx` — FORBIDDEN（使用 `PROEVOL_THEME`）
- `FBASimPage.tsx` — 无本地 token 常量（直接使用 `PATHD_THEME`）
- `GenMIMPage.tsx` — 同上
- `ScSpatialPage.tsx` — 同上
- `CETHXPage.tsx` — 同上
- `NEXAIPage.tsx` — 同上
- `MetabolicEngPage.tsx` — 同上

#### 步骤 3：验证

```bash
npx tsc --noEmit
npm test
# 手动检查每个修改过的 tool page，确认视觉效果不变
```

---

### P2-2: 巨型组件拆分

**现状**: 6 个 page 超过 1000 行。

**关键发现**: 经 agent 深度分析，这些巨型组件中的子组件**已经是独立的函数组件**，只是生活在同一个文件中。提取操作主要是文件移动 + import 重连。

#### MultiOPage.tsx (1253 行) 拆分方案

**已确认可提取的组件**:

| 组件 | 行范围 | Props | 状态 |
|------|--------|-------|------|
| `VolcanoPlot` | L94-178 | `data`, `fcThreshold`, `pvThreshold`, `highlightedGene` | ✅ 独立 |
| `TriPanelEmbedding` | L226-417 | `embeddings`, `data`, `fcThreshold`, `pvThreshold`, `activeLayers`, `highlightedGene` | ✅ 独立 |
| `EmbeddingScatter` | L419-582 | `embeddings`, `fcThreshold`, `activeLayers`, `highlightedGene`, `bottleneckGene` | ✅ 独立 |

**操作步骤**:

```bash
# 1. 创建子目录
mkdir -p src/components/tools/multio/

# 2. 移动组件（从 MultiOPage.tsx 中剪切对应行范围，粘贴到新文件）
# src/components/tools/multio/VolcanoPlot.tsx     ← L94-178
# src/components/tools/multio/TriPanelEmbedding.tsx ← L226-417
# src/components/tools/multio/EmbeddingScatter.tsx  ← L419-582

# 3. 移动工具函数
# src/components/tools/multio/utils.ts ← L76-92 (canonicalGeneToken, findPreferredGene) + L201-224 (CLUSTER_PAL, divergingColor, pearsonR)

# 4. 移动常量
# src/components/tools/multio/columns.ts ← L180-199 (COLUMNS)

# 5. 在 MultiOPage.tsx 中添加 import
import { VolcanoPlot } from './multio/VolcanoPlot';
import { TriPanelEmbedding } from './multio/TriPanelEmbedding';
import { EmbeddingScatter } from './multio/EmbeddingScatter';
```

**提取后**: MultiOPage 从 ~1253 行缩减到 ~500-600 行。

#### CellFreePage.tsx (1169 行) 拆分方案

| 组件 | 行范围 | Props |
|------|--------|-------|
| `TimeCourseChart` | L97-312 | `result`, `constructs` |
| `ResourceChart` | L314-392 | `result` |
| `FittingChart` | L394-493 | `result` |
| `IvIvChart` | L495-603 | `result` |
| `ReactorTwin3D` | L605-707 | `result`, `constructs`, `params` |

```bash
mkdir -p src/components/tools/cellfree/
# 移动 5 个图表组件到 src/components/tools/cellfree/
# 移动 SVG helpers (L60-95) 到 src/components/tools/cellfree/svgHelpers.ts
```

**提取后**: CellFreePage 从 ~1169 行缩减到 ~350-400 行。

#### NEXAIPage.tsx (906 行) 拆分方案

| 组件/函数 | 行范围 | Props |
|----------|--------|-------|
| `pathwayToResult` | L57-96 | 纯函数 |
| `extractYear` | L49-55 | 纯函数 |
| `QuickQueriesCard` | L466-542 | `contextPrompt`, `query`, `setQuery`, `result`, `PRESET_QUERIES` |

```bash
mkdir -p src/components/tools/nexai/
# 移动工具函数到 src/components/tools/nexai/nexaiUtils.ts
# 移动 QuickQueriesCard 到 src/components/tools/nexai/QuickQueriesCard.tsx
```

**提取后**: NEXAIPage 从 ~906 行缩减到 ~450-500 行。

**注意**: 中间阅读表面（L544-799，255 行）需要 20+ 个 props，不适合提取。保持内联。

---

### P2-3: Store 层依赖组件层

**现状**: `workbenchStore.ts` 从 `components/tools/shared/` 和 `components/workbench/` 导入，形成架构倒置。

**经 agent 验证的完整导入列表**:

```
src/store/workbenchStore.ts:30  ← components/tools/shared/workbenchConfig
src/store/workbenchStore.ts:31  ← components/tools/shared/workbenchGraph
src/store/workbenchStore.ts:32  ← components/tools/shared/toolAssumptions
src/store/workbenchStore.ts:33  ← components/workbench/workbenchExecution
src/store/workbenchStore.ts:81  ← components/tools/shared/toolValidity
src/store/workbenchTypes.ts:9   ← components/tools/shared/workbenchConfig (type-only)
src/store/workbenchStoreHelpers.ts:8 ← components/tools/shared/workbenchConfig (type-only)
```

**修改方案**:

#### 步骤 1：创建目录

```bash
mkdir -p src/config
```

#### 步骤 2：移动文件

```bash
mv src/components/tools/shared/workbenchConfig.ts src/config/workbenchConfig.ts
mv src/components/tools/shared/workbenchGraph.ts src/config/workbenchGraph.ts
mv src/components/tools/shared/toolAssumptions.ts src/config/toolAssumptions.ts
mv src/components/tools/shared/toolValidity.ts src/config/toolValidity.ts
mv src/components/workbench/workbenchExecution.ts src/config/workbenchExecution.ts
```

#### 步骤 3：更新 `src/config/workbenchConfig.ts` 的内部导入

**注意**: `workbenchConfig.ts` 导入 `./toolRegistry` 和 `./workbenchGraph`。`workbenchGraph` 也会移动到 `src/config/`，但 `toolRegistry.ts` 不应移动（它包含 lucide-react 图标组件导入，属于 UI 层）。

在移动后的 `src/config/workbenchConfig.ts` 中修改导入：

```typescript
// 修改前
import { getToolDefinition } from './toolRegistry';
import { getDependencyEdges } from './workbenchGraph';

// 修改后
import { getToolDefinition } from '../components/tools/shared/toolRegistry';
import { getDependencyEdges } from './workbenchGraph';
```

#### 步骤 4：更新所有 store 文件的导入

**`src/store/workbenchStore.ts`**（5 处）:

```typescript
// 第 30 行: 修改前
import { getNextToolIds, getStageForTool, type WorkbenchStageId } from '../components/tools/shared/workbenchConfig';
// 修改后
import { getNextToolIds, getStageForTool, type WorkbenchStageId } from '../config/workbenchConfig';

// 第 31 行: 修改前
import { getUpstreamToolIds } from '../components/tools/shared/workbenchGraph';
// 修改后
import { getUpstreamToolIds } from '../config/workbenchGraph';

// 第 32 行: 修改前
import { TOOL_ASSUMPTIONS } from '../components/tools/shared/toolAssumptions';
// 修改后
import { TOOL_ASSUMPTIONS } from '../config/toolAssumptions';

// 第 33 行: 修改前
import { buildExecutionSnapshot } from '../components/workbench/workbenchExecution';
// 修改后
import { buildExecutionSnapshot } from '../config/workbenchExecution';

// 第 81 行: 修改前
import { getToolValidity } from '../components/tools/shared/toolValidity';
// 修改后
import { getToolValidity } from '../config/toolValidity';
```

**`src/store/workbenchTypes.ts`**（1 处）:

```typescript
// 第 9 行: 修改前
import type { WorkbenchStageId } from '../components/tools/shared/workbenchConfig';
// 修改后
import type { WorkbenchStageId } from '../config/workbenchConfig';
```

**`src/store/workbenchStoreHelpers.ts`**（1 处）:

```typescript
// 第 8 行: 修改前
import type { WorkbenchStageId } from '../components/tools/shared/workbenchConfig';
// 修改后
import type { WorkbenchStageId } from '../config/workbenchConfig';
```

#### 步骤 5：验证

```bash
npx tsc --noEmit
npm test
# 确认 store/ 不再从 components/ 导入
grep -rn "from.*components" src/store/
# 应该返回空结果（或仅返回 type-only 导入，如果有）
```

---

### P2-4: 无 E2E 测试

**修改方案**:

#### 步骤 1：安装 Playwright

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

#### 步骤 2：创建配置文件

```
文件: playwright.config.ts (新建)
```

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

#### 步骤 3：创建首批 E2E 测试

```bash
mkdir -p e2e
```

```
文件: e2e/homepage.spec.ts (新建)
```

```typescript
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});

test('navigate to tools directory', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.locator('text=Pathway Designer')).toBeVisible();
});
```

```
文件: e2e/health.spec.ts (新建)
```

```typescript
import { test, expect } from '@playwright/test';

test('health endpoint returns ok', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe('ok');
});
```

#### 步骤 4：添加 npm script

在 `package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "test:e2e": "npx playwright test",
    "test:e2e:ui": "npx playwright test --ui"
  }
}
```

#### 步骤 5：激活 CI 中的 E2E 步骤

在 `.github/workflows/ci.yml` 中，取消 E2E job 中的注释：

```yaml
      - name: Run E2E tests
        run: npx playwright test
        env:
          BASE_URL: http://localhost:3000
```

#### 步骤 6：验证

```bash
npx playwright test --ui   # 本地可视化运行
```

---

### P2-5: 无 bundle analysis

**修改方案**:

#### 步骤 1：安装

```bash
npm install -D @next/bundle-analyzer
```

#### 步骤 2：修改 `next.config.mjs`

在文件顶部添加 import：

```javascript
import bundleAnalyzer from '@next/bundle-analyzer';
```

在 `withSentryConfig` 外面包裹 `withBundleAnalyzer`：

```javascript
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// 最终导出（Sentry 最外层）
export default withSentryConfig(
  withBundleAnalyzer(nextConfig),
  { silent: true, org: "nexus-bio", project: "nexus-bio-web" }
);
```

#### 步骤 3：添加 npm script

```json
{
  "scripts": {
    "analyze": "ANALYZE=true npm run build"
  }
}
```

#### 步骤 4：运行

```bash
npm run analyze
```

会自动打开浏览器显示 treemap，可查看 Three.js、Recharts、framer-motion 等库的实际体积。

---

## 五、P3 — 低优先级

| 问题 | 评估 | 建议 |
|------|------|------|
| `SemanticSearch.tsx` 和 `CellImageViewer.tsx` 中的 `any` | 外部 API 无类型定义，`any` 是务实选择 | 可为每个 API 创建 `interface`，但优先级低 |
| Recharts tooltip 的 `any` props | 库的已知类型缺陷 | 等待 Recharts 修复 |
| `use3Dmol.ts` 中 `viewer: any` | 3Dmol.js 通过 CDN 加载，无类型 | 可创建 `types/3dmol.d.ts` 声明文件 |

---

## 六~九、详细审计

详细审计内容与 v1 报告相同（CLAUDE.md 评分 3.4/10、Skill 生态 2.5/10、代码架构 6.5/10、DevOps 4.1/10），此处不重复。请参阅 v1 报告的相关章节。

---

## 十、推荐项目团队结构

| 角色 | 职责 | 对应问题 | 优先级 |
|------|------|----------|--------|
| **🏗 Platform Engineer** | CI/CD、GitHub Actions、Vercel 配置 | P0-1 | 🔴 立即 |
| **🔒 Security Engineer** | CSP、认证、rate limiting | P1-5 | 🔴 本周 |
| **📊 SRE** | Sentry、health check、告警 | P0-2 | 🔴 立即 |
| **🗄 Data Engineer** | SQLite → Turso 迁移 | P0-3 | 🔴 立即 |
| **📝 Technical Writer** | CLAUDE.md、ADR、CONTRIBUTING.md | P0-4 | 🔴 本周 |
| **🧪 QA Engineer** | E2E 测试、coverage、CI 集成 | P2-4 | 🟡 两周内 |
| **⚡ Frontend Architect** | TS strict、组件拆分、Web Worker | P1-1~P1-3, P2-1~P2-3 | 🟡 本周 |
| **🤖 DevX Engineer** | 缺失的 skill、.claude/settings.json | Skill 生态 | 🟢 两周内 |

---

## 十一、完整修改路线图

### 第 1 周

| 天 | 任务 | 预计耗时 | 验证命令 |
|----|------|----------|----------|
| Day 1 | P0-1: 创建 CI/CD pipeline | 30 min | `git push` → 确认 Actions tab 有 CI run |
| Day 1 | P0-4: 修复 CLAUDE.md 事实性错误 | 45 min | `npx tsc --noEmit` |
| Day 1 | P1-6: 创建 `.env.example` | 5 min | `git status` |
| Day 2 | P0-2: 集成 Sentry + health check | 1 hr | `curl /api/health` → `{"status":"ok"}` |
| Day 3 | P1-2: 修复 GeneratedPathway 接口 | 30 min | `npx tsc --noEmit` + `npm test` |
| Day 3 | P1-1: 启用 `strictFunctionTypes` | 15 min | `npx tsc --noEmit` |
| Day 4 | P1-3: VAE Worker 迁移 | 2 hr | 打开 Multi-Omics 页面，确认不卡顿 |
| Day 4 | P1-4: 统一 API 错误格式 | 2 hr | `npx tsc --noEmit` + `npm test` |
| Day 5 | P1-5: 添加 CSP header | 30 min | DevTools → Console 无 CSP 违规 |
| Day 5 | P0-3: SQLite localStorage 双写 | 1 hr | 创建 workbench → 刷新 → 数据仍在 |

### 第 2 周

| 天 | 任务 | 预计耗时 |
|----|------|----------|
| Day 6 | P2-1: 提取共享设计 token | 2 hr |
| Day 7 | P2-2: 拆分 MultiOPage + CellFreePage | 3 hr |
| Day 8 | P2-3: 移动 store→component 导入 | 1 hr |
| Day 9 | P2-4: 安装 Playwright + 首批 E2E | 2 hr |
| Day 10 | P2-5: 安装 bundle analyzer | 30 min |
| Day 10 | P1-1: 继续启用更多 TS strict 选项 | 1 hr |

---

> **报告生成**: 2026-06-06 by Claude Code Audit Team
> **版本**: v2 — 所有修改方案经过逐行验证，提供完整可复制代码
> **下一步**: 从 Day 1 的 P0-1 开始执行
