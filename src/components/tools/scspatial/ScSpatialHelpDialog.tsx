'use client';

import { X } from 'lucide-react';
import styles from './ScSpatialWorkbench.module.css';

interface ScSpatialHelpDialogProps {
  onClose: () => void;
}

export default function ScSpatialHelpDialog({ onClose }: ScSpatialHelpDialogProps) {
  return (
    <div className={styles.helpOverlay} role="dialog" aria-modal="true" aria-labelledby="scspatial-help-title">
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <div>
            <div className={styles.eyebrow}>Help</div>
            <h2 id="scspatial-help-title" className={styles.title}>
              How to Read SCSPATIAL
            </h2>
          </div>
          <button type="button" className={styles.button} onClick={onClose} aria-label="Close help dialog">
            <X size={16} />
            Close
          </button>
        </div>
        <div className={styles.dialogBody}>
          <p><strong>1. Load a dataset.</strong> Upload a <code>.h5ad</code> file — the platform parses it into a standardized JSON artifact, then computes spatial statistics on the backend.</p>
          <p><strong>2. Inspect the main viewport.</strong> The default view shows real spatial coordinates. If the data lacks spatial coordinates, the system honestly degrades to <code>partial</code> and disables the spatial view.</p>
          <p><strong>3. Check the analysis strip.</strong> The bottom panel shows cluster context, marker heatmaps, and expression distributions — helping you judge whether a gene or region is truly spatially restricted.</p>
          <p><strong>Moran&apos;s I</strong> measures whether neighboring spots have similar expression. Higher values indicate stronger spatial clustering.</p>
          <p><strong>PAGA</strong> abstracts inter-cluster connectivity into a trajectory graph, revealing branching patterns and possible cell fate transitions.</p>
        </div>
      </div>
    </div>
  );
}
