# Direction E: Python Reference Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Python reference implementation that can evaluate the same benchmark cases as the TypeScript runtime, proving the protocol is portable.

**Architecture:** Python stdlib-only implementation of the policy DSL evaluator and benchmark corpus. No external dependencies.

**Tech Stack:** Python 3.10+, stdlib only (json, unittest)

---

## Phase E1: Foundation

### Task E1.1: Create Python project structure

**Files:**
- Create: `reference_impl_py/` directory structure
- Create: `reference_impl_py/__init__.py`
- Create: `reference_impl_py/README.md`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p reference_impl_py/{evaluator,benchmarks,tests}
```

- [ ] **Step 2: Create README**

```markdown
# Python Reference Implementation

Minimal Python implementation of the Nexus-Bio trust runtime evaluator.
Uses only Python stdlib (no pip dependencies).

## Usage

```bash
python3 -m reference_impl_py.evaluate --corpus benchmarks/trust-benchmark-corpus.json
```

## What it implements

- Policy DSL evaluator (JSON-based)
- Benchmark case evaluation
- Expected label comparison
- Consistency report generation
```

- [ ] **Step 3: Commit**

```bash
git add reference_impl_py/
git commit -m "feat(ref-py): create Python reference implementation project structure"
```

---

### Task E1.2: Implement policy DSL evaluator

**Files:**
- Create: `reference_impl_py/evaluator/policy_evaluator.py`
- Create: `reference_impl_py/tests/test_policy_evaluator.py`

- [ ] **Step 1: Write failing test**

```python
import unittest
import json
from reference_impl_py.evaluator.policy_evaluator import evaluate_policy

class TestPolicyEvaluator(unittest.TestCase):
    def test_allow_when_all_gates_pass(self):
        policy = {"gates": [{"field": "validityTier", "op": "neq", "value": "demo"}]}
        context = {"validityTier": "partial"}
        result = evaluate_policy(policy, context)
        self.assertEqual(result["decision"], "ok")

    def test_block_when_gate_fails(self):
        policy = {"gates": [{"field": "validityTier", "op": "eq", "value": "demo"}]}
        context = {"validityTier": "demo"}
        result = evaluate_policy(policy, context)
        self.assertEqual(result["decision"], "blocked")

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Implement evaluator**

```python
# reference_impl_py/evaluator/policy_evaluator.py
"""Minimal policy DSL evaluator for Nexus-Bio trust runtime."""

def evaluate_policy(policy: dict, context: dict) -> dict:
    """Evaluate a policy against a context.
    
    Args:
        policy: Policy DSL object with 'gates' list
        context: Runtime context with field values
    
    Returns:
        dict with 'decision' ('ok', 'blocked', 'gated', 'demoOnly') and 'reasons'
    """
    gates = policy.get("gates", [])
    reasons = []
    
    for gate in gates:
        field = gate.get("field")
        op = gate.get("op")
        value = gate.get("value")
        actual = context.get(field)
        
        if not _evaluate_gate(op, actual, value):
            reasons.append(f"Gate failed: {field} {op} {value} (actual: {actual})")
    
    if not reasons:
        return {"decision": "ok", "reasons": []}
    
    return {"decision": "blocked", "reasons": reasons}

def _evaluate_gate(op: str, actual, expected) -> bool:
    """Evaluate a single gate condition."""
    if op == "eq":
        return actual == expected
    elif op == "neq":
        return actual != expected
    elif op == "in":
        return actual in expected
    elif op == "not_in":
        return actual not in expected
    elif op == "gte":
        return actual >= expected
    elif op == "lte":
        return actual <= expected
    else:
        return False
```

- [ ] **Step 3: Run tests**

Run: `python3 -m pytest reference_impl_py/tests/test_policy_evaluator.py -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add reference_impl_py/evaluator/ reference_impl_py/tests/
git commit -m "feat(ref-py): implement policy DSL evaluator"
```

---

### Task E1.3: Implement benchmark evaluator

**Files:**
- Create: `reference_impl_py/evaluator/benchmark_evaluator.py`
- Create: `reference_impl_py/tests/test_benchmark_evaluator.py`

- [ ] **Step 1: Implement benchmark case loading and evaluation**

Load benchmark corpus JSON, evaluate each case against the policy, compare with expected labels.

- [ ] **Step 2: Commit**

```bash
git add reference_impl_py/evaluator/benchmark_evaluator.py reference_impl_py/tests/
git commit -m "feat(ref-py): implement benchmark evaluator"
```

---

## Phase E2: Consistency Verification

### Task E2.1: Run Python evaluator against TypeScript benchmark corpus

**Files:**
- Modify: `reference_impl_py/evaluate.py` (CLI entry point)

- [ ] **Step 1: Create CLI that runs evaluation and outputs consistency report**

```bash
python3 -m reference_impl_py.evaluate --corpus benchmarks/trust-benchmark-corpus.json --output reports/python-consistency.json
```

- [ ] **Step 2: Commit**

```bash
git add reference_impl_py/evaluate.py
git commit -m "feat(ref-py): add CLI entry point for benchmark evaluation"
```

---

### Task E2.2: Add Python evaluation to CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add Python test step**

```yaml
python-ref:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
    - run: python3 -m pytest reference_impl_py/tests/ -v
    - run: python3 -m reference_impl_py.evaluate --corpus benchmarks/trust-benchmark-corpus.json
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Python reference implementation tests"
```
