"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { THEME } from "../../theme";

interface StatItem {
  value: number;
  suffix: string;
  label: string;
  accentColor: string;
}

const STATS: StatItem[] = [
  { value: 14, suffix: "", label: "Integrated Tools", accentColor: THEME.MINT },
  { value: 20, suffix: "+", label: "Real Algorithms", accentColor: THEME.SKY },
  { value: 1000, suffix: "+", label: "Tests", accentColor: THEME.LILAC },
  { value: 100, suffix: "%", label: "Open Source", accentColor: THEME.APRICOT },
];

/** Eases out for a satisfying deceleration. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function AnimatedCounter({
  target,
  suffix,
  inView,
}: {
  target: number;
  suffix: string;
  inView: boolean;
}) {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current) return;
    hasAnimated.current = true;

    const duration = 1600; // ms
    const frameRate = 1000 / 60;
    const totalFrames = Math.round(duration / frameRate);
    let frame = 0;

    const timer = setInterval(() => {
      frame++;
      const progress = easeOutCubic(frame / totalFrames);
      setCount(Math.round(progress * target));

      if (frame >= totalFrames) {
        setCount(target);
        clearInterval(timer);
      }
    }, frameRate);

    return () => clearInterval(timer);
  }, [inView, target]);

  return (
    <span>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

function StatCard({
  stat,
  index,
  inView,
}: {
  stat: StatItem;
  index: number;
  inView: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
      className="text-center"
    >
      <div
        className="text-3xl sm:text-4xl font-bold mb-1"
        style={{ fontFamily: THEME.BRAND, color: THEME.VALUE }}
      >
        <AnimatedCounter
          target={stat.value}
          suffix={stat.suffix}
          inView={inView}
        />
      </div>
      <div
        className="text-xs sm:text-sm"
        style={{ fontFamily: THEME.SANS, color: THEME.LABEL }}
      >
        {stat.label}
      </div>
      {/* Accent underline */}
      <div
        className="mx-auto mt-2 h-0.5 w-8 rounded-full"
        style={{ backgroundColor: stat.accentColor, opacity: 0.5 }}
      />
    </motion.div>
  );
}

export default function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section
      className="py-16 lg:py-20"
      style={{
        backgroundColor: THEME.BG_SHELL,
        borderTop: `1px solid ${THEME.BORDER}`,
        borderBottom: `1px solid ${THEME.BORDER}`,
      }}
    >
      <div ref={ref} className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 lg:gap-12">
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
