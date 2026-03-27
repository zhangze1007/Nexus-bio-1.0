'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Activity, FlaskConical, Dna } from 'lucide-react';

const SERIF = "'DM Serif Display', Georgia, serif";
const BODY  = "'Public Sans', -apple-system, sans-serif";
const MONO  = "'Fira Code', 'Courier New', Courier, monospace";

const FEATURES = [
  {
    icon: Activity,
    title: 'Cellular Solvency & Toxicity',
    accent: '#EF4444',
    description:
      'Nexus-Bio continuously tracks intracellular ATP/NADPH cofactor ledgers across every pathway node, detecting metabolic insolvency before it crashes your fermentation run.',
    details: [
      'ATP & NADPH ledger computed per reaction step',
      'IC50 toxicity thresholds flagged for host strain growth inhibition',
      'Cofactor balance audited against genome-scale FBA models',
    ],
  },
  {
    icon: FlaskConical,
    title: 'Downstream Processing (DSP) Intelligence',
    accent: '#F59E0B',
    description:
      'Our engine predicts separation costs by analyzing structural analogs sharing similar polarity, boiling points, and logP with your target molecule — the hidden cost that kills 60% of bio-scale projects.',
    details: [
      'Structural analog detection via Tanimoto similarity scoring',
      'DSP bottleneck identification for co-eluting impurities',
      'Separation cost index quantifies purification difficulty (0–1)',
    ],
  },
  {
    icon: Dna,
    title: 'Genetic ROI & Carbon Efficiency',
    accent: '#10B981',
    description:
      'Nexus-Bio recommends precise gene Knockout (KO) or Overexpression (OE) interventions and calculates Atom Economy to maximize your Titer, Rate, and Yield (TRY) metrics.',
    details: [
      'KO/OE gene targets suggested for competing branch-point enzymes',
      'Carbon Efficiency (Atom Economy %) per intermediate node',
      'TRY-optimized flux redistribution scored against FBA predictions',
    ],
  },
];

// ── Terminal log lines ────────────────────────────────────────────────
type LineColor = 'system' | 'module' | 'compute' | 'result' | 'ok' | 'warning' | 'critical' | 'suggestion' | 'divider';

interface TerminalLine {
  text: string;
  color: LineColor;
}

const TERMINAL_SCRIPT: TerminalLine[] = [
  { text: '[SYSTEM] Initiating Nexus-Bio Engine v1.1...', color: 'system' },
  { text: '[MODULE] Loading pathway data: Artemisinin Biosynthesis', color: 'module' },
  { text: '[COMPUTING] Running Flux Balance Analysis (FBA)...', color: 'compute' },
  { text: '--------------------------------------------------', color: 'divider' },
  { text: '[METRIC] Carbon Efficiency (Atom Economy): Calculating...', color: 'compute' },
  { text: '[RESULT] Target MW: 282.33 -> Atom Economy: 50.0% [OK]', color: 'ok' },
  { text: '--------------------------------------------------', color: 'divider' },
  { text: '[ALERT] Scanning Downstream Processing (DSP) Bottlenecks...', color: 'warning' },
  { text: '[WARNING] Impurity Detected: Arteannuin B.', color: 'warning' },
  { text: '[ANALYSIS] Identical polarity to target. DSP Cost Index: 91% (CRITICAL)', color: 'critical' },
  { text: '--------------------------------------------------', color: 'divider' },
  { text: '[OPTIMIZATION] Generating Genetic Intervention Strategy...', color: 'compute' },
  { text: '[SUGGESTION] Knockout (KO): ERG9 to maximize FPP pool.', color: 'suggestion' },
  { text: '[SUGGESTION] Overexpress (OE): ZWF1 for NADPH supply.', color: 'suggestion' },
  { text: '[SYSTEM] Simulation Complete. Rebooting in 3s...', color: 'system' },
];

const LINE_COLORS: Record<LineColor, string> = {
  system:     '#64748B',
  module:     '#38BDF8',
  compute:    '#94A3B8',
  result:     '#CBD5E1',
  ok:         '#10B981',
  warning:    '#EF4444',
  critical:   '#EF4444',
  suggestion: '#10B981',
  divider:    '#334155',
};

