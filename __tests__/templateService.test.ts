/** @jest-environment node */

import {
  publishTemplate,
  listTemplates,
  getTemplate,
  forkTemplate,
  rateTemplate,
  resetSchemaReady,
  type PublishTemplateInput,
} from '../src/services/community/templateService';
import { sqlRun, sqlAll, closeLibsqlClient } from '../src/server/libsqlDb';

afterAll(() => {
  closeLibsqlClient();
});

describe('templateService', () => {
  beforeEach(async () => {
    await sqlRun('DROP TABLE IF EXISTS community_template_ratings').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS community_templates').catch(() => {});
    resetSchemaReady();
  });

  afterEach(async () => {
    await sqlRun('DROP TABLE IF EXISTS community_template_ratings').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS community_templates').catch(() => {});
  });

  function makeTemplate(overrides?: Partial<PublishTemplateInput>): PublishTemplateInput {
    return {
      name: 'Artemisinin Pathway v2',
      description: 'Optimized artemisinin biosynthesis pathway',
      category: 'pathway',
      project_data: { targetProduct: 'artemisinin', nodes: 7 },
      ...overrides,
    };
  }

  // ── publishTemplate ──────────────────────────────────────────────────────

  it('publishes a template and returns it with generated id and zero counts', async () => {
    const result = await publishTemplate('user-1', makeTemplate());

    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.name).toBe('Artemisinin Pathway v2');
    expect(result.description).toBe('Optimized artemisinin biosynthesis pathway');
    expect(result.author_id).toBe('user-1');
    expect(result.category).toBe('pathway');
    expect(result.project_data).toEqual({ targetProduct: 'artemisinin', nodes: 7 });
    expect(result.fork_count).toBe(0);
    expect(result.star_count).toBe(0);
    expect(result.rating_avg).toBe(0);
    expect(result.rating_count).toBe(0);
    expect(result.is_public).toBe(1);
    expect(result.created_at).toBeGreaterThan(0);
  });

  it('persists the template to the database', async () => {
    const published = await publishTemplate('user-2', makeTemplate({ name: 'Test Persist' }));
    const rows = await sqlAll('SELECT * FROM community_templates WHERE id = ?', [published.id]);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Test Persist');
    expect(rows[0].author_id).toBe('user-2');
  });

  it('stores is_public as 0 when explicitly set to false', async () => {
    const result = await publishTemplate('user-3', makeTemplate({ is_public: false }));

    expect(result.is_public).toBe(0);

    const row = await sqlAll('SELECT is_public FROM community_templates WHERE id = ?', [result.id]);
    expect(Number(row[0].is_public)).toBe(0);
  });

  // ── listTemplates ────────────────────────────────────────────────────────

  it('lists only public templates', async () => {
    await publishTemplate('u1', makeTemplate({ name: 'Public A' }));
    await publishTemplate('u2', makeTemplate({ name: 'Public B' }));
    await publishTemplate('u3', makeTemplate({ name: 'Hidden', is_public: false }));

    const list = await listTemplates();

    expect(list).toHaveLength(2);
    expect(list.map((t) => t.name)).toEqual(expect.arrayContaining(['Public A', 'Public B']));
  });

  it('filters templates by category', async () => {
    await publishTemplate('u1', makeTemplate({ name: 'Pathway A', category: 'pathway' }));
    await publishTemplate('u2', makeTemplate({ name: 'Circuit B', category: 'circuit' }));
    await publishTemplate('u3', makeTemplate({ name: 'Pathway C', category: 'pathway' }));

    const pathways = await listTemplates('pathway');
    expect(pathways).toHaveLength(2);
    expect(pathways.every((t) => t.category === 'pathway')).toBe(true);

    const circuits = await listTemplates('circuit');
    expect(circuits).toHaveLength(1);
    expect(circuits[0].name).toBe('Circuit B');
  });

  it('returns empty array when no templates match', async () => {
    const list = await listTemplates('nonexistent');
    expect(list).toEqual([]);
  });

  it('returns templates ordered by created_at descending', async () => {
    const first = await publishTemplate('u1', makeTemplate({ name: 'First' }));
    // Small delay to ensure distinct timestamps
    await new Promise((r) => setTimeout(r, 10));
    const second = await publishTemplate('u2', makeTemplate({ name: 'Second' }));

    const list = await listTemplates();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('Second');
    expect(list[1].name).toBe('First');
    expect(list[0].created_at).toBeGreaterThanOrEqual(list[1].created_at);
  });

  // ── getTemplate ──────────────────────────────────────────────────────────

  it('retrieves a template by id', async () => {
    const published = await publishTemplate('user-5', makeTemplate({ name: 'Fetch Me' }));
    const fetched = await getTemplate(published.id);

    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(published.id);
    expect(fetched!.name).toBe('Fetch Me');
    expect(fetched!.project_data).toEqual({ targetProduct: 'artemisinin', nodes: 7 });
  });

  it('returns undefined for a nonexistent template id', async () => {
    const result = await getTemplate('nonexistent-id');
    expect(result).toBeUndefined();
  });

  // ── forkTemplate ─────────────────────────────────────────────────────────

  it('forks a template: creates a copy and increments source fork_count', async () => {
    const original = await publishTemplate('author-1', makeTemplate({ name: 'Original' }));
    const forked = await forkTemplate(original.id, 'forker-1');

    expect(forked).toBeDefined();
    expect(forked!.id).not.toBe(original.id);
    expect(forked!.name).toBe('Original');
    expect(forked!.author_id).toBe('forker-1');
    expect(forked!.fork_count).toBe(0);
    expect(forked!.project_data).toEqual(original.project_data);

    const sourceRow = await getTemplate(original.id);
    expect(sourceRow!.fork_count).toBe(1);
  });

  it('returns undefined when forking a nonexistent template', async () => {
    const result = await forkTemplate('nonexistent-id', 'user-x');
    expect(result).toBeUndefined();
  });

  // ── rateTemplate ─────────────────────────────────────────────────────────

  it('rates a template and updates aggregated scores', async () => {
    const template = await publishTemplate('author-2', makeTemplate());

    const rated = await rateTemplate(template.id, 'rater-1', 4);

    expect(rated).toBeDefined();
    expect(rated!.rating_count).toBe(1);
    expect(rated!.rating_avg).toBe(4);
    expect(rated!.star_count).toBe(1);
  });

  it('averages multiple ratings correctly', async () => {
    const template = await publishTemplate('author-3', makeTemplate());

    await rateTemplate(template.id, 'rater-a', 5);
    await rateTemplate(template.id, 'rater-b', 3);

    const updated = await getTemplate(template.id);
    expect(updated!.rating_count).toBe(2);
    expect(updated!.rating_avg).toBe(4);
    expect(updated!.star_count).toBe(2);
  });

  it('updates existing rating when same user rates again', async () => {
    const template = await publishTemplate('author-4', makeTemplate());

    await rateTemplate(template.id, 'rater-x', 2);
    await rateTemplate(template.id, 'rater-x', 5);

    const updated = await getTemplate(template.id);
    expect(updated!.rating_count).toBe(1);
    expect(updated!.rating_avg).toBe(5);
    expect(updated!.star_count).toBe(1);
  });

  it('returns undefined when rating a nonexistent template', async () => {
    const result = await rateTemplate('nonexistent-id', 'user-z', 3);
    expect(result).toBeUndefined();
  });
});
