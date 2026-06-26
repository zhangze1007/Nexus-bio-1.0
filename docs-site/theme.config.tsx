import React from 'react';
import type { DocsThemeConfig } from 'nextra-theme-docs';

const config: DocsThemeConfig = {
  logo: <span style={{ fontWeight: 'bold' }}>Nexus-Bio Docs</span>,
  project: {
    link: 'https://github.com/zhangze1007/Nexus-bio-1.0',
  },
  docsRepositoryBase: 'https://github.com/zhangze1007/Nexus-bio-1.0/tree/main/docs-site',
  footer: {
    content: '© 2026 Nexus-Bio. Built with ❤️ in Malaysia.',
  },
  darkMode: true,
};

export default config;
