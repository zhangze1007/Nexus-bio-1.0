/** @jest-environment node */

import {
  createPage,
  getPage,
  updatePage,
  listPages,
  getPageHistory,
  generateSlug,
  resetSchemaReady,
  type CreatePageInput,
} from '../src/services/knowledge/wikiService';
import { sqlRun, sqlAll, closeLibsqlClient } from '../src/server/libsqlDb';

afterAll(() => {
  closeLibsqlClient();
});

describe('wikiService', () => {
  beforeEach(async () => {
    await sqlRun('DROP TABLE IF EXISTS wiki_revisions').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS wiki_pages').catch(() => {});
    resetSchemaReady();
  });

  afterEach(async () => {
    await sqlRun('DROP TABLE IF EXISTS wiki_revisions').catch(() => {});
    await sqlRun('DROP TABLE IF EXISTS wiki_pages').catch(() => {});
  });

  function makeInput(overrides?: Partial<CreatePageInput>): CreatePageInput {
    return {
      projectId: 'proj-1',
      title: 'CRISPR Protocol v2',
      content: '# CRISPR Protocol\n\nStep 1: Design gRNA',
      category: 'protocol',
      userId: 'user-1',
      ...overrides,
    };
  }

  // ── generateSlug ────────────────────────────────────────────────────────

  it('generates a URL-friendly slug from a title', () => {
    expect(generateSlug('CRISPR Protocol v2')).toBe('crispr-protocol-v2');
    expect(generateSlug('  Hello World  ')).toBe('hello-world');
    expect(generateSlug('Special!@#$%Chars')).toBe('special-chars');
    expect(generateSlug('multiple---dashes')).toBe('multiple-dashes');
  });

  // ── createPage ──────────────────────────────────────────────────────────

  it('creates a page and returns it with generated id, slug, and version 1', async () => {
    const result = await createPage(makeInput());

    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.title).toBe('CRISPR Protocol v2');
    expect(result.slug).toBe('crispr-protocol-v2');
    expect(result.content).toBe('# CRISPR Protocol\n\nStep 1: Design gRNA');
    expect(result.project_id).toBe('proj-1');
    expect(result.category).toBe('protocol');
    expect(result.created_by).toBe('user-1');
    expect(result.last_edited_by).toBe('user-1');
    expect(result.version).toBe(1);
    expect(result.created_at).toBeDefined();
    expect(result.updated_at).toBeDefined();
  });

  it('persists the page to the database', async () => {
    const created = await createPage(makeInput({ title: 'Persist Test' }));
    const rows = await sqlAll('SELECT * FROM wiki_pages WHERE id = ?', [created.id]);

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Persist Test');
    expect(rows[0].project_id).toBe('proj-1');
  });

  it('creates an initial revision when creating a page', async () => {
    const created = await createPage(makeInput());
    const revisions = await sqlAll('SELECT * FROM wiki_revisions WHERE page_id = ?', [created.id]);

    expect(revisions).toHaveLength(1);
    expect(revisions[0].version).toBe(1);
    expect(revisions[0].content).toBe('# CRISPR Protocol\n\nStep 1: Design gRNA');
    expect(revisions[0].change_summary).toBe('Initial creation');
  });

  it('defaults category and userId to null when not provided', async () => {
    const result = await createPage({ projectId: 'proj-x', title: 'No Category', content: 'text' });

    expect(result.category).toBeNull();
    expect(result.created_by).toBeNull();
    expect(result.last_edited_by).toBeNull();
  });

  // ── getPage ─────────────────────────────────────────────────────────────

  it('retrieves a page by id', async () => {
    const created = await createPage(makeInput({ title: 'Fetch Me' }));
    const fetched = await getPage(created.id);

    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.title).toBe('Fetch Me');
    expect(fetched!.content).toBe('# CRISPR Protocol\n\nStep 1: Design gRNA');
  });

  it('returns undefined for a nonexistent page id', async () => {
    const result = await getPage('nonexistent-id');
    expect(result).toBeUndefined();
  });

  // ── updatePage ──────────────────────────────────────────────────────────

  it('updates page content and increments version', async () => {
    const created = await createPage(makeInput());
    const updated = await updatePage(created.id, {
      content: 'Updated content here',
      userId: 'user-2',
      changeSummary: 'Fixed typo',
    });

    expect(updated).toBeDefined();
    expect(updated!.content).toBe('Updated content here');
    expect(updated!.version).toBe(2);
    expect(updated!.last_edited_by).toBe('user-2');
    expect(updated!.updated_at).not.toBe(created.updated_at);
  });

  it('creates a revision on each update', async () => {
    const created = await createPage(makeInput());

    await updatePage(created.id, { content: 'v2 content', userId: 'user-2', changeSummary: 'First edit' });
    await updatePage(created.id, { content: 'v3 content', userId: 'user-3', changeSummary: 'Second edit' });

    const revisions = await getPageHistory(created.id);
    expect(revisions).toHaveLength(3); // 1 initial + 2 updates
    expect(revisions.map((r) => r.version)).toEqual([3, 2, 1]);
    expect(revisions[0].change_summary).toBe('Second edit');
    expect(revisions[1].change_summary).toBe('First edit');
  });

  it('returns undefined when updating a nonexistent page', async () => {
    const result = await updatePage('nonexistent-id', { content: 'nope' });
    expect(result).toBeUndefined();
  });

  // ── listPages ───────────────────────────────────────────────────────────

  it('lists pages for a project', async () => {
    await createPage(makeInput({ title: 'Page A' }));
    await createPage(makeInput({ title: 'Page B' }));
    await createPage(makeInput({ projectId: 'proj-2', title: 'Other Project' }));

    const pages = await listPages('proj-1');
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.title)).toEqual(expect.arrayContaining(['Page A', 'Page B']));
  });

  it('filters pages by category', async () => {
    await createPage(makeInput({ title: 'Protocol A', category: 'protocol' }));
    await createPage(makeInput({ title: 'Design B', category: 'design' }));
    await createPage(makeInput({ title: 'Protocol C', category: 'protocol' }));

    const protocols = await listPages('proj-1', 'protocol');
    expect(protocols).toHaveLength(2);
    expect(protocols.every((p) => p.category === 'protocol')).toBe(true);

    const designs = await listPages('proj-1', 'design');
    expect(designs).toHaveLength(1);
    expect(designs[0].title).toBe('Design B');
  });

  it('returns empty array when no pages match', async () => {
    const pages = await listPages('nonexistent-project');
    expect(pages).toEqual([]);
  });

  // ── getPageHistory ──────────────────────────────────────────────────────

  it('returns revision history ordered by version descending', async () => {
    const created = await createPage(makeInput({ title: 'History Test' }));

    await updatePage(created.id, { content: 'v2', changeSummary: 'edit 1' });
    await new Promise((r) => setTimeout(r, 10));
    await updatePage(created.id, { content: 'v3', changeSummary: 'edit 2' });

    const history = await getPageHistory(created.id);

    expect(history).toHaveLength(3);
    expect(history[0].version).toBe(3);
    expect(history[1].version).toBe(2);
    expect(history[2].version).toBe(1);
    expect(history[0].change_summary).toBe('edit 2');
    expect(history[2].change_summary).toBe('Initial creation');
  });

  it('returns empty array for a page with no revisions (nonexistent page)', async () => {
    const history = await getPageHistory('nonexistent-id');
    expect(history).toEqual([]);
  });
});
