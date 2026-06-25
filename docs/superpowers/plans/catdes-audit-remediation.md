# CatDes 科学真实性审计 + 修复执行方案
**审计基线**: commit 242bcd7（2026-06-22）  
**审计方法**: 直接读完每个引擎函数的完整实现，不是凭注释判断  
**执行前必读**: 按编号顺序执行，每项结束后输出 VERIFY 块才能继续下一项

---

## 工作纪律

1. **"Church-method"已确认为误导性标签**——`balancePathway` 实际是 Newton-Raphson 迭代，与 Church 实验室无关，必须修改
2. **"calibrated against SKEMPI 2.0"是无根据声明**——仓库里没有 SKEMPI 数据，系数是硬编码的，必须修正措辞
3. **所有修复必须是真实的科学实现**——不接受"标记为 partial 然后保留假实现"的解法
4. **每项完成后必须提供可独立核查的证据**（测试 log、具体数字、API 真实响应截图）

---

## 审计结论总表（执行修复的依据）

| 模块 | 函数 | 判定 | 核心问题 |
|---|---|---|---|
| CatalystDesignerEngine | `predictBindingAffinity` | ✅ 部分真实 | LJ 6-12、Warshel ε、Born 溶剂化都是真实物理，但 σ=0.5Å、q2=-0.3 无文献来源 |
| CatalystDesignerEngine | `estimateStabilityDelta` | ⚠️ 声明误导 | BLOSUM62 是真实的，但注释说"calibrated against SKEMPI 2.0"——仓库里没有 SKEMPI 数据，系数 a=-0.25/b=-0.1 是硬编码 |
| CatalystDesignerEngine | `balancePathway` | 🔴 标签错误 | 实际是 Newton-Raphson 迭代 MM 通量平衡，docstring 写"Church-method"是错误的 |
| CatalystDesignerEngine | `designSequences` | ✅ 真实 | BLOSUM62 概率、Boltzmann 采样、S. cerevisiae 密码子表都是真实的 |
| CatalystDesignerEngine | `rankPathways` | ✅ 真实 | Pareto 支配矩阵数学正确 |
| CatalystDesignerEngine | `predictMutagenesisSites` | ⚠️ 简化 | BLOSUM62 Shannon 熵保守性是真实的；但序列距离代替 3D 距离、`i % 4` 代替真实 SASA 是已知局限 |
| CatalystDesignerEngine | `evaluateThermodynamics` | ✅ 真实 | 正确读取 CETHX 数据，5 kJ/mol 阈值是标准值 |
| CatalystDesignerEngine | `identifyBottlenecks` | ⚠️ 启发式权重 | FBA + thermo + experimental 三因子加权合理，但 0.4/0.3/0.3 权重没有文献依据，默认值 0.3/0.5 是任意的 |
| kineticsEngine | `estimateParameters` | ✅ 真实 | Levenberg-Marquardt 算法完整实现，Jacobian 计算正确，这是真实的非线性拟合 |
| kineticsEngine | 其他函数 | ✅ 真实 | 竞争性/非竞争性/混合抑制公式是教科书标准 |
| eyringKinetics | 所有函数 | ✅ 真实 | Eyring 方程、Arrhenius、pH 修正均正确 |
| CatalystViewer3D | 3D 渲染 | ✅ 真实 | 真实调用 AlphaFold EBI API + RCSB PDB + PubChem SDF，用 3Dmol.js 渲染 |
| /api/alphafold | 路由 | ✅ 真实 | 代理 alphafold.ebi.ac.uk，有 SSRF 白名单保护，有 fallback |
| /api/pubchem | 路由 | ✅ 真实 | 真实调用 PubChem REST API 获取 SDF 结构 |
| /api/docking | 路由 | 🔴 完全 mock | 对 `${proteinPdbId}:${ligandSmiles}` 做字符串哈希映射到 -3~-12 kcal/mol，与分子结构完全无关 |
| brendaClient | 数据库 | 🔴 17条硬编码 | MOCK_KINETICS 只有 17 个 EC 号，其他全部 fallback 到 kcat=10/km=0.5/vmax=5 |

