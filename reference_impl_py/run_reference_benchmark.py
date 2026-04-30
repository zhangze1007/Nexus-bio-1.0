#!/usr/bin/env python3
"""Entrypoint for the Python trust-runtime reference implementation."""

from __future__ import annotations

import sys
from pathlib import Path


if __package__ is None:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from nexus_trust_runtime.cli import main


if __name__ == "__main__":
    raise SystemExit(main())