// ── EngineTerminal Component ──────────────────────────────────────────
function EngineTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  const resetTerminal = useCallback(() => {
    setLines([]);
    setCurrentIndex(0);
    setCharIndex(0);
    setIsTyping(true);
  }, []);

  useEffect(() => {
    if (!isTyping) return;

    // All lines typed — pause then reboot
    if (currentIndex >= TERMINAL_SCRIPT.length) {
      const timer = setTimeout(resetTerminal, 3000);
      return () => clearTimeout(timer);
    }

    const currentLine = TERMINAL_SCRIPT[currentIndex];
    const fullText = currentLine.text;

    // Divider lines appear instantly
    if (currentLine.color === 'divider') {
      setLines(prev => [...prev, currentLine]);
      setCurrentIndex(prev => prev + 1);
      setCharIndex(0);
      return;
    }

    // Type character by character
    if (charIndex < fullText.length) {
      const speed = 18 + Math.random() * 22;
      const timer = setTimeout(() => {
        setCharIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    }

    // Line complete — add full line and move on
    setLines(prev => [...prev, currentLine]);
    const delay = currentLine.color === 'system' ? 600 : 200;
    const timer = setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setCharIndex(0);
    }, delay);
    return () => clearTimeout(timer);
  }, [currentIndex, charIndex, isTyping, resetTerminal]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, charIndex]);

  // Current line being typed (partial)
  const typingLine = currentIndex < TERMINAL_SCRIPT.length && TERMINAL_SCRIPT[currentIndex].color !== 'divider'
    ? TERMINAL_SCRIPT[currentIndex]
    : null;
  const partialText = typingLine ? typingLine.text.slice(0, charIndex) : '';

  return (
    <div style={{
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      {/* macOS title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }} />
        <span style={{
          marginLeft: '12px', fontFamily: MONO, fontSize: '11px',
          color: 'rgba(255,255,255,0.3)', fontFeatureSettings: "'tnum' 1",
        }}>
          nexus-bio-engine — live simulation
        </span>
      </div>

      {/* Terminal body */}
      <div
        ref={terminalRef}
        style={{
          background: '#0a0b10',
          padding: '16px 20px',
          height: '340px',
          overflowY: 'auto',
          fontFamily: MONO,
          fontSize: '12.5px',
          lineHeight: 1.8,
        }}
      >
        {/* Completed lines */}
        {lines.map((line, i) => (
          <div key={i} style={{ color: LINE_COLORS[line.color], whiteSpace: 'pre-wrap' }}>
            {line.color !== 'divider' ? `> ${line.text}` : line.text}
          </div>
        ))}

        {/* Currently typing line */}
        {typingLine && partialText.length > 0 && (
          <div style={{ color: LINE_COLORS[typingLine.color], whiteSpace: 'pre-wrap' }}>
            {'> '}{partialText}
            <span style={{
              display: 'inline-block', width: '7px', height: '14px',
              background: LINE_COLORS[typingLine.color],
              marginLeft: '2px', verticalAlign: 'middle',
              animation: 'engineCursorBlink 0.8s step-end infinite',
            }} />
          </div>
        )}

        {/* Blinking cursor when idle */}
        {!typingLine && currentIndex >= TERMINAL_SCRIPT.length && (
          <div style={{ color: '#64748B' }}>
            {'> '}
            <span style={{
              display: 'inline-block', width: '7px', height: '14px',
              background: '#64748B',
              marginLeft: '2px', verticalAlign: 'middle',
              animation: 'engineCursorBlink 0.8s step-end infinite',
            }} />
          </div>
        )}
      </div>

      {/* Cursor blink keyframes */}
      <style>{`
        @keyframes engineCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Feature Card ──────────────────────────────────────────────────────
function FeatureCard({ feature, index }: { feature: typeof FEATURES[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay: 0.12 * index, ease: [0.22, 1, 0.36, 1] }}
      style={{
        padding: '32px 28px',
        borderRadius: '24px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 48px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
      }}
    >
      {/* Icon badge */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '12px',
        background: `${feature.accent}18`,
        border: `1px solid ${feature.accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} style={{ color: feature.accent }} />
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: SERIF,
        fontSize: '20px',
        fontWeight: 400,
        color: 'rgba(255,255,255,0.9)',
        margin: 0,
        lineHeight: 1.25,
        letterSpacing: '-0.01em',
      }}>
        {feature.title}
      </h3>

      {/* Description */}
      <p style={{
        fontFamily: BODY,
        fontSize: '13px',
        color: 'rgba(255,255,255,0.45)',
        margin: 0,
        lineHeight: 1.7,
      }}>
        {feature.description}
      </p>

      {/* Detail bullets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        {feature.details.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: feature.accent,
              marginTop: '6px', flexShrink: 0, opacity: 0.7,
            }} />
            <span style={{
              fontFamily: BODY,
              fontSize: '12px',
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1.6,
            }}>
              {d}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────
export default function FeaturesArchitecture() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-80px' });

  return (
    <section
      id="architecture"
      ref={sectionRef}
      style={{ padding: 'clamp(64px, 10vw, 120px) clamp(16px, 4vw, 40px)' }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: '48px' }}
        >
          <p style={{
            fontFamily: BODY, fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.22)', margin: '0 0 12px',
          }}>
            02 · Engine Architecture
          </p>
          <h2 style={{
            fontFamily: SERIF,
            fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.92)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            margin: '0 0 14px',
          }}>
            Under the Hood
          </h2>
          <p style={{
            fontFamily: BODY, fontSize: '14px',
            color: 'rgba(255,255,255,0.35)',
            margin: 0, lineHeight: 1.65, maxWidth: '560px',
          }}>
            Three proprietary analysis engines power every Nexus-Bio pathway — from cofactor
            ledgers to DSP economics. No black boxes, full auditability.
          </p>
        </motion.div>

        {/* 3-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginBottom: '48px',
        }}>
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>

        {/* Live Computation Terminal */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <EngineTerminal />
        </motion.div>
      </div>
    </section>
  );
}