---

## 任务 1 — 修复 `/api/docking`：用真实坐标替代字符串哈希

### 问题描述
`app/api/docking/route.ts` 第 55-72 行：对输入字符串做哈希然后映射到分数区间。用户输入不同的蛋白质和配体，结果完全取决于它们的**名字**而不是**分子结构**。一个合成生物学研究生把 P08836（淀粉酶）和葡萄糖放进去，得到的分数跟实际分子几何毫无关系。

### 修复目标
实现一个**真实的坐标基础的经验评分函数**——不要求达到 AutoDock Vina 的精度，但分数必须从真实 3D 原子坐标计算，对不同分子产生不同的、科学上有意义的结果。

### 具体实现步骤

**Step 1：理解现有的输入来源**

`CatalystViewer3D.tsx` 第 122-131 行和第 176 行已经在真实获取：
- 蛋白质结构：`/api/alphafold?id=${enzyme.uniprotId}` → AlphaFold PDB 文件（已经是真实的）
- 配体结构：`/api/pubchem?name=${substrate}` → PubChem SDF 文件（已经是真实的）

这两个数据源已经可用，问题在于 `/api/docking` 完全没有用这些真实结构。

**Step 2：修改 docking route，实现坐标基础的评分**

**文件**: `app/api/docking/route.ts`

修改 POST 处理函数，接受以下输入（修改调用端 `dockingClient.ts` 来传递这些参数）：
```typescript
// 新的 request body 结构
{
  proteinPdbId?: string;      // 保留向后兼容
  ligandSmiles?: string;      // 保留向后兼容
  proteinPdb?: string;        // 新增：真实 PDB 文件内容（从 alphafold route 获取）
  ligandSdf?: string;         // 新增：真实 SDF 文件内容（从 pubchem route 获取）
  uniprotId?: string;         // 新增：用于内部获取结构
  substrateSmiles?: string;   // 新增：SMILES 字符串
}
```

**Step 3：在 route.ts 里实现真实的经验评分函数**

在 TODO 注释处替换哈希逻辑，实现以下评分（注意：这是简化的经验打分，不是全原子 MM，但基于真实原子坐标）：

