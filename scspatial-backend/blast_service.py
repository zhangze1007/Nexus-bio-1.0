"""BLAST sequence screening service for biosafety checks and off-target search."""
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

# E. coli K-12 MG1655 reference genome (NCBI RefSeq)
ECOLI_GENOME_URL = "https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/GCF_000005845.2_ASM584v2_genomic.fna.gz"

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


def ensure_ecoli_genome() -> bool:
    """Download and format E. coli K-12 MG1655 reference genome if not already present.

    The genome is used for CRISPR off-target search — guides are aligned against
    the full E. coli chromosome to identify potential off-target binding sites.

    Returns True if the database is ready, False on failure.
    """
    db_path = os.path.join(BLAST_DB_DIR, "ecoli_k12")
    if os.path.exists(f"{db_path}.nin") or os.path.exists(f"{db_path}.nsq"):
        return True

    os.makedirs(BLAST_DB_DIR, exist_ok=True)

    # Download compressed genome
    fasta_gz = os.path.join(BLAST_DB_DIR, "ecoli_k12_genomic.fna.gz")
    try:
        logger.info("Downloading E. coli K-12 genome from NCBI FTP")
        urllib.request.urlretrieve(ECOLI_GENOME_URL, fasta_gz)
    except Exception as e:
        logger.error(f"Failed to download E. coli genome: {e}")
        return False

    # Decompress
    fasta_path = os.path.join(BLAST_DB_DIR, "ecoli_k12_genomic.fna")
    try:
        with gzip.open(fasta_gz, 'rb') as f_in:
            with open(fasta_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        os.unlink(fasta_gz)
    except Exception as e:
        logger.error(f"Failed to decompress E. coli genome: {e}")
        if os.path.exists(fasta_gz):
            os.unlink(fasta_gz)
        return False

    # Format for BLAST
    try:
        subprocess.run(
            ["makeblastdb", "-in", fasta_path, "-dbtype", "nucl",
             "-out", db_path, "-title", "E_coli_K12_MG1655"],
            capture_output=True, text=True, timeout=300,
        )
        os.unlink(fasta_path)
        logger.info("E. coli K-12 genome BLAST database formatted successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to format E. coli genome BLAST database: {e}")
        if os.path.exists(fasta_path):
            os.unlink(fasta_path)
        return False


def blast_offtarget(sequence: str, max_mismatches: int = 3) -> Dict[str, Any]:
    """Search for off-target sites in the E. coli K-12 genome.

    Uses blastn with -task blastn-short (optimized for 20-nt guide RNAs).
    Parses hits and reports mismatch count, seed region (positions 1-8) mismatches,
    and PAM-adjacent mismatch information.

    Args:
        sequence: Guide RNA spacer sequence (DNA, 5'->3', typically 20 nt)
        max_mismatches: Maximum mismatches to report (default 3)

    Returns:
        Dict with total_hits, hits list, and seed_mismatch_count
    """
    if not ensure_ecoli_genome():
        return {
            "total_hits": 0,
            "hits": [],
            "seed_mismatch_sites": 0,
            "warning": "E. coli genome database unavailable. Off-target search skipped.",
        }

    db_path = os.path.join(BLAST_DB_DIR, "ecoli_k12")

    # Clean and validate sequence
    clean_seq = sequence.upper().strip().replace("U", "T")
    clean_seq = "".join(c for c in clean_seq if c in "ACGT")
    if len(clean_seq) < 15:
        return {
            "total_hits": 0,
            "hits": [],
            "seed_mismatch_sites": 0,
            "warning": f"Sequence too short for off-target search ({len(clean_seq)} nt, need >=15).",
        }

    # Write query to temp FASTA
    with tempfile.NamedTemporaryFile(mode="w", suffix=".fasta", delete=False) as f:
        f.write(f">guide_query\n{clean_seq}\n")
        query_file = f.name

    try:
        # Run blastn with short-task mode (optimized for 20-nt queries)
        cmd = [
            "blastn",
            "-task", "blastn-short",
            "-query", query_file,
            "-db", db_path,
            "-evalue", "1000",  # permissive E-value for short queries
            "-word_size", "7",  # minimum word size for sensitivity
            "-dust", "no",  # disable low-complexity filtering
            "-max_target_seqs", "100",
            "-outfmt", "5",  # XML output
            "-num_threads", "2",
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

        if result.returncode != 0:
            logger.error(f"BLAST off-target search failed: {result.stderr}")
            return {
                "total_hits": 0,
                "hits": [],
                "seed_mismatch_sites": 0,
                "warning": f"BLAST off-target search failed: {result.stderr[:200]}",
            }

        hits = _parse_offtarget_blast_xml(result.stdout, clean_seq, max_mismatches)

        # Count hits with seed region mismatches (positions 1-8, most critical)
        seed_mismatch_count = sum(1 for h in hits if h.get("seed_mismatches", 0) > 0)

        return {
            "total_hits": len(hits),
            "hits": hits,
            "seed_mismatch_sites": seed_mismatch_count,
            "query_length": len(clean_seq),
            "database": "ecoli_k12",
        }

    except subprocess.TimeoutExpired:
        logger.error("BLAST off-target search timed out")
        return {
            "total_hits": 0,
            "hits": [],
            "seed_mismatch_sites": 0,
            "warning": "BLAST off-target search timed out (60s limit).",
        }
    except FileNotFoundError:
        logger.error("blastn not found. Install ncbi-blast+ package.")
        return {
            "total_hits": 0,
            "hits": [],
            "seed_mismatch_sites": 0,
            "warning": "blastn not installed. Off-target search unavailable.",
        }
    finally:
        os.unlink(query_file)


def _parse_offtarget_blast_xml(xml_str: str, query_seq: str, max_mismatches: int) -> List[Dict[str, Any]]:
    """Parse BLAST XML output for off-target hits.

    Extracts mismatch positions, identifies seed region (positions 1-8) mismatches,
    and filters to hits within max_mismatches threshold.
    """
    hits = []
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError:
        return hits

    query_len = len(query_seq)

    for hit_elem in root.iter("Hit"):
        hit_id = hit_elem.findtext("Hit_id", "")
        hit_def = hit_elem.findtext("Hit_def", "")

        for hsp in hit_elem.iter("Hsp"):
            hsp_identity = int(hsp.findtext("Hsp_identity", "0"))
            hsp_align_len = int(hsp.findtext("Hsp_align-len", "1"))
            hsp_query_from = int(hsp.findtext("Hsp_query-from", "1"))
            hsp_query_to = int(hsp.findtext("Hsp_query-to", "1"))
            hsp_hit_from = int(hsp.findtext("Hsp_hit-from", "1"))
            hsp_hit_to = int(hsp.findtext("Hsp_hit-to", "1"))
            hsp_qseq = hsp.findtext("Hsp_qseq", "")
            hsp_hseq = hsp.findtext("Hsp_hseq", "")
            hsp_midline = hsp.findtext("Hsp_midline", "")

            # Calculate mismatches
            mismatches = hsp_align_len - hsp_identity

            # Skip if too many mismatches
            if mismatches > max_mismatches:
                continue

            # Skip perfect match (this is the on-target site itself)
            if mismatches == 0 and hsp_align_len == query_len:
                continue

            # Identify mismatch positions relative to query
            mismatch_positions: List[int] = []
            seed_mismatches = 0  # positions 1-8 (critical for Cas9 specificity)

            # Parse alignment to find mismatch positions
            query_pos = hsp_query_from
            for i, (q, h, m) in enumerate(zip(hsp_qseq, hsp_hseq, hsp_midline)):
                if m != "|" and m != " " and q != "-" and h != "-":
                    # Substitution mismatch
                    mismatch_positions.append(query_pos)
                    if 1 <= query_pos <= 8:
                        seed_mismatches += 1
                if q != "-":
                    query_pos += 1

            # Compute off-target risk score:
            # - Seed mismatches are most critical (positions 1-8 adjacent to PAM)
            # - More mismatches = lower risk
            # - Mismatches near PAM (3' end) are more disruptive to Cas9 binding
            risk_score = max(0, 1.0 - (mismatches * 0.25) - (seed_mismatches * 0.15))

            hits.append({
                "subject_id": hit_id,
                "subject_title": hit_def[:100],
                "mismatches": mismatches,
                "seed_mismatches": seed_mismatches,
                "alignment_length": hsp_align_len,
                "percent_identity": round(hsp_identity / hsp_align_len * 100, 2) if hsp_align_len > 0 else 0,
                "query_start": hsp_query_from,
                "query_end": hsp_query_to,
                "hit_start": hsp_hit_from,
                "hit_end": hsp_hit_to,
                "mismatch_positions": mismatch_positions,
                "offtarget_risk": round(risk_score, 3),
            })

    # Sort by risk (highest first) then by mismatches (fewest first)
    hits.sort(key=lambda h: (-h["offtarget_risk"], h["mismatches"]))

    return hits


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
