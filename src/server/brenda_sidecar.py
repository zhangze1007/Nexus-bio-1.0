#!/usr/bin/env python3
"""
BRENDA Enzyme Database Sidecar for Nexus-Bio
Provides real enzyme kinetics parameters (Km, kcat, Vmax) from BRENDA.

Usage:
    python3 brenda_sidecar.py --port 5002

Environment Variables:
    BRENDA_EMAIL    - Registered BRENDA email
    BRENDA_PASSWORD - BRENDA password (will be hashed to SHA-256)

API Endpoints:
    POST /kinetics  - Get Km, kcat, Ki for an enzyme
    POST /conditions - Get temperature/pH optima
    GET  /health    - Health check

References:
    - BRENDA: Chang et al. (2021) Nucleic Acids Res. 49:D498-D508
    - Eyring (1935) J. Chem. Phys. 3:107-115
"""

import json
import sys
import os
import hashlib
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, List, Optional, Any

# Try to import zeep for SOAP
try:
    from zeep import Client
    ZEEP_AVAILABLE = True
except ImportError:
    ZEEP_AVAILABLE = False
    print("WARNING: zeep not installed. Run: pip install zeep", file=sys.stderr)

# BRENDA SOAP endpoint
BRENDA_WSDL = 'https://www.brenda-enzymes.org/soap/brenda_zeep.wsdl'

# Global client instance (lazy initialization)
_client: Optional[Any] = None
_email: Optional[str] = None
_password_hash: Optional[str] = None

def get_brenda_client() -> Any:
    """Lazy initialization of BRENDA SOAP client."""
    global _client, _email, _password_hash

    if _client is None:
        if not ZEEP_AVAILABLE:
            raise RuntimeError("zeep not installed")

        _email = os.environ.get('BRENDA_EMAIL')
        _password = os.environ.get('BRENDA_PASSWORD')

        if not _email or not _password:
            raise RuntimeError("BRENDA_EMAIL and BRENDA_PASSWORD environment variables required")

        _password_hash = hashlib.sha256(_password.encode()).hexdigest()
        _client = Client(BRENDA_WSDL)

    return _client

def parse_brenda_response(result_string: str) -> List[Dict[str, str]]:
    """Parse BRENDA SOAP response into list of dictionaries."""
    if not result_string or result_string.strip() == '':
        return []

    records = []
    entries = result_string.strip().rstrip('!').split('!')

    for entry in entries:
        if not entry.strip():
            continue
        fields = {}
        for field in entry.split('#'):
            if '*' in field:
                key, value = field.split('*', 1)
                fields[key] = value
        if fields:
            records.append(fields)

    return records

