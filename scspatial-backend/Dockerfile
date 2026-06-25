FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for scanpy/squidpy + BLAST+
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    ncbi-blast+ \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# BLAST databases are downloaded at runtime on first use (see blast_service.py)
# This avoids build failures from external URL changes and keeps the image smaller.

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
