/**
 * @jest-environment node
 */

import {
  createPromptVersion,
  getActivePrompt,
  listPromptVersions,
  activatePrompt,
  resetTableEnsured,
  type PromptVersion,
} from '../src/services/ml/promptVersioning';
import { sqlRun, closeLibsqlClient } from '../src/server/libsqlDb';

afterAll(() => {
  closeLibsqlClient();
});

describe('promptVersioning', () => {
  beforeEach(async () => {
    resetTableEnsured();
    await sqlRun('DROP TABLE IF EXISTS prompt_versions').catch(() => {});
  });

  afterEach(async () => {
    await sqlRun('DROP TABLE IF EXISTS prompt_versions').catch(() => {});
  });

  describe('createPromptVersion', () => {
    test('creates a new prompt version', async () => {
      const pv = await createPromptVersion('catdes', 'You are a catalyst designer.', '1.0.0');

      expect(pv).toBeDefined();
      expect(pv.tool_id).toBe('catdes');
      expect(pv.template).toBe('You are a catalyst designer.');
      expect(pv.version).toBe('1.0.0');
      expect(pv.id).toContain('catdes');
      expect(pv.id).toContain('1.0.0');
    });

    test('first version for a tool is auto-activated', async () => {
      const pv = await createPromptVersion('fbasim', 'Analyze flux.', '1.0.0');

      expect(pv.active).toBe(1);
    });

    test('subsequent versions are inactive by default', async () => {
      await createPromptVersion('fbasim', 'Analyze flux.', '1.0.0');
      const v2 = await createPromptVersion('fbasim', 'Analyze flux v2.', '2.0.0');

      expect(v2.active).toBe(0);
    });

    test('different tools have independent version chains', async () => {
      const catdes = await createPromptVersion('catdes', 'Design enzymes.', '1.0.0');
      const fbasim = await createPromptVersion('fbasim', 'Analyze flux.', '1.0.0');

      expect(catdes.active).toBe(1);
      expect(fbasim.active).toBe(1);
    });
  });

  describe('getActivePrompt', () => {
    test('returns the active prompt for a tool', async () => {
      await createPromptVersion('cethx', 'Thermodynamics prompt.', '1.0.0');
      const active = await getActivePrompt('cethx');

      expect(active).toBeDefined();
      expect(active!.tool_id).toBe('cethx');
      expect(active!.active).toBe(1);
    });

    test('returns undefined when no active prompt exists', async () => {
      const active = await getActivePrompt('nonexistent-tool');
      expect(active).toBeUndefined();
    });

    test('returns undefined when all versions are inactive', async () => {
      await createPromptVersion('dyncon', 'Control prompt.', '1.0.0');
      // Manually deactivate
      await sqlRun('UPDATE prompt_versions SET active = 0 WHERE tool_id = ?', ['dyncon']);

      const active = await getActivePrompt('dyncon');
      expect(active).toBeUndefined();
    });
  });

  describe('listPromptVersions', () => {
    test('returns all versions for a tool', async () => {
      await createPromptVersion('gecair', 'Circuit v1.', '1.0.0');
      await createPromptVersion('gecair', 'Circuit v2.', '2.0.0');
      await createPromptVersion('gecair', 'Circuit v3.', '3.0.0');

      const versions = await listPromptVersions('gecair');
      expect(versions).toHaveLength(3);
    });

    test('returns empty array for tool with no versions', async () => {
      const versions = await listPromptVersions('empty-tool');
      expect(versions).toEqual([]);
    });

    test('does not mix versions from different tools', async () => {
      await createPromptVersion('tool-a', 'A v1.', '1.0.0');
      await createPromptVersion('tool-b', 'B v1.', '1.0.0');

      const aVersions = await listPromptVersions('tool-a');
      const bVersions = await listPromptVersions('tool-b');

      expect(aVersions).toHaveLength(1);
      expect(bVersions).toHaveLength(1);
      expect(aVersions[0].tool_id).toBe('tool-a');
      expect(bVersions[0].tool_id).toBe('tool-b');
    });
  });

  describe('activatePrompt', () => {
    test('activates the specified version and deactivates others', async () => {
      const v1 = await createPromptVersion('multio', 'Omics v1.', '1.0.0');
      const v2 = await createPromptVersion('multio', 'Omics v2.', '2.0.0');

      // v1 is active (first), v2 is inactive
      expect(v1.active).toBe(1);
      expect(v2.active).toBe(0);

      // Activate v2
      await activatePrompt(v2.id);

      const active = await getActivePrompt('multio');
      expect(active).toBeDefined();
      expect(active!.id).toBe(v2.id);
      expect(active!.version).toBe('2.0.0');
    });

    test('only one version is active after activation', async () => {
      await createPromptVersion('scspatial', 'Spatial v1.', '1.0.0');
      const v2 = await createPromptVersion('scspatial', 'Spatial v2.', '2.0.0');
      const v3 = await createPromptVersion('scspatial', 'Spatial v3.', '3.0.0');

      await activatePrompt(v3.id);

      const versions = await listPromptVersions('scspatial');
      const activeCount = versions.filter((v: PromptVersion) => v.active === 1).length;
      expect(activeCount).toBe(1);
    });

    test('throws for nonexistent version ID', async () => {
      await expect(activatePrompt('nonexistent-id')).rejects.toThrow(
        'Prompt version not found: nonexistent-id',
      );
    });

    test('reactivating the already-active version is idempotent', async () => {
      const v1 = await createPromptVersion('proevol', 'Evolution v1.', '1.0.0');

      await activatePrompt(v1.id);

      const active = await getActivePrompt('proevol');
      expect(active!.id).toBe(v1.id);
      expect(active!.active).toBe(1);
    });
  });
});