def get_kinetics(ec_number: str, organism: Optional[str] = None) -> Dict[str, Any]:
    """
    Get enzyme kinetics parameters from BRENDA.

    Args:
        ec_number: EC number (e.g., "2.7.1.1")
        organism: Optional organism filter (e.g., "Homo sapiens")

    Returns:
        Dictionary with Km, kcat, Ki values and metadata
    """
    client = get_brenda_client()

    # Build parameters
    params = [_email, _password_hash, f"ecNumber*{ec_number}*"]
    if organism:
        params.append(f"organism*{organism}*")

    # Query Km values
    km_result = client.service.getKmValue(*params)
    km_records = parse_brenda_response(km_result)

    # Query kcat (turnover number)
    kcat_result = client.service.getTurnoverNumber(*params)
    kcat_records = parse_brenda_response(kcat_result)

    # Query Ki values
    ki_result = client.service.getKiValue(*params)
    ki_records = parse_brenda_response(ki_result)

    # Query specific activity
    sa_result = client.service.getSpecificActivity(*params)
    sa_records = parse_brenda_response(sa_result)

    # Extract numeric values
    def extract_values(records: List[Dict], key: str) -> List[float]:
        values = []
        for r in records:
            try:
                v = r.get(key, '')
                if v and v.strip():
                    values.append(float(v))
            except (ValueError, TypeError):
                continue
        return values

    km_values = extract_values(km_records, 'kmValue')
    kcat_values = extract_values(kcat_records, 'turnoverNumber')
    ki_values = extract_values(ki_records, 'kiValue')
    sa_values = extract_values(sa_records, 'specificActivity')

    # Compute median values (more robust than mean)
    def median(values: List[float]) -> Optional[float]:
        if not values:
            return None
        sorted_v = sorted(values)
        n = len(sorted_v)
        if n % 2 == 0:
            return (sorted_v[n//2 - 1] + sorted_v[n//2]) / 2
        return sorted_v[n//2]

    # Get unique substrates
    substrates = list(set(r.get('substrate', '') for r in km_records if r.get('substrate')))

    return {
        'ecNumber': ec_number,
        'organism': organism,
        'km': {
            'median': median(km_values),
            'values': km_values[:10],  # Limit to 10 values
            'unit': 'mM',
            'substrates': substrates[:5],
            'n_observations': len(km_values),
        },
        'kcat': {
            'median': median(kcat_values),
            'values': kcat_values[:10],
            'unit': '1/s',
            'n_observations': len(kcat_values),
        },
        'ki': {
            'median': median(ki_values),
            'values': ki_values[:10],
            'unit': 'mM',
            'n_observations': len(ki_values),
        },
        'specificActivity': {
            'median': median(sa_values),
            'values': sa_values[:10],
            'unit': 'U/mg',
            'n_observations': len(sa_values),
        },
        'source': 'BRENDA',
        'citation': 'Chang et al. (2021) Nucleic Acids Res. 49:D498-D508',
    }

def get_conditions(ec_number: str, organism: Optional[str] = None) -> Dict[str, Any]:
    """
    Get temperature and pH optima from BRENDA.

    Args:
        ec_number: EC number
        organism: Optional organism filter

    Returns:
        Dictionary with temperature and pH optima
    """
    client = get_brenda_client()

    params = [_email, _password_hash, f"ecNumber*{ec_number}*"]
    if organism:
        params.append(f"organism*{organism}*")

    # Query temperature optimum
    temp_result = client.service.getTemperatureOptimum(*params)
    temp_records = parse_brenda_response(temp_result)

    # Query pH optimum
    ph_result = client.service.getPhOptimum(*params)
    ph_records = parse_brenda_response(ph_result)

    # Extract values
    temp_values = []
    for r in temp_records:
        try:
            v = r.get('temperatureOptimum', '')
            if v and v.strip():
                temp_values.append(float(v))
        except (ValueError, TypeError):
            continue

    ph_values = []
    for r in ph_records:
        try:
            v = r.get('phOptimum', '')
            if v and v.strip():
                ph_values.append(float(v))
        except (ValueError, TypeError):
            continue

    def median(values: List[float]) -> Optional[float]:
        if not values:
            return None
        sorted_v = sorted(values)
        n = len(sorted_v)
        if n % 2 == 0:
            return (sorted_v[n//2 - 1] + sorted_v[n//2]) / 2
        return sorted_v[n//2]

    return {
        'ecNumber': ec_number,
        'organism': organism,
        'temperatureOptimum': {
            'median': median(temp_values),
            'values': temp_values[:10],
            'unit': '°C',
            'n_observations': len(temp_values),
        },
        'phOptimum': {
            'median': median(ph_values),
            'values': ph_values[:10],
            'unit': 'pH',
            'n_observations': len(ph_values),
        },
        'source': 'BRENDA',
    }

class BrendaHandler(BaseHTTPRequestHandler):
    """HTTP request handler for BRENDA sidecar."""

    def do_GET(self):
        """Handle GET requests."""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {
                "status": "ok",
                "zeep_available": ZEEP_AVAILABLE,
                "credentials_configured": bool(os.environ.get('BRENDA_EMAIL')),
                "service": "brenda-sidecar"
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

        if self.path == '/kinetics':
            response = self._handle_kinetics(data)
        elif self.path == '/conditions':
            response = self._handle_conditions(data)
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

    def _handle_kinetics(self, data: Dict) -> Dict:
        """Handle /kinetics endpoint."""
        ec_number = data.get('ecNumber')
        if not ec_number:
            return {"error": "Missing 'ecNumber' field"}

        organism = data.get('organism')

        try:
            return get_kinetics(ec_number, organism)
        except Exception as e:
            return {"error": f"BRENDA query failed: {str(e)}"}

    def _handle_conditions(self, data: Dict) -> Dict:
        """Handle /conditions endpoint."""
        ec_number = data.get('ecNumber')
        if not ec_number:
            return {"error": "Missing 'ecNumber' field"}

        organism = data.get('organism')

        try:
            return get_conditions(ec_number, organism)
        except Exception as e:
            return {"error": f"BRENDA query failed: {str(e)}"}

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass

def main():
    parser = argparse.ArgumentParser(description='BRENDA Sidecar Server')
    parser.add_argument('--port', type=int, default=5002, help='Port to listen on')
    parser.add_argument('--host', type=str, default='localhost', help='Host to bind to')
    args = parser.parse_args()

    server = HTTPServer((args.host, args.port), BrendaHandler)
    print(f"BRENDA sidecar listening on {args.host}:{args.port}")
    print(f"zeep available: {ZEEP_AVAILABLE}")
    print(f"Credentials configured: {bool(os.environ.get('BRENDA_EMAIL'))}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()

if __name__ == '__main__':
    main()
