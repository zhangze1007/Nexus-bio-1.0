import { useState } from 'react';
import { Mail, FileDown, ArrowRight } from 'lucide-react';

export default function ContactFlow() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section className="py-24 px-4 bg-zinc-900 text-white border-t border-zinc-800" id="contact">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Accelerate Your Bio-Innovation</h2>
        <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest mb-12">早期采用者咨询 (Early-Adopter Consulting)</p>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <div className="bg-zinc-950 p-8 rounded-3xl border border-zinc-800 flex flex-col items-center text-center hover:border-emerald-500/50 transition-colors">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 text-emerald-400">
              <Mail size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-4">Strategic Consulting</h3>
            <p className="text-zinc-400 mb-8 flex-1">
              Book a 45-minute deep dive into your bioprocessing pipeline. Identify bottlenecks and scalable microbial solutions.
            </p>
            <a
              href="https://forms.gle/your-google-form-link-here"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              Buy Early-Adopter Consulting ($50)
              <ArrowRight size={20} className={`transition-transform ${isHovered ? 'translate-x-1' : ''}`} />
            </a>
          </div>

          <div className="bg-zinc-950 p-8 rounded-3xl border border-zinc-800 flex flex-col items-center text-center hover:border-zinc-600 transition-colors">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 text-zinc-300">
              <FileDown size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-4">Nexus-Bio Whitepaper</h3>
            <p className="text-zinc-400 mb-8 flex-1">
              Download our 1-page technical brief on "Next-Gen Bio-Intelligent Architecture for Sustainable Food Production."
            </p>
            <a
              href="/whitepaper-template.pdf"
              download
              className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 border border-zinc-700"
            >
              Download Whitepaper (PDF)
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
