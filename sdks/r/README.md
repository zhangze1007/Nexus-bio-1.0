# Nexus-Bio R SDK

R client for the [Nexus-Bio](https://nexus-bio-1-0.vercel.app) synthetic biology AI platform.

## Installation

```r
# Install dependencies
install.packages(c("R6", "httr2"))

# Install from local source
install.packages("./sdks/r", repos = NULL, type = "source")
```

## Quick Start

```r
library(nexusbio)

client <- NexusBioClient$new(api_key = "your-key")

# Check API health
health <- client$health()
cat(health$status)  # 'ok'

# AI research query
result <- client$analyze("Design an artemisinin biosynthesis pathway")
cat(result$candidates[[1]]$content$parts[[1]]$text)

# Run FBA simulation
fba <- client$run_fba(objective = "biomass", species = "ecoli")
cat(fba$growthRate)

# List inventory
strains <- client$list_inventory("strains")
cat("Found", strains$total, "strains")
```

## Error Handling

```r
library(nexusbio)

client <- NexusBioClient$new(api_key = "your-key")

tryCatch(
  {
    result <- client$analyze("test query")
  },
  error = function(e) {
    message(conditionMessage(e))
  }
)
```

## API Reference

| Method | Description |
|--------|-------------|
| `analyze(prompt, context, history, search_query)` | AI research query |
| `list_projects()` | List workbench projects |
| `run_fba(objective, species, mode, ...)` | Flux Balance Analysis |
| `list_inventory(item_type, ...)` | List inventory items |
| `create_inventory_item(item_type, data)` | Create inventory item |
| `health()` | API health check |
| `analyze_protein(uniprot_id)` | AlphaFold structure lookup |
| `lookup_molecule(name, cid)` | PubChem molecule lookup |
| `search_kegg(query)` | KEGG pathway search |

## Running Tests

```r
install.packages("testthat")
testthat::test_dir("./sdks/r/tests/testthat")
```
