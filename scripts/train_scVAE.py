#!/usr/bin/env python3
"""
Train a single-cell VAE and export to ONNX.

Usage:
    python scripts/train_scVAE.py --input data/pbmc68k.h5ad --output public/models/

Requirements:
    pip install torch scanpy anndata onnx

The model learns a low-dimensional latent representation of single-cell
gene expression data. The encoder maps gene expression → latent space,
the decoder maps latent space → reconstructed gene expression.

Architecture:
    Encoder:  Input(n_genes) → Linear(512) → ReLU → Linear(256) → ReLU → μ(32), logσ²(32)
    Decoder:  z(32) → Linear(256) → ReLU → Linear(512) → ReLU → Linear(n_genes) → Sigmoid

Reference:
    Lopez, R., et al. (2018). Deep generative modeling for single-cell transcriptomics.
    Nature Methods, 15(12), 1053-1058.
"""

import argparse
import os
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset


# ── Model Architecture ──────────────────────────────────────────────────────

class Encoder(nn.Module):
    """Encode gene expression to latent space parameters (μ, log σ²)."""

    def __init__(self, input_dim: int, hidden_dims: list[int], latent_dim: int):
        super().__init__()
        layers = []
        prev_dim = input_dim
        for h_dim in hidden_dims:
            layers.extend([nn.Linear(prev_dim, h_dim), nn.ReLU(), nn.BatchNorm1d(h_dim)])
            prev_dim = h_dim
        self.network = nn.Sequential(*layers)
        self.fc_mu = nn.Linear(prev_dim, latent_dim)
        self.fc_logvar = nn.Linear(prev_dim, latent_dim)

    def forward(self, x):
        h = self.network(x)
        return self.fc_mu(h), self.fc_logvar(h)


class Decoder(nn.Module):
    """Decode latent vectors to gene expression space."""

    def __init__(self, latent_dim: int, hidden_dims: list[int], output_dim: int):
        super().__init__()
        layers = []
        prev_dim = latent_dim
        for h_dim in hidden_dims:
            layers.extend([nn.Linear(prev_dim, h_dim), nn.ReLU(), nn.BatchNorm1d(h_dim)])
            prev_dim = h_dim
        layers.append(nn.Linear(prev_dim, output_dim))
        layers.append(nn.Sigmoid())
        self.network = nn.Sequential(*layers)

    def forward(self, z):
        return self.network(z)


class scVAE(nn.Module):
    """Single-Cell Variational Autoencoder."""

    def __init__(self, input_dim: int, hidden_dims: list[int] = None, latent_dim: int = 32):
        super().__init__()
        if hidden_dims is None:
            hidden_dims = [512, 256]
        self.latent_dim = latent_dim
        self.encoder = Encoder(input_dim, hidden_dims, latent_dim)
        self.decoder = Decoder(latent_dim, list(reversed(hidden_dims)), input_dim)

    def reparameterize(self, mu, logvar):
        """Reparameterization trick: z = μ + σ × ε, ε ~ N(0,1)."""
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def forward(self, x):
        mu, logvar = self.encoder(x)
        z = self.reparameterize(mu, logvar)
        recon = self.decoder(z)
        return recon, mu, logvar


def vae_loss(recon_x, x, mu, logvar):
    """ELBO loss = reconstruction (BCE) + KL divergence."""
    # Binary cross-entropy reconstruction loss
    bce = nn.functional.binary_cross_entropy(recon_x, x, reduction='sum')
    # KL divergence: -0.5 * Σ(1 + log(σ²) - μ² - σ²)
    kld = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
    return bce + kld


# ── Data Loading ────────────────────────────────────────────────────────────

def load_data(input_path: str, n_top_genes: int = 2000):
    """Load and preprocess single-cell data."""
    try:
        import scanpy as sc
        import anndata as ad
    except ImportError:
        print("ERROR: scanpy and anndata are required. Install with: pip install scanpy anndata")
        sys.exit(1)

    print(f"Loading data from {input_path}...")
    adata = sc.read_h5ad(input_path)

    # Standard preprocessing
    print("Preprocessing...")
    sc.pp.filter_genes(adata, min_cells=10)
    sc.pp.normalize_total(adata, target_sum=1e4)
    sc.pp.log1p(adata)
    sc.pp.highly_variable_genes(adata, n_top_genes=min(n_top_genes, adata.n_vars))
    adata = adata[:, adata.var.highly_variable]

    # Convert to dense if sparse
    X = adata.X.toarray() if hasattr(adata.X, 'toarray') else np.array(adata.X)

    # Normalize to [0, 1] range
    X = (X - X.min()) / (X.max() - X.min() + 1e-8)

    print(f"Data shape: {X.shape} ({X.shape[0]} cells × {X.shape[1]} genes)")
    return X, list(adata.var_names)


