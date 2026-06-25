'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import { openapiSpec } from '../../../src/services/api/openapiSpec';

export default function ApiDocsClient() {
  return (
    <div style={{ height: '100vh' }}>
      <ApiReferenceReact
        configuration={{
          spec: { content: openapiSpec },
          theme: 'kepler',
          layout: 'modern',
        }}
      />
    </div>
  );
}
