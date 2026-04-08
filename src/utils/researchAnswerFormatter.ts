import { extractJSON } from './jsonParser';

export interface ResearchAnswerSection {
  id: 'summary' | 'observations' | 'interpretation' | 'next-steps';
  title: string;
  paragraphs: string[];
  bullets: string[];
}

export interface FormattedResearchAnswer {
  sections: ResearchAnswerSection[];
}

const SECTION_TITLES: Record<ResearchAnswerSection['id'], string> = {
  summary: 'Summary',
  observations: 'Key observations',
  interpretation: 'Interpretation',
  'next-steps': 'Recommended next steps',
};

const NEXT_STEP_PATTERN = /\b(recommend|recommended|next step|next move|should|consider|validate|test|prioritiz|follow-up|rerun)\b/i;

function createSection(
  id: ResearchAnswerSection['id'],
  paragraphs: string[] = [],
  bullets: string[] = [],
): ResearchAnswerSection | null {
  const cleanParagraphs = paragraphs.map((entry) => entry.trim()).filter(Boolean);
  const cleanBullets = bullets.map((entry) => entry.trim()).filter(Boolean);
  if (cleanParagraphs.length === 0 && cleanBullets.length === 0) return null;
  return {
    id,
    title: SECTION_TITLES[id],
    paragraphs: cleanParagraphs,
    bullets: cleanBullets,
  };
}

