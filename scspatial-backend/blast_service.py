"""BLAST sequence screening service for biosafety checks."""
from __future__ import annotations
import gzip
import logging
import os
import shutil
import subprocess
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

BLAST_DB_DIR = os.environ.get("BLAST_DB_DIR", "/app/blast_databases")

# VFDB download URLs (try multiple mirrors)
VFDB_URLS = [
    "https://mgc.ac.cn/VFDB/SetA/VFDB_setA_nt.fasta.gz",
    "https://ccb-microbe.cs.uni-saarland.de/vfdb/VFDB_setA_nt.fasta.gz",
]

# CARD download URLs
CARD_URLS = [
    "https://card.mcmaster.ca/latest/data",
]


def ensure_vfdb_database() -> bool:
    """Download and format VFDB database if not already present."""
    db_path = os.path.join(BLAST_DB_DIR, "VFDB")
    if os.path.exists(f"{db_path}.nin") or os.path.exists(f"{db_path}.nsq"):
        return True

    os.makedirs(BLAST_DB_DIR, exist_ok=True)

    # Try downloading from each mirror
    fasta_gz = os.path.join(BLAST_DB_DIR, "VFDB_setA_nt.fasta.gz")
    downloaded = False

    for url in VFDB_URLS:
        try:
            logger.info(f"Downloading VFDB from {url}")
            urllib.request.urlretrieve(url, fasta_gz)
            downloaded = True
            break
        except Exception as e:
            logger.warning(f"Failed to download from {url}: {e}")
            continue

    if not downloaded:
        logger.error("Failed to download VFDB from all mirrors")
        return False

    # Decompress
    fasta_path = os.path.join(BLAST_DB_DIR, "VFDB_setA_nt.fasta")
    try:
        with gzip.open(fasta_gz, 'rb') as f_in:
            with open(fasta_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        os.unlink(fasta_gz)
    except Exception as e:
        logger.error(f"Failed to decompress VFDB: {e}")
        return False

    # Format for BLAST
    try:
        subprocess.run(
            ["makeblastdb", "-in", fasta_path, "-dbtype", "nucl",
             "-out", db_path, "-title", "VFDB Core"],
            capture_output=True, text=True, timeout=300,
        )
        os.unlink(fasta_path)
        logger.info("VFDB database formatted successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to format VFDB: {e}")
        return False


def ensure_card_database() -> bool:
    """Download and format CARD (Comprehensive Antibiotic Resistance Database) if not already present.

    The CARD download is a tar.gz archive containing multiple files. We look for
    the nucleotide FASTA file (``nucleotide_fasta_protein_homolog_model.fasta``
    or similar) and format it with ``makeblastdb``.

    If the download fails (e.g. due to authentication requirements or URL changes),
    a warning is logged and the function returns False without blocking the service.
    """
    db_path = os.path.join(BLAST_DB_DIR, "CARD")
    if os.path.exists(f"{db_path}.nin") or os.path.exists(f"{db_path}.nsq"):
        return True

    os.makedirs(BLAST_DB_DIR, exist_ok=True)

    # Download the CARD data archive
    import tarfile

    archive_path = os.path.join(BLAST_DB_DIR, "CARD_data.tar.gz")
    downloaded = False

    for url in CARD_URLS:
        try:
            logger.info(f"Downloading CARD from {url}")
            urllib.request.urlretrieve(url, archive_path)
            downloaded = True
            break
        except Exception as e:
            logger.warning(f"Failed to download CARD from {url}: {e}")
            continue

    if not downloaded:
        logger.warning(
            "Could not download CARD database. "
            "CARD may require authentication or the URL may have changed. "
            "Continuing without CARD — BioSafety screening will use VFDB only."
        )
        return False

    # Extract the nucleotide FASTA file from the archive
    fasta_path = None
    target_names = {
        "nucleotide_fasta_protein_homolog_model.fasta",
        "nucleotide_fasta_protein_overexpression_model.fasta",
        "nucleotide_fasta_protein_variant_model.fasta",
    }

    try:
        with tarfile.open(archive_path, "r:gz") as tar:
            # Look for any of the known nucleotide FASTA files
            for member in tar.getmembers():
                basename = os.path.basename(member.name)
                if basename in target_names:
                    # Use the first match (homolog model preferred)
                    if fasta_path is None or "homolog" in basename:
                        tar.extract(member, BLAST_DB_DIR)
                        fasta_path = os.path.join(BLAST_DB_DIR, member.name)
                        if "homolog" in basename:
                            break  # Prefer homolog model

            # If none of the specific names matched, search more broadly
            if fasta_path is None:
                for member in tar.getmembers():
                    basename = os.path.basename(member.name)
                    if basename.endswith(".fasta") and "nucleotide" in basename:
                        tar.extract(member, BLAST_DB_DIR)
                        fasta_path = os.path.join(BLAST_DB_DIR, member.name)
                        break

        os.unlink(archive_path)
    except Exception as e:
        logger.error(f"Failed to extract CARD archive: {e}")
        if os.path.exists(archive_path):
            os.unlink(archive_path)
        return False

    if fasta_path is None or not os.path.exists(fasta_path):
        logger.error(
            "CARD archive did not contain a nucleotide FASTA file. "
            "The archive format may have changed."
        )
        return False

    # Format for BLAST
    try:
        subprocess.run(
            ["makeblastdb", "-in", fasta_path, "-dbtype", "nucl",
             "-out", db_path, "-title", "CARD Antibiotic Resistance"],
            capture_output=True, text=True, timeout=300,
        )
        os.unlink(fasta_path)
        logger.info("CARD database formatted successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to format CARD database: {e}")
        return False


def blast_screen_sequence(
    sequence: str,
    databases: Optional[List[str]] = None,
    evalue_cutoff: float = 1e-5,
    max_hits: int = 50,
) -> Dict[str, Any]:
    """Screen a DNA sequence against biosafety databases using BLAST.

    Args:
        sequence: DNA sequence string
        databases: list of database names to search (default: all available)
        evalue_cutoff: E-value significance threshold
        max_hits: maximum hits to return per database

    Returns:
        Dict with query_length, total_hits, hits list, databases_searched
    """
    # Auto-download biosafety databases if not present
    ensure_vfdb_database()
    ensure_card_database()

    if databases is None:
        databases = _discover_databases()

    if not databases:
        return {
            "query_length": len(sequence),
            "total_hits": 0,
            "hits": [],
            "databases_searched": [],
            "warning": "No BLAST databases available. Install VFDB/CARD databases.",
        }

    # Write query to temp FASTA
    with tempfile.NamedTemporaryFile(mode="w", suffix=".fasta", delete=False) as f:
        f.write(f">query_sequence\n{sequence}\n")
        query_file = f.name

    all_hits = []
    searched = []

    try:
        for db_name in databases:
            db_path = os.path.join(BLAST_DB_DIR, db_name)
            if not os.path.exists(f"{db_path}.nin") and not os.path.exists(f"{db_path}.nsq"):
                logger.warning(f"BLAST database not found: {db_path}")
                continue

            try:
                cmd = [
                    "blastn",
                    "-query", query_file,
                    "-db", db_path,
                    "-evalue", str(evalue_cutoff),
                    "-max_target_seqs", str(max_hits),
                    "-outfmt", "5",  # XML output
                    "-num_threads", "2",
                ]

                result = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=120
                )

                if result.returncode != 0:
                    logger.error(f"BLAST failed for {db_name}: {result.stderr}")
                    continue

                hits = _parse_blast_xml(result.stdout, db_name)
                all_hits.extend(hits)
                searched.append(db_name)

            except subprocess.TimeoutExpired:
                logger.error(f"BLAST timeout for {db_name}")
                continue
            except FileNotFoundError:
                logger.error("blastn not found. Install ncbi-blast+ package.")
                break

    finally:
        os.unlink(query_file)

    # Sort by E-value (most significant first)
    all_hits.sort(key=lambda h: h.get("evalue", float("inf")))

    return {
        "query_length": len(sequence),
        "total_hits": len(all_hits),
        "hits": all_hits[:max_hits],
        "databases_searched": searched,
    }


