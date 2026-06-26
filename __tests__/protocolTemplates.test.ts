import { PROTOCOL_TEMPLATES, getTemplate, getTemplatesByCategory, getCategories } from '../src/data/protocols/templates';

describe('Protocol Templates', () => {
  it('should have 10 templates', () => {
    expect(PROTOCOL_TEMPLATES).toHaveLength(10);
  });

  it('each template should have valid structure', () => {
    for (const template of PROTOCOL_TEMPLATES) {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.category).toBeTruthy();
      expect(template.difficulty).toMatch(/beginner|intermediate|advanced/);
      expect(template.steps.length).toBeGreaterThanOrEqual(3);
      expect(template.equipment.length).toBeGreaterThan(0);
      expect(template.reagents.length).toBeGreaterThan(0);
      expect(template.qcCriteria.length).toBeGreaterThan(0);
    }
  });

  it('getTemplate should return template by id', () => {
    const gibson = getTemplate('gibson-assembly');
    expect(gibson).toBeDefined();
    expect(gibson!.name).toBe('Gibson Assembly');
  });

  it('getTemplate should return undefined for unknown id', () => {
    expect(getTemplate('nonexistent')).toBeUndefined();
  });

  it('getTemplatesByCategory should filter correctly', () => {
    const cloning = getTemplatesByCategory('cloning');
    expect(cloning.length).toBe(2); // Golden Gate + Gibson
    expect(cloning.every(t => t.category === 'cloning')).toBe(true);
  });

  it('getCategories should return unique categories', () => {
    const categories = getCategories();
    expect(categories).toContain('cloning');
    expect(categories).toContain('transformation');
    expect(categories).toContain('expression');
    expect(new Set(categories).size).toBe(categories.length);
  });
});