function normalizeText(raw: string) {
  return raw
    .replace(/```(?:json|markdown)?/gi, '')
    .replace(/```/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function splitParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function prettifyKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}` : '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value
      .map((entry) => stringifyValue(entry))
      .filter(Boolean)
      .join(', ');
  }
  if (value && typeof value === 'object') {
    const pairs = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        const rendered = stringifyValue(entry);
        return rendered ? `${prettifyKey(key)}: ${rendered}` : '';
      })
      .filter(Boolean);
    return pairs.join(' · ');
  }
  return '';
}

function formatObjectBullet(entry: unknown) {
  if (!entry || typeof entry !== 'object') return stringifyValue(entry);
  const record = entry as Record<string, unknown>;
  const headline = record.enzyme
    ?? record.label
    ?? record.title
    ?? record.name
    ?? record.id
    ?? '';
  const detailCandidates = [
    record.summary,
    record.description,
    record.detail,
    record.rationale,
    record.reasoning,
    record.evidence,
    record.interpretation,
  ]
    .map((value) => stringifyValue(value))
    .filter(Boolean);

  const metricParts = Object.entries(record)
    .filter(([key]) => !['enzyme', 'label', 'title', 'name', 'id', 'summary', 'description', 'detail', 'rationale', 'reasoning', 'evidence', 'interpretation'].includes(key))
    .map(([key, value]) => {
      const rendered = stringifyValue(value);
      return rendered ? `${prettifyKey(key)} ${rendered}` : '';
    })
    .filter(Boolean)
    .slice(0, 3);

  const tail = [...detailCandidates.slice(0, 1), ...metricParts].filter(Boolean).join(' · ');
  if (headline && tail) return `${headline}: ${tail}`;
  return headline ? `${headline}` : tail;
}

function takeString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const rendered = stringifyValue(value);
    if (rendered) return rendered;
  }
  return '';
}

function takeArray(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [] as unknown[];
}

function formatStructuredObject(record: Record<string, unknown>): ResearchAnswerSection[] {
  const isPathwayLike = Array.isArray(record.nodes)
    || Array.isArray(record.bottleneck_enzymes)
    || Boolean(record.axon_interaction)
    || Array.isArray(record.pathwayCandidates)
    || Array.isArray(record.pathwayCandidates);

  const summaryParagraphs: string[] = [];
  const observationBullets: string[] = [];
  const interpretationParagraphs: string[] = [];
  const nextStepBullets: string[] = [];

  if (isPathwayLike) {
    const axonInteraction = record.axon_interaction && typeof record.axon_interaction === 'object'
      ? record.axon_interaction as Record<string, unknown>
      : null;
    const nodes = Array.isArray(record.nodes) ? record.nodes : [];
    const bottlenecks = Array.isArray(record.bottleneck_enzymes) ? record.bottleneck_enzymes : [];

    const summary = takeString(record, 'summary', 'answer', 'overview', 'question')
      || takeString(axonInteraction ?? {}, 'question', 'summary', 'answer')
      || (nodes.length > 0
        ? `Axon returned a structured pathway analysis covering ${nodes.length} pathway node${nodes.length === 1 ? '' : 's'}.`
        : 'Axon returned a structured pathway analysis.');
    summaryParagraphs.push(summary);

    observationBullets.push(
      ...bottlenecks
        .map((entry) => formatObjectBullet(entry))
        .filter(Boolean)
        .slice(0, 4),
    );

    if (observationBullets.length === 0 && nodes.length > 0) {
      observationBullets.push(
        ...nodes
          .slice(0, 4)
          .map((entry) => formatObjectBullet(entry))
          .filter(Boolean),
      );
    }

    const interpretation = takeString(record, 'interpretation', 'reasoning', 'discussion')
      || takeString(axonInteraction ?? {}, 'interpretation', 'reasoning');
    if (interpretation) interpretationParagraphs.push(interpretation);

    nextStepBullets.push(
      ...takeArray(axonInteraction ?? {}, 'options')
        .map((entry) => stringifyValue(entry))
        .filter(Boolean),
      ...takeArray(record, 'recommended_next_steps', 'next_steps', 'recommendations', 'recommendedNextTools')
        .map((entry) => stringifyValue(entry))
        .filter(Boolean),
    );
  } else {
    const summary = takeString(record, 'summary', 'answer', 'overview', 'explanation', 'message');
    if (summary) summaryParagraphs.push(summary);

    const interpretation = takeString(record, 'interpretation', 'reasoning', 'discussion', 'analysis');
    if (interpretation) interpretationParagraphs.push(interpretation);

    nextStepBullets.push(
      ...takeArray(record, 'recommended_next_steps', 'next_steps', 'recommendations', 'actions')
        .map((entry) => formatObjectBullet(entry))
        .filter(Boolean),
    );

    for (const [key, value] of Object.entries(record)) {
      if (
        ['summary', 'answer', 'overview', 'explanation', 'message', 'interpretation', 'reasoning', 'discussion', 'analysis', 'recommended_next_steps', 'next_steps', 'recommendations', 'actions'].includes(key)
      ) {
        continue;
      }

      if (Array.isArray(value)) {
        const bucket = NEXT_STEP_PATTERN.test(key) ? nextStepBullets : observationBullets;
        bucket.push(
          ...value
            .map((entry) => formatObjectBullet(entry))
            .filter(Boolean),
        );
        continue;
      }

      if (value && typeof value === 'object') {
        observationBullets.push(`${prettifyKey(key)}: ${formatObjectBullet(value)}`);
        continue;
      }

      const rendered = stringifyValue(value);
      if (rendered) observationBullets.push(`${prettifyKey(key)}: ${rendered}`);
    }
  }

  const fallbackSummary = summaryParagraphs.length === 0 && observationBullets.length > 0
    ? [`Structured output was reformatted into a readable research brief.`]
    : [];

  return [
    createSection('summary', [...summaryParagraphs, ...fallbackSummary]),
    createSection('observations', [], observationBullets),
    createSection('interpretation', interpretationParagraphs),
    createSection('next-steps', [], nextStepBullets),
  ].filter(Boolean) as ResearchAnswerSection[];
}

function parseHeadedText(text: string): ResearchAnswerSection[] | null {
  const lines = text.split('\n');
  const buckets: Record<ResearchAnswerSection['id'], string[]> = {
    summary: [],
    observations: [],
    interpretation: [],
    'next-steps': [],
  };
  let currentSection: ResearchAnswerSection['id'] | null = null;

  const headingMap: Array<[RegExp, ResearchAnswerSection['id']]> = [
    [/^(?:#+\s*)?(?:\*\*)?summary(?:\*\*)?:?$/i, 'summary'],
    [/^(?:#+\s*)?(?:\*\*)?(?:key observations|observations|findings)(?:\*\*)?:?$/i, 'observations'],
    [/^(?:#+\s*)?(?:\*\*)?interpretation(?:\*\*)?:?$/i, 'interpretation'],
    [/^(?:#+\s*)?(?:\*\*)?(?:recommended next steps|next steps|recommendations)(?:\*\*)?:?$/i, 'next-steps'],
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentSection) buckets[currentSection].push('');
      continue;
    }

    const heading = headingMap.find(([pattern]) => pattern.test(line));
    if (heading) {
      currentSection = heading[1];
      continue;
    }

    if (!currentSection) continue;
    buckets[currentSection].push(line);
  }

  const hasAnyHeadingContent = Object.values(buckets).some((entries) => entries.length > 0);
  if (!hasAnyHeadingContent) return null;

  return (Object.keys(buckets) as ResearchAnswerSection['id'][])
    .map((id) => {
      const entries = buckets[id].filter((entry, index, all) => entry || all[index - 1]);
      const bullets = entries
        .filter((entry) => /^[-*•]\s+/.test(entry))
        .map((entry) => entry.replace(/^[-*•]\s+/, '').trim());
      const paragraphs = entries
        .filter((entry) => !/^[-*•]\s+/.test(entry))
        .join('\n')
        .split(/\n{2,}/)
        .map((entry) => entry.replace(/\n+/g, ' ').trim())
        .filter(Boolean);
      return createSection(id, paragraphs, bullets);
    })
    .filter(Boolean) as ResearchAnswerSection[];
}

function formatPlainText(text: string): ResearchAnswerSection[] {
  const headed = parseHeadedText(text);
  if (headed) return headed;

  const lines = text.split('\n').map((entry) => entry.trim()).filter(Boolean);
  const bulletLines = lines
    .filter((entry) => /^[-*•]\s+/.test(entry))
    .map((entry) => entry.replace(/^[-*•]\s+/, '').trim());
  const proseParagraphs = splitParagraphs(
    text
      .split('\n')
      .filter((entry) => !/^[-*•]\s+/.test(entry.trim()))
      .join('\n'),
  );

  const summaryParagraph = proseParagraphs[0] ?? bulletLines[0] ?? '';
  const remainingParagraphs = summaryParagraph ? proseParagraphs.slice(1) : proseParagraphs;

  const observationBullets = bulletLines.filter((entry) => !NEXT_STEP_PATTERN.test(entry));
  const nextStepBullets = bulletLines.filter((entry) => NEXT_STEP_PATTERN.test(entry));

  if (observationBullets.length === 0 && remainingParagraphs.length > 0) {
    const sentences = remainingParagraphs.flatMap((paragraph) => splitSentences(paragraph));
    for (const sentence of sentences) {
      if (NEXT_STEP_PATTERN.test(sentence)) {
        nextStepBullets.push(sentence);
      } else if (observationBullets.length < 4) {
        const semicolonParts = sentence
          .split(/\s*;\s*/)
          .map((entry) => entry.trim())
          .filter(Boolean);
        if (semicolonParts.length > 1) {
          observationBullets.push(...semicolonParts.slice(0, 4 - observationBullets.length));
        } else {
          observationBullets.push(sentence);
        }
      }
    }
  }

  const interpretationParagraphs = remainingParagraphs.filter(
    (paragraph) => !splitSentences(paragraph).every((sentence) => observationBullets.includes(sentence) || nextStepBullets.includes(sentence)),
  );

  return [
    createSection('summary', summaryParagraph ? [summaryParagraph] : []),
    createSection('observations', [], observationBullets),
    createSection('interpretation', interpretationParagraphs),
    createSection('next-steps', [], nextStepBullets),
  ].filter(Boolean) as ResearchAnswerSection[];
}

export function formatResearchAnswer(raw: string): FormattedResearchAnswer {
  const text = normalizeText(raw);
  if (!text) return { sections: [] };

  const parsed = extractJSON(text);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return { sections: formatStructuredObject(parsed as Record<string, unknown>) };
  }

  if (Array.isArray(parsed)) {
    return {
      sections: [
        createSection('summary', ['Structured output was reformatted into a readable research brief.']),
        createSection(
          'observations',
          [],
          parsed.map((entry) => formatObjectBullet(entry)).filter(Boolean),
        ),
      ].filter(Boolean) as ResearchAnswerSection[],
    };
  }

  return { sections: formatPlainText(text) };
}
