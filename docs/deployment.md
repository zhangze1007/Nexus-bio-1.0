# Deployment Guide

## Vercel (Recommended)

1. Fork the repository
2. Connect to Vercel
3. Set environment variables:
   - `GROQ_API_KEY` - Groq API key (primary AI)
   - `GEMINI_API_KEY` - Google Gemini API key (fallback AI)
4. Deploy

## Self-Hosted

```bash
git clone https://github.com/zhangze1007/Nexus-bio-1.0.git
cd Nexus-bio-1.0
npm ci
npm run build
npm run start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API authorization |
| `GEMINI_API_KEY` | Yes | Google Gemini authorization |
| `SCSPATIAL_ARTIFACT_DIR` | No | ScSpatial artifact storage |
| `ESM2_PYTHON_BACKEND` | No | ESM-2 Python backend URL |
