import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';
import { formatResearchAnswer } from '../../../utils/researchAnswerFormatter';

interface ResearchAnswerRendererProps {
  answer: string;
  compact?: boolean;
}

export default function ResearchAnswerRenderer({
  answer,
  compact = false,
}: ResearchAnswerRendererProps) {
  const { sections } = formatResearchAnswer(answer);
  if (sections.length === 0) return null;

  return (
    <div style={{ display: 'grid', gap: compact ? '10px' : '12px' }}>
      {sections.map((section) => (
        <section key={section.id} style={{ display: 'grid', gap: compact ? '6px' : '8px' }}>
          <div
            style={{
              fontFamily: T.MONO,
              fontSize: compact ? '8px' : '9px',
              color: PATHD_THEME.label,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {section.title}
          </div>

          {section.paragraphs.map((paragraph, index) => (
            <p
              key={`${section.id}-paragraph-${index}`}
              style={{
                color: PATHD_THEME.value,
                fontSize: compact ? '11px' : '12px',
                lineHeight: 1.7,
                margin: 0,
                fontFamily: T.SANS,
              }}
            >
              {paragraph}
            </p>
          ))}

          {section.bullets.length > 0 && (
            <div style={{ display: 'grid', gap: compact ? '6px' : '7px' }}>
              {section.bullets.map((bullet, index) => (
                <div
                  key={`${section.id}-bullet-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '10px minmax(0, 1fr)',
                    gap: '8px',
                    alignItems: 'start',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: PATHD_THEME.sky,
                      marginTop: '7px',
                      boxShadow: '0 0 0 3px rgba(175,195,214,0.12)',
                    }}
                  />
                  <p
                    style={{
                      color: PATHD_THEME.value,
                      fontSize: compact ? '11px' : '12px',
                      lineHeight: 1.65,
                      margin: 0,
                      fontFamily: T.SANS,
                    }}
                  >
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
