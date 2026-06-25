/**
 * OpenAPI 3.1 specification for the Nexus-Bio API.
 *
 * Covers all public endpoints exposed by the Next.js App Router routes
 * under /api/*.
 */

export const openapiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Nexus-Bio API',
    version: '1.0.0',
    description:
      'Synthetic Biology Operating System API — design, simulate, and optimize biological systems.',
    contact: {
      name: 'Zhang Ze Foo',
      email: 'fuchanze@gmail.com',
      url: 'https://nexus-bio-1-0.vercel.app',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'https://nexus-bio-1-0.vercel.app',
      description: 'Production',
    },
    {
      url: 'http://localhost:3000',
      description: 'Local Development',
    },
  ],
  tags: [
    { name: 'Health', description: 'Server health and status' },
    { name: 'AI', description: 'AI-powered analysis and research assistance' },
    {
      name: 'Simulation',
      description: 'Computational biology simulations (FBA, thermodynamics, kinetics)',
    },
    {
      name: 'Structure',
      description: 'Protein and molecular structure lookups',
    },
    { name: 'Database', description: 'External database proxies (KEGG, PubChem, UniProt)' },
    { name: 'Data', description: 'Data upload, file management, and omics pipelines' },
    { name: 'Auth', description: 'Authentication and API key management' },
    { name: 'Workbench', description: 'Project state and experiment ledger' },
  ],
  paths: {
    /* ───────── Health ───────── */
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health Check',
        description: 'Returns server status, timestamp, and version info.',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string', example: '88b2e41' },
                  },
                },
              },
            },
          },
        },
      },
    },

    /* ───────── AI ───────── */
    '/api/analyze': {
      post: {
        tags: ['AI'],
        summary: 'AI Analysis',
        description:
          'Send a research query to the AI assistant. Uses Groq (llama-3.3-70b-versatile) as primary provider with Gemini fallback.',
        operationId: 'postAnalyze',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  prompt: {
                    type: 'string',
                    description: 'The research query or question',
                  },
                  nodes: {
                    type: 'array',
                    description: 'Optional pathway nodes for context',
                    items: { type: 'object' },
                  },
                  history: {
                    type: 'array',
                    description: 'Optional conversation history',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant'] },
                        content: { type: 'string' },
                      },
                    },
                  },
                },
                required: ['prompt'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Analysis result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: { type: 'string', description: 'AI-generated analysis' },
                    provider: { type: 'string', description: 'Which AI provider answered' },
                  },
                },
              },
            },
          },
          '503': {
            description: 'All AI providers unavailable',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },

    /* ───────── Simulation ───────── */
    '/api/fba': {
      post: {
        tags: ['Simulation'],
        summary: 'Flux Balance Analysis',
        description:
          'Run FBA simulation on a metabolic model. Supports single-species, community FBA, FVA, pFBA, and GPR analysis.',
        operationId: 'postFba',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  mode: {
                    type: 'string',
                    enum: ['single', 'community', 'custom', 'fva', 'pfba', 'gpr'],
                    description: 'FBA analysis mode',
                  },
                  reactions: {
                    type: 'array',
                    description: 'List of reactions in the metabolic model',
                    items: { type: 'object' },
                  },
                  objective: {
                    type: 'string',
                    description: 'Objective reaction ID to maximize',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'FBA result with flux distribution',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    objectiveValue: { type: 'number' },
                    fluxes: { type: 'object', additionalProperties: { type: 'number' } },
                    shadowPrices: { type: 'object', additionalProperties: { type: 'number' } },
                  },
                },
              },
            },
          },
        },
      },
    },

    /* ───────── Structure ───────── */
    '/api/alphafold': {
      get: {
        tags: ['Structure'],
        summary: 'AlphaFold Structure',
        description:
          'Proxy to EBI AlphaFold for PDB structure prediction by UniProt ID.',
        operationId: 'getAlphafold',
        parameters: [
          {
            name: 'id',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'UniProt ID (e.g. Q9AR04)',
            example: 'Q9AR04',
          },
        ],
        responses: {
          '200': {
            description: 'PDB file content',
            content: {
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
          '400': { description: 'Missing or invalid UniProt ID' },
          '502': { description: 'Upstream AlphaFold service error' },
        },
      },
    },

    '/api/alphafold3': {
      get: {
        tags: ['Structure'],
        summary: 'AlphaFold 3 Structure',
        description: 'Proxy to AlphaFold 3 server for structure predictions.',
        operationId: 'getAlphafold3',
        parameters: [
          {
            name: 'id',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'UniProt ID',
          },
        ],
        responses: {
          '200': { description: 'AlphaFold 3 structure data' },
        },
      },
    },

    '/api/esm2': {
      get: {
        tags: ['Structure'],
        summary: 'ESM-2 Embedding',
        description: 'Get ESM-2 protein language model embeddings for a sequence.',
        operationId: 'getEsm2',
        parameters: [
          {
            name: 'sequence',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Amino acid sequence',
          },
        ],
        responses: {
          '200': { description: 'ESM-2 embedding vector' },
        },
      },
    },

    '/api/esm3': {
      get: {
        tags: ['Structure'],
        summary: 'ESM-3 Structure',
        description: 'Get ESM-3 protein structure prediction.',
        operationId: 'getEsm3',
        parameters: [
          {
            name: 'sequence',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Amino acid sequence',
          },
        ],
        responses: {
          '200': { description: 'ESM-3 predicted structure' },
        },
      },
    },

    '/api/esmfold': {
      get: {
        tags: ['Structure'],
        summary: 'ESMFold Structure',
        description: 'Get ESMFold protein structure prediction.',
        operationId: 'getEsmfold',
        parameters: [
          {
            name: 'sequence',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Amino acid sequence',
          },
        ],
        responses: {
          '200': { description: 'ESMFold predicted PDB structure' },
        },
      },
    },

    '/api/docking': {
      post: {
        tags: ['Structure'],
        summary: 'Molecular Docking',
        description: 'Run molecular docking simulation.',
        operationId: 'postDocking',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ligand: { type: 'string', description: 'Ligand SMILES or CID' },
                  receptor: { type: 'string', description: 'Receptor PDB ID or UniProt ID' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Docking results with binding scores' },
        },
      },
    },

    /* ───────── Database Proxies ───────── */
    '/api/pubchem': {
      get: {
        tags: ['Database'],
        summary: 'PubChem Lookup',
        description:
          'Proxy to PubChem REST API for compound data. Provide either cid or name.',
        operationId: 'getPubchem',
        parameters: [
          {
            name: 'cid',
            in: 'query',
            schema: { type: 'string' },
            description: 'PubChem Compound ID',
            example: '68827',
          },
          {
            name: 'name',
            in: 'query',
            schema: { type: 'string' },
            description: 'Compound name to search',
            example: 'artemisinin',
          },
        ],
        responses: {
          '200': {
            description: 'Compound data (JSON or SDF)',
          },
          '400': { description: 'Must provide cid or name' },
        },
      },
    },

    '/api/kegg': {
      get: {
        tags: ['Database'],
        summary: 'KEGG Pathway',
        description: 'Proxy to KEGG REST API for pathway and compound data.',
        operationId: 'getKegg',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'KEGG query (pathway ID, compound name, etc.)',
            example: 'map00910',
          },
        ],
        responses: {
          '200': { description: 'KEGG data' },
        },
      },
    },

    '/api/uniprot': {
      get: {
        tags: ['Database'],
        summary: 'UniProt Lookup',
        description: 'Proxy to UniProt REST API for protein data.',
        operationId: 'getUniprot',
        parameters: [
          {
            name: 'id',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'UniProt accession',
          },
        ],
        responses: {
          '200': { description: 'UniProt protein entry' },
        },
      },
    },

    '/api/bigg': {
      get: {
        tags: ['Database'],
        summary: 'BiGG Models',
        description: 'Proxy to BiGG Models database for metabolic model lookups.',
        operationId: 'getBigg',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'BiGG model or reaction query',
          },
        ],
        responses: {
          '200': { description: 'BiGG model data' },
        },
      },
    },

    '/api/brenda': {
      get: {
        tags: ['Database'],
        summary: 'BRENDA Enzyme',
        description: 'Proxy to BRENDA enzyme database.',
        operationId: 'getBrenda',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Enzyme name or EC number',
          },
        ],
        responses: {
          '200': { description: 'BRENDA enzyme data' },
        },
      },
    },

    '/api/rhea': {
      get: {
        tags: ['Database'],
        summary: 'Rhea Reactions',
        description: 'Proxy to Rhea biochemical reaction database.',
        operationId: 'getRhea',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Rhea reaction ID or query',
          },
        ],
        responses: {
          '200': { description: 'Rhea reaction data' },
        },
      },
    },

    '/api/sabio': {
      get: {
        tags: ['Database'],
        summary: 'SABIO-RK Kinetics',
        description: 'Proxy to SABIO-RK enzyme kinetics database.',
        operationId: 'getSabio',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Kinetics query (enzyme, EC number, etc.)',
          },
        ],
        responses: {
          '200': { description: 'Kinetic parameter data' },
        },
      },
    },

    '/api/equilibrator': {
      get: {
        tags: ['Simulation'],
        summary: 'eQuilibrator Thermodynamics',
        description:
          'Proxy to eQuilibrator for standard reaction Gibbs energy estimates.',
        operationId: 'getEquilibrator',
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Reaction equation or query',
          },
        ],
        responses: {
          '200': { description: 'Thermodynamic parameters (deltaG, etc.)' },
        },
      },
    },

    '/api/blast': {
      get: {
        tags: ['Database'],
        summary: 'BLAST Search',
        description: 'Proxy to NCBI BLAST for sequence similarity search.',
        operationId: 'getBlast',
        parameters: [
          {
            name: 'sequence',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Query sequence',
          },
        ],
        responses: {
          '200': { description: 'BLAST alignment results' },
        },
      },
    },

    '/api/rna': {
      get: {
        tags: ['Structure'],
        summary: 'RNA Structure',
        description: 'RNA secondary structure prediction.',
        operationId: 'getRna',
        parameters: [
          {
            name: 'sequence',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'RNA sequence',
          },
        ],
        responses: {
          '200': { description: 'Predicted RNA structure' },
        },
      },
    },

    '/api/mofa': {
      get: {
        tags: ['Simulation'],
        summary: 'MOFA+ Factor Analysis',
        description: 'Multi-Omics Factor Analysis for dimensionality reduction.',
        operationId: 'getMofa',
        parameters: [
          {
            name: 'query',
            in: 'query',
            schema: { type: 'string' },
            description: 'Analysis query',
          },
        ],
        responses: {
          '200': { description: 'MOFA+ factor loadings and variance explained' },
        },
      },
    },

    '/api/umap': {
      get: {
        tags: ['Simulation'],
        summary: 'UMAP Embedding',
        description: 'Uniform Manifold Approximation and Projection for dimensionality reduction.',
        operationId: 'getUmap',
        parameters: [
          {
            name: 'query',
            in: 'query',
            schema: { type: 'string' },
            description: 'Embedding query',
          },
        ],
        responses: {
          '200': { description: 'UMAP 2D/3D coordinates' },
        },
      },
    },

    /* ───────── Data / Files ───────── */
    '/api/files/upload': {
      post: {
        tags: ['Data'],
        summary: 'Upload File',
        description: 'Generate a pre-signed URL for file upload.',
        operationId: 'postFilesUpload',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  filename: { type: 'string', description: 'Original filename' },
                  contentType: { type: 'string', description: 'MIME type' },
                  projectId: { type: 'string', description: 'Workbench project ID' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Pre-signed upload URL',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    uploadUrl: { type: 'string' },
                    key: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/scspatial/ingest': {
      post: {
        tags: ['Data'],
        summary: 'ScSpatial Ingest',
        description: 'Upload and process single-cell spatial transcriptomics data.',
        operationId: 'postScSpatialIngest',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'H5AD or CSV data file' },
                  format: { type: 'string', enum: ['h5ad', 'csv', '10x'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Ingestion started, returns dataset ID' },
        },
      },
    },

    '/api/scspatial/query': {
      post: {
        tags: ['Data'],
        summary: 'ScSpatial Query',
        description: 'Query processed single-cell spatial data (clusters, gene expression, UMAP).',
        operationId: 'postScSpatialQuery',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  datasetId: { type: 'string' },
                  viewMode: { type: 'string', enum: ['umap', 'spatial', 'heatmap', 'cluster'] },
                  genes: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Query results (coordinates, expression values, cluster labels)' },
        },
      },
    },

    '/api/pipeline': {
      post: {
        tags: ['Data'],
        summary: 'Pipeline Execution',
        description: 'Execute a multi-step computational pipeline.',
        operationId: 'postPipeline',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  steps: { type: 'array', items: { type: 'object' } },
                  input: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Pipeline execution results' },
        },
      },
    },

    /* ───────── Auth & API Keys ───────── */
    '/api/keys': {
      get: {
        tags: ['Auth'],
        summary: 'List API Keys',
        description: 'List all API keys for the authenticated user. Returns metadata only (no raw keys).',
        operationId: 'listApiKeys',
        security: [{ SessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of API key metadata',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      keyPrefix: { type: 'string' },
                      scopes: { type: 'array', items: { type: 'string' } },
                      expiresAt: { type: 'string', format: 'date-time', nullable: true },
                      lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthorized — no valid session' },
        },
      },
      post: {
        tags: ['Auth'],
        summary: 'Create API Key',
        description:
          'Create a new API key. The raw key is returned ONCE — store it securely.',
        operationId: 'createApiKey',
        security: [{ SessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Human-readable key name' },
                  scopes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Permission scopes',
                  },
                  expiresIn: {
                    type: 'integer',
                    description: 'TTL in seconds (optional)',
                  },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Key created — raw key returned once',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    key: { type: 'string', description: 'Raw API key (nxb_...). Shown once.' },
                    keyPrefix: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthorized' },
        },
      },
    },

    '/api/keys/{id}': {
      delete: {
        tags: ['Auth'],
        summary: 'Revoke API Key',
        description: 'Revoke (delete) an API key by ID.',
        operationId: 'revokeApiKey',
        security: [{ SessionAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'API key ID',
          },
        ],
        responses: {
          '200': { description: 'Key revoked' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Key not found' },
        },
      },
    },

    '/api/auth': {
      get: {
        tags: ['Auth'],
        summary: 'Auth Status',
        description: 'Check current authentication status and session info.',
        operationId: 'getAuthStatus',
        responses: {
          '200': {
            description: 'Current session info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        name: { type: 'string' },
                      },
                    },
                    expires: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },

    /* ───────── Workbench ───────── */
    '/api/workbench': {
      get: {
        tags: ['Workbench'],
        summary: 'Get Workbench State',
        description:
          'Retrieve the current workbench project state including experiment ledger and decision trace.',
        operationId: 'getWorkbench',
        parameters: [
          {
            name: 'projectId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Project ID',
          },
        ],
        responses: {
          '200': {
            description: 'Workbench project state',
          },
        },
      },
      put: {
        tags: ['Workbench'],
        summary: 'Update Workbench State',
        description:
          'Update workbench project state with revision conflict detection.',
        operationId: 'putWorkbench',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projectId: { type: 'string' },
                  revision: { type: 'integer', description: 'Expected current revision for conflict detection' },
                  state: { type: 'object', description: 'New workbench state' },
                },
                required: ['projectId', 'revision', 'state'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'State updated' },
          '409': { description: 'Revision conflict — state was modified by another client' },
        },
      },
    },

    '/api/analytics': {
      post: {
        tags: ['Data'],
        summary: 'Analytics Event',
        description: 'Log an analytics event (Web Vitals, usage metrics).',
        operationId: 'postAnalytics',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  event: { type: 'string' },
                  properties: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '204': { description: 'Event logged' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      SessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'next-auth.session-token',
        description: 'Session cookie from NextAuth.js',
      },
      ApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key prefixed with nxb_',
      },
    },
  },
  security: [{ SessionAuth: [] }, { ApiKey: [] }],
} as const;
