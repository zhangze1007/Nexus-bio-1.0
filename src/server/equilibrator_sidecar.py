#!/usr/bin/env python3
"""
eQuilibrator Sidecar for Nexus-Bio CETHX
Provides condition-aware thermodynamic calculations using the eQuilibrator API.

Usage:
    python3 equilibrator_sidecar.py --port 5001

API Endpoints:
    POST /calculate  - Calculate ΔG' for reactions at specified conditions
    POST /search     - Search for compounds by name
    GET  /health     - Health check

Environment:
    No API keys required - eQuilibrator is free and open source (MIT license)

References:
    - eQuilibrator 3 (Beber et al. 2022, Nucleic Acids Research)
    - Alberty (2003) Thermodynamics of Biochemical Reactions
"""

import json
import sys
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, List, Optional, Any
import urllib.parse

# Try to import equilibrator_api
try:
    from equilibrator_api import ComponentContribution, Q_
    EQUILIBRATOR_AVAILABLE = True
except ImportError:
    EQUILIBRATOR_AVAILABLE = False
    print("WARNING: equilibrator-api not installed. Run: pip install equilibrator-api", file=sys.stderr)

# Global component contribution instance (lazy initialization)
_cc: Optional[Any] = None

def get_cc() -> Any:
    """Lazy initialization of ComponentContribution."""
    global _cc
    if _cc is None:
        if not EQUILIBRATOR_AVAILABLE:
            raise RuntimeError("equilibrator-api not installed")
        _cc = ComponentContribution()
    return _cc

def calculate_dg_prime(
    reaction_formula: str,
    ph: float = 7.0,
    ionic_strength: float = 0.25,
    temperature: float = 298.15,
    pmg: float = 3.0
) -> Dict[str, Any]:
    """
    Calculate standard transformed Gibbs energy (ΔG'°) for a reaction.

    Args:
        reaction_formula: Reaction in format "kegg:C00002 + kegg:C00001 = kegg:C00008 + kegg:C00009"
        ph: pH value (default 7.0)
        ionic_strength: Ionic strength in M (default 0.25)
        temperature: Temperature in K (default 298.15 = 25°C)
        pmg: pMg value (default 3.0)

    Returns:
        Dictionary with dG_prime, uncertainty, and metadata
    """
    cc = get_cc()

    # Set conditions
    cc.p_h = Q_(ph)
    cc.ionic_strength = Q_(f"{ionic_strength}M")
    cc.temperature = Q_(f"{temperature}K")
    cc.p_mg = Q_(pmg)

    # Parse reaction
    try:
        reaction = cc.parse_reaction_formula(reaction_formula)
    except Exception as e:
        return {"error": f"Failed to parse reaction: {str(e)}"}

    # Check balance
    if not reaction.is_balanced():
        return {"error": "Reaction is not elementally balanced", "balanced": False}

    # Calculate ΔG'°
    try:
        dg_prime = cc.standard_dg_prime(reaction)
        value_kj = dg_prime.value.m_as("kJ/mol")
        error_kj = dg_prime.error.m_as("kJ/mol")

        # Also get physiological ΔG' (1 mM concentrations)
        dg_phys = cc.physiological_dg_prime(reaction)
        value_phys_kj = dg_phys.value.m_as("kJ/mol")
        error_phys_kj = dg_phys.error.m_as("kJ/mol")

        return {
            "dG_prime": round(float(value_kj), 2),
            "dG_prime_uncertainty": round(float(error_kj), 2),
            "dG_prime_units": "kJ/mol",
            "dG_physiological": round(float(value_phys_kj), 2),
            "dG_physiological_uncertainty": round(float(error_phys_kj), 2),
            "conditions": {
                "pH": ph,
                "ionic_strength_M": ionic_strength,
                "temperature_K": temperature,
                "pMg": pmg
            },
            "balanced": True,
            "source": "eQuilibrator 3 (ComponentContribution)"
        }
    except Exception as e:
        return {"error": f"Calculation failed: {str(e)}"}

def search_compound(query: str) -> Dict[str, Any]:
    """
    Search for a compound by name.

    Args:
        query: Compound name or identifier

    Returns:
        Dictionary with compound information
    """
    cc = get_cc()

    try:
        compound = cc.search_compound(query)
        if compound is None:
            return {"error": f"Compound not found: {query}"}

        return {
            "id": compound.id,
            "name": compound.name,
            "formula": compound.formula,
            "inchi": compound.inchi if hasattr(compound, 'inchi') else None,
            "source": "eQuilibrator"
        }
    except Exception as e:
        return {"error": f"Search failed: {str(e)}"}

class EquilibratorHandler(BaseHTTPRequestHandler):
    """HTTP request handler for eQuilibrator sidecar."""

    def do_GET(self):
        """Handle GET requests."""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {
                "status": "ok",
                "equilibrator_available": EQUILIBRATOR_AVAILABLE,
                "service": "equilibrator-sidecar"
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        """Handle POST requests."""
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode())
            return

        if self.path == '/calculate':
            response = self._handle_calculate(data)
        elif self.path == '/search':
            response = self._handle_search(data)
        else:
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _handle_calculate(self, data: Dict) -> Dict:
        """Handle /calculate endpoint."""
        reaction = data.get('reaction')
        if not reaction:
            return {"error": "Missing 'reaction' field"}

        ph = data.get('pH', 7.0)
        ionic_strength = data.get('ionic_strength', 0.25)
        temperature = data.get('temperature', 298.15)
        pmg = data.get('pMg', 3.0)

        return calculate_dg_prime(reaction, ph, ionic_strength, temperature, pmg)

    def _handle_search(self, data: Dict) -> Dict:
        """Handle /search endpoint."""
        query = data.get('query')
        if not query:
            return {"error": "Missing 'query' field"}

        return search_compound(query)

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass

def main():
    parser = argparse.ArgumentParser(description='eQuilibrator Sidecar Server')
    parser.add_argument('--port', type=int, default=5001, help='Port to listen on')
    parser.add_argument('--host', type=str, default='localhost', help='Host to bind to')
    args = parser.parse_args()

    server = HTTPServer((args.host, args.port), EquilibratorHandler)
    print(f"eQuilibrator sidecar listening on {args.host}:{args.port}")
    print(f"eQuilibrator available: {EQUILIBRATOR_AVAILABLE}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()

if __name__ == '__main__':
    main()
