# Nexus-Bio JavaScript/TypeScript SDK

JavaScript/TypeScript client for the [Nexus-Bio](https://nexus-bio-1-0.vercel.app) synthetic biology AI platform.

## Installation

```bash
npm install ./sdks/javascript
```

## Quick Start

```typescript
import { NexusBioClient } from 'nexus-bio';

const client = new NexusBioClient({ apiKey: 'your-key' });

// Check API health
const health = await client.health();
console.log(health.status); // 'ok'

// AI research query
const result = await client.analyze('Design an artemisinin biosynthesis pathway');
console.log(result.candidates?.[0]?.content?.parts?.[0]?.text);

// Run FBA simulation
const fba = await client.runFBA({ objective: 'biomass', species: 'ecoli' });
console.log(fba.growthRate);

// List inventory
const strains = await client.listInventory('strains');
console.log(`Found ${strains.total} strains`);
```

## Error Handling

```typescript
import { NexusBioClient, NexusBioError } from 'nexus-bio';

const client = new NexusBioClient({ apiKey: 'your-key' });

try {
  const result = await client.analyze('test query');
} catch (e) {
  if (e instanceof NexusBioError) {
    console.error(`API error (${e.statusCode}): ${e.message}`);
  }
}
```

## API Reference

| Method | Description |
|--------|-------------|
| `analyze(prompt, context?, options?)` | AI research query |
| `listProjects()` | List workbench projects |
| `runFBA(params?)` | Flux Balance Analysis |
| `listInventory(type, options?)` | List inventory items |
| `createInventoryItem(type, data)` | Create inventory item |
| `health()` | API health check |
| `analyzeProtein(uniprotId)` | AlphaFold structure lookup |
| `lookupMolecule({ name?, cid? })` | PubChem molecule lookup |
| `searchKEGG(query)` | KEGG pathway search |

## Running Tests

```bash
cd sdks/javascript
npm install
npm test
```

## Building

```bash
npm run build
```
