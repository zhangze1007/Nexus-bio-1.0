import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <section className="relative w-full min-h-[80vh] flex flex-col items-center justify-center bg-zinc-950 text-white overflow-hidden px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_#3a1510_0%,_transparent_60%),radial-gradient(circle_at_10%_80%,_#4ade80_0%,_transparent_50%)] opacity-40 blur-[60px]" />
      
      <div className="z-10 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-6xl md:text-8xl font-sans font-bold tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
            Nexus-Bio
          </h1>
          <p className="text-sm md:text-base font-mono text-emerald-400 mb-8 uppercase tracking-widest">
            Next-Gen Bio-Intelligent Architecture (下一代生物智能架构)
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-6 text-zinc-300"
        >
          <p className="text-xl md:text-2xl font-medium text-white">
            Engineering the future of sustainable food systems through precision fermentation.
          </p>
          <p className="text-lg">
            We harness microbial cell factories to produce high-value functional ingredients with high yields and purity, minimizing environmental impact.
          </p>
          <p className="text-base text-zinc-400 max-w-2xl mx-auto">
            By integrating advanced omics technologies and synthetic biology, Nexus-Bio accelerates the transition to a circular bioeconomy, transforming agro-industrial waste into nutrient-rich, sustainable alternatives to traditional animal products.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a href="#demo" className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-full transition-colors">
            Explore Pathway Demo
          </a>
          <a href="#contact" className="px-8 py-4 bg-transparent border border-zinc-700 hover:border-zinc-500 text-white font-semibold rounded-full transition-colors">
            Partner With Us
          </a>
        </motion.div>
      </div>
    </section>
  );
}
