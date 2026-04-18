/** @jest-environment node */
/**
 * axonDomainClassifier — honest domain routing.
 *
 * The classifier is the PR-5 gate that stops "Who is Donald Trump" from
 * being forced into biosynthesis mode. These tests pin the decision tree
 * category-by-category and assert the `shouldPlan`, `allowBiosynthesisPrompt`,
 * and `allowProseAnswer` flags so neither side of the gate can silently
 * regress.
 */
import {
  classifyAxonDomain,
  domainCategoryLabel,
} from '../src/services/axonDomainClassifier';

describe('classifyAxonDomain', () => {
  it('returns ambiguous for empty input', () => {
    const r = classifyAxonDomain('');
    expect(r.category).toBe('ambiguous');
    expect(r.shouldPlan).toBe(false);
    expect(r.allowBiosynthesisPrompt).toBe(false);
    expect(r.allowProseAnswer).toBe(false);
  });

  it('classifies pathway biosynthesis queries as scientific-pathway', () => {
    const r = classifyAxonDomain('Design a biosynthesis pathway for artemisinin');
    expect(r.category).toBe('scientific-pathway');
    expect(r.shouldPlan).toBe(true);
    expect(r.allowBiosynthesisPrompt).toBe(true);
    expect(r.signals.length).toBeGreaterThan(0);
  });

  it('classifies flux-balance queries as scientific-pathway', () => {
    const r = classifyAxonDomain('Run an FBA knockout sweep on the current model');
    expect(r.category).toBe('scientific-pathway');
    expect(r.shouldPlan).toBe(true);
  });

  it('classifies adjacent science questions as scientific-adjacent', () => {
    const r = classifyAxonDomain('Explain how mRNA differs from DNA briefly');
    expect(r.category).toBe('scientific-adjacent');
    expect(r.shouldPlan).toBe(false);
    expect(r.allowBiosynthesisPrompt).toBe(false);
    expect(r.allowProseAnswer).toBe(true);
  });

  it('classifies workbench-state questions as workbench-ops', () => {
    const r = classifyAxonDomain('Summarise saved evidence and recommend the next tool');
    expect(r.category).toBe('workbench-ops');
    expect(r.shouldPlan).toBe(false);
    expect(r.allowBiosynthesisPrompt).toBe(false);
    expect(r.allowProseAnswer).toBe(true);
    expect(r.signals.length).toBeGreaterThan(0);
  });

  it('classifies off-domain celebrity lookups as off-domain and blocks biosynthesis', () => {
    const r = classifyAxonDomain('Who is Donald Trump');
    expect(r.category).toBe('off-domain');
    expect(r.shouldPlan).toBe(false);
    expect(r.allowBiosynthesisPrompt).toBe(false);
    expect(r.allowProseAnswer).toBe(false);
  });

  it('classifies biographical probes about unknown subjects as off-domain', () => {
    const r = classifyAxonDomain('Who is Jane Q Stranger');
    expect(r.category).toBe('off-domain');
    expect(r.allowBiosynthesisPrompt).toBe(false);
  });

  it('allows biographical probes about in-domain subjects as scientific-adjacent', () => {
    const r = classifyAxonDomain('Tell me about the mevalonate pathway briefly');
    // Mevalonate is both a PATHD keyword and an in-domain subject. Either
    // pathway or adjacent is an acceptable honest outcome; both allow prose.
    expect(['scientific-pathway', 'scientific-adjacent']).toContain(r.category);
    expect(r.allowProseAnswer).toBe(true);
  });

  it('classifies weather / news queries as off-domain', () => {
    const r = classifyAxonDomain("What's the weather in Kuala Lumpur today");
    expect(r.category).toBe('off-domain');
    expect(r.shouldPlan).toBe(false);
  });

  it('classifies very short generic queries as general-knowledge with no prose', () => {
    const r = classifyAxonDomain('hello');
    expect(r.category).toBe('general-knowledge');
    expect(r.allowProseAnswer).toBe(false);
  });

  it('classifies longer unclassifiable queries as ambiguous and allows prose', () => {
    const r = classifyAxonDomain(
      'I am thinking about a thing and also another thing which might be relevant',
    );
    expect(r.category).toBe('ambiguous');
    expect(r.allowProseAnswer).toBe(true);
    expect(r.shouldPlan).toBe(false);
  });

  it('off-domain wins over adjacent when both signals appear but no pathway signal', () => {
    const r = classifyAxonDomain('Did Donald Trump ever mention enzymes at a rally');
    expect(r.category).toBe('off-domain');
  });

  it('pathway signal overrides off-domain when both appear', () => {
    const r = classifyAxonDomain(
      'Design a biosynthesis pathway that the president of the council could fund',
    );
    expect(r.category).toBe('scientific-pathway');
    expect(r.allowBiosynthesisPrompt).toBe(true);
  });

  it('exposes human-readable labels for every category', () => {
    const cats = [
      'scientific-pathway',
      'scientific-adjacent',
      'workbench-ops',
      'general-knowledge',
      'off-domain',
      'ambiguous',
    ] as const;
    for (const c of cats) {
      const label = domainCategoryLabel(c);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('signals are distinct and lowercase', () => {
    const r = classifyAxonDomain('knockout FBA pathway biosynthesis yield');
    expect(new Set(r.signals).size).toBe(r.signals.length);
    for (const s of r.signals) expect(s).toBe(s.toLowerCase());
  });

  it('reason is always a non-empty string', () => {
    const samples = [
      '',
      'Who is Donald Trump',
      'Design a biosynthesis pathway',
      'explain kinetics',
      'saved evidence and next tool',
      'hi',
    ];
    for (const s of samples) {
      const r = classifyAxonDomain(s);
      expect(typeof r.reason).toBe('string');
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});
