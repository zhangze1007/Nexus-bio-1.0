'use client';

import { motion, type Variants } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

const HEADER = "'Inter',-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',monospace";

const cardVariants: Variants = {
  rest: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.08)',
    y: 0,
    boxShadow: '0 0 0 rgba(0,0,0,0)',
  },
  hover: {
    backgroundColor: 'rgba(255,255,255,0.048)',
    borderColor: 'rgba(255,255,255,0.18)',
    y: -3,
    boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
  },
  press: {
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderColor: 'rgba(255,255,255,0.24)',
    y: -1,
    boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
  },
};

const iconVariants: Variants = {
  rest: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.10)',
    scale: 1,
  },
  hover: {
    backgroundColor: 'rgba(255,255,255,0.085)',
    borderColor: 'rgba(255,255,255,0.18)',
    scale: 1.03,
  },
  press: {
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderColor: 'rgba(255,255,255,0.22)',
    scale: 0.99,
  },
};

const footerVariants: Variants = {
  rest: { color: 'rgba(255,255,255,0.38)' },
  hover: { color: 'rgba(255,255,255,0.7)' },
  press: { color: '#FFFFFF' },
};

const arrowVariants: Variants = {
  rest: { x: 0 },
  hover: { x: 3 },
  press: { x: 1 },
};

export interface HomeInteractiveCardProps {
  href?: string;
  icon: ReactNode;
  label: string;
  title: string;
  description: string;
  footer?: string;
  external?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  showArrow?: boolean;
  focusable?: boolean;
}

export default function HomeInteractiveCard({
  href,
  icon,
  label,
  title,
  description,
  footer,
  external,
  children,
  style,
  showArrow = Boolean(href),
  focusable = !href,
}: HomeInteractiveCardProps) {
  const sharedProps = {
    initial: 'rest' as const,
    animate: 'rest' as const,
    whileHover: 'hover' as const,
    whileFocus: 'hover' as const,
    whileTap: 'press' as const,
    variants: cardVariants,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
    style: {
      display: 'flex',
      flexDirection: 'column' as const,
      minHeight: '100%',
      padding: '28px',
      textDecoration: 'none',
      border: '0.5px solid rgba(255,255,255,0.08)',
      outline: 'none',
      ...style,
    },
  };

  const body = (
    <>
      <motion.div
        variants={iconVariants}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          border: '0.5px solid rgba(255,255,255,0.10)',
        }}
      >
        {icon}
      </motion.div>

      <p
        style={{
          fontFamily: MONO,
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.28)',
          margin: '0 0 6px',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: HEADER,
          fontSize: '15px',
          fontWeight: 600,
          color: '#FFFFFF',
          margin: '0 0 8px',
          lineHeight: 1.35,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontFamily: HEADER,
          fontSize: '12px',
          color: 'rgba(255,255,255,0.34)',
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>

      {children ? <div style={{ marginTop: '18px', flex: 1 }}>{children}</div> : <div style={{ flex: 1 }} />}

      {footer ? (
        <motion.div
          variants={footerVariants}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            marginTop: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontFamily: HEADER,
          }}
        >
          <span>{footer}</span>
          {showArrow ? (
            <motion.span variants={arrowVariants} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              <ArrowRight size={11} />
            </motion.span>
          ) : null}
        </motion.div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <motion.a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        {...sharedProps}
      >
        {body}
      </motion.a>
    );
  }

  return (
    <motion.div
      tabIndex={focusable ? 0 : undefined}
      {...sharedProps}
    >
      {body}
    </motion.div>
  );
}