```typescript
/**
 * Empirical binding score from 3D coordinates.
 * 
 * Method: Distance-based contact scoring (Muegge & Martin 1999-style)
 * - Parse PDB ATOM records for protein active site residues
 * - Parse SDF atom block for ligand heavy atoms
 * - Count contacts within cutoff distances:
 *   - Hydrogen bond donors/acceptors: 2.5-3.5 Å → -1.5 to -2.5 kcal/mol per contact
 *   - Hydrophobic contacts (C-C): 3.5-5.0 Å → -0.5 to -1.0 kcal/mol per contact
 *   - Clashes (< 2.0 Å): +5.0 kcal/mol penalty each
 * - Apply desolvation penalty proportional to buried SASA
 * 
 * This is NOT AutoDock Vina-level accuracy, but:
 * - Returns different scores for different protein-ligand pairs
 * - Uses actual 3D atomic coordinates
 * - Based on the distance-dependent pair potential framework
 *   (Muegge & Martin, J Med Chem, 1999, 42:791)
 */
async function computeEmpiricalDockingScore(
  proteinPdb: string,
  ligandSdf: string,
): Promise<{ dockingScore: number; bindingEnergy: number; contactsFound: number; source: string }> {
  
  // Parse protein ATOM records (Cα and key side chain atoms only for speed)
  const proteinAtoms = parsePdbAtoms(proteinPdb);
  
  // Parse ligand heavy atoms from SDF
  const ligandAtoms = parseSdfAtoms(ligandSdf);
  
  if (proteinAtoms.length === 0 || ligandAtoms.length === 0) {
    throw new Error('Could not parse 3D coordinates from PDB/SDF');
  }
  
  // Find protein centroid (approximate binding site for scoring)
  // In production: would use known active site coordinates
  // Here: use center of mass of protein as proxy
  const cx = proteinAtoms.reduce((s, a) => s + a.x, 0) / proteinAtoms.length;
  const cy = proteinAtoms.reduce((s, a) => s + a.y, 0) / proteinAtoms.length;
  const cz = proteinAtoms.reduce((s, a) => s + a.z, 0) / proteinAtoms.length;
  
  // Score contacts between ligand atoms and nearby protein atoms (within 8 Å of centroid)
  const nearbyProtein = proteinAtoms.filter(a => 
    Math.sqrt((a.x-cx)**2 + (a.y-cy)**2 + (a.z-cz)**2) < 8.0
  );
  
  let score = 0;
  let contactCount = 0;
  
  for (const ligAtom of ligandAtoms) {
    for (const proAtom of nearbyProtein) {
      const d = Math.sqrt(
        (ligAtom.x - proAtom.x)**2 + 
        (ligAtom.y - proAtom.y)**2 + 
        (ligAtom.z - proAtom.z)**2
      );
      
      if (d < 2.0) {
        score += 5.0; // clash penalty
      } else if (d < 3.5 && isHBondPair(ligAtom.element, proAtom.element)) {
        score -= 2.0; // hydrogen bond
        contactCount++;
      } else if (d < 5.0 && isHydrophobicPair(ligAtom.element, proAtom.element)) {
        score -= 0.7; // hydrophobic contact
        contactCount++;
      }
    }
  }
  
  // Clamp to realistic docking score range
  const dockingScore = Math.max(-15.0, Math.min(5.0, score));
  const bindingEnergy = dockingScore * 1.15;
  
  return {
    dockingScore: Math.round(dockingScore * 100) / 100,
    bindingEnergy: Math.round(bindingEnergy * 100) / 100,
    contactsFound: contactCount,
    source: 'empirical_contact_scoring_v1', // 不再返回 'mock'
  };
}
```

**PDB 解析函数**（在同一文件里实现，edge runtime 兼容，不依赖任何 npm 包）：
```typescript
function parsePdbAtoms(pdb: string): Array<{x: number; y: number; z: number; element: string}> {
  const atoms: Array<{x: number; y: number; z: number; element: string}> = [];
  for (const line of pdb.split('\n')) {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;
    // PDB fixed-width columns: x=30-38, y=38-46, z=46-54, element=76-78
    const x = parseFloat(line.substring(30, 38));
    const y = parseFloat(line.substring(38, 46));
    const z = parseFloat(line.substring(46, 54));
    const element = (line.substring(76, 78).trim() || line.substring(12, 14).trim().replace(/[0-9]/g, ''))[0];
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      atoms.push({ x, y, z, element: element.toUpperCase() });
    }
  }
  return atoms;
}

function parseSdfAtoms(sdf: string): Array<{x: number; y: number; z: number; element: string}> {
  const atoms: Array<{x: number; y: number; z: number; element: string}> = [];
  const lines = sdf.split('\n');
  // Line 4 is the counts line: aaabbblllfffcccsssxxxrrrpppiiimmmvvvvvv
  const countsLine = lines[3];
  if (!countsLine) return atoms;
  const numAtoms = parseInt(countsLine.substring(0, 3).trim());
  // Atom block starts at line 4 (0-indexed)
  for (let i = 4; i < 4 + numAtoms && i < lines.length; i++) {
    const line = lines[i];
    const x = parseFloat(line.substring(0, 10));
    const y = parseFloat(line.substring(10, 20));
    const z = parseFloat(line.substring(20, 30));
    const element = line.substring(31, 34).trim();
    if (!isNaN(x) && !isNaN(y) && !isNaN(z) && element) {
      atoms.push({ x, y, z, element: element.toUpperCase() });
    }
  }
  return atoms;
}

function isHBondPair(elem1: string, elem2: string): boolean {
  const donors = new Set(['N', 'O', 'S']);
  return donors.has(elem1) && donors.has(elem2);
}

function isHydrophobicPair(elem1: string, elem2: string): boolean {
  return elem1 === 'C' && elem2 === 'C';
}
```