# ── Training ────────────────────────────────────────────────────────────────

def train_model(X: np.ndarray, latent_dim: int = 32, epochs: int = 100,
                batch_size: int = 128, lr: float = 1e-3, seed: int = 42):
    """Train the scVAE model."""
    torch.manual_seed(seed)
    np.random.seed(seed)

    input_dim = X.shape[1]
    model = scVAE(input_dim=input_dim, latent_dim=latent_dim)
    optimizer = optim.Adam(model.parameters(), lr=lr)

    dataset = TensorDataset(torch.FloatTensor(X))
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    print(f"\nTraining scVAE: {input_dim} → {latent_dim} latent dims")
    print(f"  Epochs: {epochs}, Batch size: {batch_size}, LR: {lr}")
    print(f"  Parameters: {sum(p.numel() for p in model.parameters()):,}")

    for epoch in range(epochs):
        total_loss = 0
        n_batches = 0
        for (batch,) in dataloader:
            recon, mu, logvar = model(batch)
            loss = vae_loss(recon, batch, mu, logvar)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            n_batches += 1

        if (epoch + 1) % 10 == 0:
            avg_loss = total_loss / n_batches / batch_size
            print(f"  Epoch {epoch + 1}/{epochs} — Loss: {avg_loss:.4f}")

    return model


# ── ONNX Export ─────────────────────────────────────────────────────────────

def export_to_onnx(model: scVAE, output_dir: str, input_dim: int, latent_dim: int):
    """Export encoder and decoder to ONNX format."""
    os.makedirs(output_dir, exist_ok=True)

    # Export encoder
    encoder_path = os.path.join(output_dir, 'scVAE_encoder.onnx')
    dummy_input = torch.randn(1, input_dim)
    torch.onnx.export(
        model.encoder,
        dummy_input,
        encoder_path,
        input_names=['input'],
        output_names=['mu', 'logvar'],
        dynamic_axes={'input': {0: 'batch'}, 'mu': {0: 'batch'}, 'logvar': {0: 'batch'}},
        opset_version=14,
    )
    print(f"Encoder exported to {encoder_path}")

    # Export decoder
    decoder_path = os.path.join(output_dir, 'scVAE_decoder.onnx')
    dummy_latent = torch.randn(1, latent_dim)
    torch.onnx.export(
        model.decoder,
        dummy_latent,
        decoder_path,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
        opset_version=14,
    )
    print(f"Decoder exported to {decoder_path}")

    return encoder_path, decoder_path


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Train scVAE and export to ONNX')
    parser.add_argument('--input', type=str, required=True, help='Input h5ad file')
    parser.add_argument('--output', type=str, default='public/models/', help='Output directory')
    parser.add_argument('--latent-dim', type=int, default=32, help='Latent space dimension')
    parser.add_argument('--epochs', type=int, default=100, help='Training epochs')
    parser.add_argument('--batch-size', type=int, default=128, help='Batch size')
    parser.add_argument('--lr', type=float, default=1e-3, help='Learning rate')
    parser.add_argument('--n-genes', type=int, default=2000, help='Number of top genes')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    args = parser.parse_args()

    # Load data
    X, gene_names = load_data(args.input, args.n_genes)

    # Train
    model = train_model(X, args.latent_dim, args.epochs, args.batch_size, args.lr, args.seed)

    # Export
    enc_path, dec_path = export_to_onnx(model, args.output, X.shape[1], args.latent_dim)

    # Save gene names for reference
    gene_file = os.path.join(args.output, 'scVAE_genes.txt')
    with open(gene_file, 'w') as f:
        f.write('\n'.join(gene_names))
    print(f"Gene names saved to {gene_file}")

    print("\nDone! Models are ready for browser inference.")
    print(f"  Encoder: {enc_path}")
    print(f"  Decoder: {dec_path}")


if __name__ == '__main__':
    main()
