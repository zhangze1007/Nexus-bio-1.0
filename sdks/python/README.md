# Nexus-Bio Python SDK

Python client for the [Nexus-Bio](https://nexus-bio-1-0.vercel.app) synthetic biology AI platform.

## Installation

```bash
pip install -e ./sdks/python
```

## Quick Start

```python
from nexus_bio import NexusBioClient

client = NexusBioClient(api_key="your-key")

# Check API health
health = client.health()
print(health.status)  # 'ok'

# AI research query
result = client.analyze("Design an artemisinin biosynthesis pathway")
print(result.text)

# Run FBA simulation
fba = client.run_fba(objective="biomass", species="ecoli")
print(fba.growth_rate)

# List inventory
strains = client.list_inventory("strains")
print(f"Found {strains.total} strains")
```

## Error Handling

```python
from nexus_bio import NexusBioClient, RateLimitError, AuthenticationError

client = NexusBioClient(api_key="your-key")

try:
    result = client.analyze("test query")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except AuthenticationError as e:
    print(f"Auth failed: {e}")
```

## API Reference

| Method | Description |
|--------|-------------|
| `analyze(prompt, context?, history?, search_query?)` | AI research query |
| `list_projects()` | List workbench projects |
| `run_fba(...)` | Flux Balance Analysis |
| `list_inventory(type, ...)` | List inventory items |
| `create_inventory_item(type, data)` | Create inventory item |
| `health()` | API health check |
| `analyze_protein(uniprot_id)` | AlphaFold structure lookup |
| `lookup_molecule(name?, cid?)` | PubChem molecule lookup |
| `search_kegg(query)` | KEGG pathway search |

## Running Tests

```bash
cd sdks/python
pip install -e ".[dev]"
pytest
```