**Step 4：修改调用端 `src/services/database/dockingClient.ts`**

让客户端先获取真实的 PDB/SDF 内容，再传给 docking route：
```typescript
export async function runDocking(
  proteinPdbId: string,
  ligandSmiles: string,
  options?: { uniprotId?: string; substrateSmiles?: string }
): Promise<FallbackResult<DockingResult>> {
  return fetchWithFallback(
    async () => {
      // Step 1: 获取真实蛋白质结构（如果有 uniprotId 优先用 AlphaFold）
      let proteinPdb: string | undefined;
      if (options?.uniprotId) {
        const afRes = await fetch(`/api/alphafold?id=${options.uniprotId}`);
        if (afRes.ok) proteinPdb = await afRes.text();
      }
      
      // Step 2: 获取真实配体结构
      let ligandSdf: string | undefined;
      if (ligandSmiles || options?.substrateSmiles) {
        const name = encodeURIComponent(options?.substrateSmiles || ligandSmiles);
        const pcRes = await fetch(`/api/pubchem?name=${name}`);
        if (pcRes.ok) ligandSdf = await pcRes.text();
      }
      
      // Step 3: 调用 docking route，传递真实结构
      const res = await fetch('/api/docking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          proteinPdbId, 
          ligandSmiles,
          proteinPdb,    // 新增
          ligandSdf,     // 新增
        }),
        signal: AbortSignal.timeout(30000),
      });
      // ...existing response handling
    },
    // fallback 保持现状，但 source 改为 'mock_no_structure'
  );
}
```

**Step 5：在 CatalystDesignerPage.tsx 里调用 runDocking 时传递 uniprotId 和 substrate**

找到 `runDocking` 的调用位置（约第 46 行附近 import，调用处在 stage 2/3 的计算函数里），确保传递：
```typescript
const dockingResult = await runDocking(
  enzyme.pdbId || '',
  enzyme.substrate,
  { uniprotId: enzyme.uniprotId, substrateSmiles: enzyme.substrate }
);
```

### VERIFY 标准
```
[ ] /api/docking 的 route.ts 里已无字符串哈希逻辑
[ ] 返回的 result.source 是 'empirical_contact_scoring_v1'，不是 'mock'
[ ] 对两个不同蛋白质（不同 UniProt ID）+同一配体，返回的 dockingScore 数值不同
[ ] 对同一蛋白质+两种不同分子量配体，dockingScore 数值不同
[ ] contactsFound > 0（证明真正找到了原子接触，不是空结算）
[ ] 在 CatalystDesignerPage 的 console 里能看到 source: 'empirical_contact_scoring_v1'
```

---

## 任务 2 — 修复 `brendaClient.ts`：接入 SABIO-RK 真实动力学数据库

### 问题描述
`src/services/database/brendaClient.ts` 第 10-24 行：只有 17 个 EC 号的硬编码动力学参数。其余所有 EC 号 fallback 到 `{ km: 0.5, kcat: 10, vmax: 5 }`——这些默认值对任何酶都是错的。

### 修复目标
接入 **SABIO-RK**（Systems Biology of the Reaction Kinetics，海德堡研究中心）的免费 REST API。SABIO-RK 是目前覆盖最全的开放访问酶动力学数据库，无需注册。

### API 信息
```
Base URL: https://sabiork.h-its.org/sabioRestWebServices
EC Number 查询: /searchKineticLaws/booleanSearch?q=ECNumber:{ec_number}&format=json
返回字段: kineticLaw, kineticParameter (包含 Km, kcat, Vmax)
文档: https://sabiork.h-its.org/layouts/content/document/SABIO-RK_REST_webservices_documentation.pdf
```