def _discover_databases() -> List[str]:
    """Discover available BLAST databases in the database directory."""
    if not os.path.isdir(BLAST_DB_DIR):
        return []
    dbs = []
    for f in os.listdir(BLAST_DB_DIR):
        if f.endswith(".nin") or f.endswith(".nsq"):
            db_name = f.rsplit(".", 1)[0]
            if db_name not in dbs:
                dbs.append(db_name)
    return dbs


def _parse_blast_xml(xml_str: str, database: str) -> List[Dict[str, Any]]:
    """Parse BLAST XML output into structured hits."""
    hits = []
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError:
        return hits

    query_def = root.findtext(".//Query-def", "unknown")

    for hit_elem in root.iter("Hit"):
        hit_id = hit_elem.findtext("Hit_id", "")
        hit_def = hit_elem.findtext("Hit_def", "")

        for hsp in hit_elem.iter("Hsp"):
            hsp_evalue = float(hsp.findtext("Hsp_evalue", "0"))
            hsp_bit_score = float(hsp.findtext("Hsp_bit-score", "0"))
            hsp_identity = int(hsp.findtext("Hsp_identity", "0"))
            hsp_align_len = int(hsp.findtext("Hsp_align-len", "1"))

            pct_identity = (hsp_identity / hsp_align_len * 100) if hsp_align_len > 0 else 0

            hits.append({
                "query_id": query_def,
                "subject_id": hit_id,
                "subject_title": hit_def,
                "evalue": hsp_evalue,
                "bit_score": hsp_bit_score,
                "percent_identity": round(pct_identity, 2),
                "alignment_length": hsp_align_len,
                "database": database,
            })

    return hits


def get_available_databases() -> Dict[str, Any]:
    """Return info about available BLAST databases."""
    dbs = _discover_databases()
    return {
        "databases": dbs,
        "count": len(dbs),
        "db_dir": BLAST_DB_DIR,
    }
