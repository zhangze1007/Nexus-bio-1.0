FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for scanpy/squidpy
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install NCBI BLAST+
RUN apt-get update && apt-get install -y --no-install-recommends \
    ncbi-blast+ \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download and format biosafety databases
RUN mkdir -p /app/blast_databases && \
    cd /app/blast_databases && \
    wget -q https://mgc.ac.cn/VFDB/SetA/VFDB_setA_nt.fasta.gz && \
    gunzip VFDB_setA_nt.fasta.gz && \
    makeblastdb -in VFDB_setA_nt.fasta -dbtype nucl -out VFDB -title "VFDB Core" && \
    rm -f VFDB_setA_nt.fasta

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