### 实现步骤

**Step 1：新建 SABIO-RK proxy route**

**文件**: `app/api/sabio/route.ts`（新建）
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';

export const runtime = 'edge';

// EC number validation
const EC_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

export async function OPTIONS(req: NextRequest) { return handleOptions(req); }

export async function GET(req: NextRequest) {
  const ecNumber = req.nextUrl.searchParams.get('ec');
  const corsHeaders = getCorsHeaders(req);
  
  if (!ecNumber || !EC_PATTERN.test(ecNumber)) {
    return errorResponse('Invalid EC number format (expected x.x.x.x)', 400, undefined, corsHeaders);
  }
  
  try {
    // SABIO-RK REST API — open access, no auth required
    const url = `https://sabiork.h-its.org/sabioRestWebServices/searchKineticLaws/booleanSearch?` +
      `q=ECNumber:${encodeURIComponent(ecNumber)}&format=json&fields[]=ECNumber&` +
      `fields[]=Parameter&fields[]=EnzymeType&fields[]=Organism&limit=10`;
    
    const res = await fetch(url, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'NexusBio/1.0 (academic-research; contact@nexus-bio.vercel.app)'
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!res.ok) {
      return errorResponse(`SABIO-RK returned ${res.status}`, 502, undefined, corsHeaders);
    }
    
    const data = await res.json();
    
    // Parse SABIO-RK response format to extract Km and kcat
    // Response: array of kinetic law entries, each with Parameter array
    const kineticParams = parseSabioKineticLaws(data, ecNumber);
    
    return NextResponse.json(
      { ok: true, ...kineticParams, source: 'sabio_rk', ecNumber },
      { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' } }
    );
    
  } catch (err) {
    return errorResponse('SABIO-RK fetch failed', 502, undefined, corsHeaders);
  }
}

function parseSabioKineticLaws(
  data: unknown,
  _ecNumber: string,
): { km: number; kcat: number; vmax: number; organism?: string; entryCount: number } {
  
  if (!Array.isArray(data) || data.length === 0) {
    // No entries found in SABIO-RK for this EC number
    return { km: NaN, kcat: NaN, vmax: NaN, entryCount: 0 };
  }
  
  const kmValues: number[] = [];
  const kcatValues: number[] = [];
  const vmaxValues: number[] = [];
  
  for (const entry of data) {
    if (!Array.isArray(entry?.Parameter)) continue;
    for (const param of entry.Parameter) {
      const name: string = (param.Name || '').toLowerCase();
      const val = parseFloat(param.StartValue || param.Value || '');
      if (isNaN(val) || val <= 0) continue;
      
      if (name.includes('km') || name.includes('michaelis')) kmValues.push(val);
      else if (name.includes('kcat') || name === 'catalytic rate constant') kcatValues.push(val);
      else if (name.includes('vmax') || name.includes('maximum velocity')) vmaxValues.push(val);
    }
  }
  
  // Use median to be robust against outliers
  const median = (arr: number[]) => {
    if (arr.length === 0) return NaN;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  
  const organism = data[0]?.Organism || undefined;
  
  return {
    km: Math.round(median(kmValues) * 1000) / 1000,
    kcat: Math.round(median(kcatValues) * 1000) / 1000,
    vmax: Math.round(median(vmaxValues) * 1000) / 1000,
    organism,
    entryCount: data.length,
  };
}
```

**Step 2：修改 `src/services/database/brendaClient.ts`**

```typescript
import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface BRENDAKinetics {
  km: number;       // mM
  kcat: number;     // s⁻¹
  vmax: number;     // µmol/min/mg
  organism?: string;
  entryCount?: number;
  source?: 'sabio_rk' | 'brenda_local' | 'default_fallback';
}

// Local reference table — kept as NAMED fallback (not default), 
// only used when SABIO-RK is unreachable
// Source: manually curated from BRENDA/literature for common enzymes
const BRENDA_LOCAL_REFERENCE: Record<string, BRENDAKinetics> = {
  // 保留现有 17 条，但明确标注 source
  '1.1.1.1':  { km: 0.32, kcat: 4.3,  vmax: 17.2, organism: 'S. cerevisiae', source: 'brenda_local' },
  '1.1.1.27': { km: 0.22, kcat: 6.8,  vmax: 24.1, organism: 'E. coli',       source: 'brenda_local' },
  '2.7.1.1':  { km: 0.11, kcat: 9.2,  vmax: 31.4, organism: 'E. coli',       source: 'brenda_local' },
  // ... 其余 14 条保持不变，都加上 source: 'brenda_local'
};

export async function getBRENDAKinetics(ecNumber: string): Promise<FallbackResult<BRENDAKinetics>> {
  return fetchWithFallback(
    async () => {
      // Primary: SABIO-RK live API
      const res = await fetch(`/api/sabio?ec=${encodeURIComponent(ecNumber)}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`SABIO-RK proxy returned ${res.status}`);
      
      const data = await res.json();
      if (!data.ok) throw new Error('SABIO-RK returned error');
      
      // If SABIO-RK has no entries, fall through to local reference
      if (data.entryCount === 0 || isNaN(data.km)) {
        throw new Error(`No SABIO-RK entries for EC ${ecNumber}`);
      }
      
      return {
        km: data.km,
        kcat: data.kcat,
        vmax: data.vmax,
        organism: data.organism,
        entryCount: data.entryCount,
        source: 'sabio_rk',
      };
    },
    () => {
      // Fallback 1: local BRENDA reference table
      if (BRENDA_LOCAL_REFERENCE[ecNumber]) {
        return BRENDA_LOCAL_REFERENCE[ecNumber];
      }
      // Fallback 2: 明确标记的默认值（不再静默返回）
      // Note: these are order-of-magnitude placeholders only
      // Caller should check source === 'default_fallback' and warn the user
      return {
        km: 0.5, kcat: 10, vmax: 5,
        source: 'default_fallback',
      };
    }
  );
}
```

**Step 3：在 CatalystDesignerPage 的 BRENDA 调用处，检查 source 并展示**

找到 `getBRENDAKinetics` 的使用位置（约第 44 行 import，调用在计算函数里），添加：
```typescript
const brendaResult = await getBRENDAKinetics(enzyme.ecNumber);
if (brendaResult.result?.source === 'default_fallback') {
  // 在 UI 里显示 DataSourceBadge 警告：
  // "Kinetic parameters: estimated defaults — EC {ecNumber} not found in SABIO-RK or local reference"
  setKineticsDataSource('default');
} else if (brendaResult.result?.source === 'brenda_local') {
  setKineticsDataSource('local_reference');
} else {
  setKineticsDataSource('sabio_rk_live');  // source: 'sabio_rk'
}
```

### VERIFY 标准
```
[ ] /api/sabio 路由存在且能响应 EC 1.1.1.1 的 GET 请求
[ ] 对 EC 1.1.1.1（Alcohol dehydrogenase），SABIO-RK 返回的 km 值落在 0.01-5 mM 区间（文献范围）
[ ] 对 EC 99.99.99.99（不存在的EC号），返回 entryCount: 0，不 crash
[ ] 对返回 source === 'default_fallback' 的情况，UI 里出现明确的数据源警告
[ ] SABIO-RK 超时（10s）时，自动 fallback 到本地表，不影响页面渲染
```

---

## 任务 3 — 修复文档错误：移除"Church-method"标签 + 修正"SKEMPI calibrated"声明

### 3a — `balancePathway` 的 docstring 错误

**文件**: `src/services/CatalystDesignerEngine.ts`  
**位置**: `balancePathway` 函数上方的 JSDoc，以及文件头注释第 7 行

**当前错误文本**:
```
// 4. Church-method pathway balancer for zero intermediate accumulation
```
和 JSDoc：
```
 * Church-method pathway balancer for zero intermediate accumulation
```

**实际实现**: Newton-Raphson 迭代的 Michaelis-Menten 通量平衡。具体是：
1. 正向传播：用当前浓度算每步 MM 通量
2. NR 步骤：调整中间体浓度消除通量残差（正确的 NR Jacobian 近似）
3. 表达量调节：smoothly 更新 expressionMultiplier 追踪 targetFlux

这是合法的数值方法，不需要外部权威来背书，更不应该借用 Church 实验室的名字。

**修改**:
```typescript
// 文件头注释第 7 行改为:
// 4. Newton-Raphson pathway flux balancer for zero intermediate accumulation

// balancePathway JSDoc 改为:
/**
 * Balance a multi-enzyme pathway to eliminate intermediate accumulation
 * using Newton-Raphson iteration over Michaelis-Menten flux equations.
 *
 * Algorithm:
 *  1. Forward pass: compute flux at each step with current [S]
 *  2. Newton-Raphson update: adjust [S_i] to reduce flux residual (v_i - v_{i+1})
 *     using Jacobian approximation ∂v/∂[S] = kcat·E·Km / (Km + [S])²
 *  3. Expression update: smooth adjustment of expressionMultiplier to track targetFlux
 *  4. Convergence: ||ΔS|| < 1e-4 or maxIter=100
 *
 * Note: This is a custom numerical method, not the Church lab's MAGE protocol.
 * The "Church-method" label in earlier versions was incorrect.
 */
```

### 3b — `estimateStabilityDelta` 的错误声明

**文件**: `src/services/CatalystDesignerEngine.ts`  
**位置**: 第 466-468 行

**当前错误注释**:
```typescript
// Coefficients calibrated against SKEMPI 2.0 dataset
// a = -0.25 kcal/mol per BLOSUM62 unit
// b = -0.1 kcal/mol intercept (slight destabilizing baseline)
```

**实际情况**: 仓库里没有 SKEMPI 数据，这两个系数是硬编码的经验值。

**修改**:
```typescript
// Empirical linear model: ΔΔG ≈ a × BLOSUM62(wt, mut) + b
// Coefficients: a = -0.25 kcal/mol per BLOSUM62 unit, b = -0.1 kcal/mol
//
// Physical rationale: negative BLOSUM62 scores indicate rare substitutions
// that typically destabilize proteins; a = -0.25 gives ~1 kcal/mol
// destabilization per -4 BLOSUM62 unit step, consistent with typical
// single-mutation ΔΔG magnitudes (Guerois et al. 2002, J Mol Biol 320:369).
//
// Limitation: SKEMPI 2.0 (Jankauskaite et al. 2019) calibrated models 
// achieve better accuracy (R ≈ 0.6-0.7) but require per-mutation structural
// features. This linear BLOSUM approximation gives only qualitative ΔΔG
// estimates (±2 kcal/mol typical error). Do not use for quantitative predictions.
```

### VERIFY 标准
```
[ ] grep "Church-method" src/services/CatalystDesignerEngine.ts → 0 results
[ ] grep "SKEMPI 2.0 dataset" src/services/CatalystDesignerEngine.ts → 0 results  
[ ] 新注释里包含 "Guerois et al. 2002" 引用（用于替代 SKEMPI 声明）
[ ] 新 balancePathway JSDoc 里包含 "Newton-Raphson" 字样
```

---

## 任务 4 — 补充 `predictMutagenesisSites` 的已知局限文档

这个函数的算法是真实的（BLOSUM62 Shannon 熵），但有两个已知的简化被完全隐藏了。不需要修改实现（因为在浏览器端做真实 SASA 计算不现实），但必须在文档和 validity badge 里诚实说明。

**文件**: `src/services/CatalystDesignerEngine.ts`  
**在 `predictMutagenesisSites` 的 JSDoc 里追加**:
```typescript
 * Known limitations:
 * 1. Structural importance uses SEQUENCE distance to nearest catalytic residue
 *    (Math.abs(i - cPos)) as a proxy for 3D distance. This can misidentify
 *    residues that are distant in sequence but close in 3D structure.
 *    A real implementation would use actual PDB Cα coordinates.
 *
 * 2. Surface accessibility uses a heuristic based on sequence position modulo 4
 *    (approximating α-helix surface exposure) rather than real SASA calculation.
 *    Real SASA would require 3D coordinates and a rolling-sphere algorithm.
 *
 * Validation status: Shannon entropy-based conservation is validated
 *    (correlates with evolutionary conservation in MSA studies); structural
 *    and surface approximations are engineering heuristics only.
```

**identifyBottlenecks 的权重同理**，在其 JSDoc 里追加：
```typescript
 * Note on composite weights (0.4 FBA / 0.3 thermo / 0.3 experimental):
 * These weights are empirically chosen to emphasize metabolic data.
 * No published calibration study supports these specific values.
 * When only one data source is available, the other factors use
 * conservative defaults (0.3/0.5) that should be interpreted qualitatively only.
```

---

## 任务 5 — 更新 `toolValidity.ts` 的 catdes 条目

**文件**: `src/config/toolValidity.ts`

**当前条目**（不完整）:
```typescript
catdes: { level: 'partial', caption: 'Distance / orientation / VdW / electrostatic scoring is real (Warshel ε); residue weights are curated reference values.' }
```

**任务 1-4 全部完成后**，更新为：
```typescript
catdes: {
  level: 'partial',
  caption: [
    'Real: LJ 6-12 VdW + Warshel distance-dependent electrostatics + Born solvation + SASA (predictBindingAffinity); ',
    'Real: Levenberg-Marquardt kinetic parameter fitting (kineticsEngine); ',
    'Real: Eyring transition-state thermodynamics (eyringKinetics); ',
    'Real: BLOSUM62 sequence design + S. cerevisiae codon optimization (designSequences); ',
    'Real: Pareto dominance ranking (rankPathways); ',
    'Real: AlphaFold EBI + RCSB PDB 3D structure rendering (CatalystViewer3D); ',
    'Real: PubChem SDF ligand structure + coordinate-based docking score (post-Task1 fix); ',
    'Real: SABIO-RK live kinetic data (post-Task2 fix, with local BRENDA fallback); ',
    'Partial: Mutagenesis site prediction uses sequence-distance proxy for 3D distance (see JSDoc); ',
    'Partial: Bottleneck weights (0.4/0.3/0.3) are empirically chosen, not calibrated; ',
    'Partial: ΔΔG stability uses linear BLOSUM62 model (±2 kcal/mol error, Guerois 2002 rationale); ',
    'Fixed (was wrong): balancePathway is Newton-Raphson flux balancer, not "Church-method".',
  ].join('')
}
```

---

## 完成后的汇报格式（给 Zhang Ze review 用）

完成所有 5 个任务后，输出以下格式的汇报：

```
## CatDes 修复汇报

### 任务状态
| 任务 | 状态 | 关键证据 |
|------|------|---------|
| Task 1: docking (坐标基础评分) | DONE/FAIL | source 字段截图 + 两个不同蛋白对比数值 |
| Task 2: SABIO-RK 接入 | DONE/FAIL | EC 1.1.1.1 API 真实返回截图 + km 数值 |
| Task 3: 文档错误修正 | DONE/FAIL | grep 结果证明已移除 |
| Task 4: 局限声明追加 | DONE/FAIL | 新 JSDoc 片段 |
| Task 5: toolValidity 更新 | DONE/FAIL | git diff 片段 |

### CatDes 现有引擎完整框架（修复后）

[在此处插入修复后每个引擎的最终 validity 状态]

### 仍未解决的问题（如有）

[列出任何未完成的项，说明原因]

### 建议的下一步（给 CatDes UI 重设计提供输入）

[修复完成后，CatDes 真正可以做什么，对 UI 设计有什么影响]
```
