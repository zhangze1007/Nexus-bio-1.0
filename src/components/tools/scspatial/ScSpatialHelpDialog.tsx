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
              如何阅读 SCSPATIAL
            </h2>
          </div>
          <button type="button" className={styles.button} onClick={onClose} aria-label="Close help dialog">
            <X size={16} />
            Close
          </button>
        </div>
        <div className={styles.dialogBody}>
          <p><strong>1. 导入数据集。</strong> 上传 `.h5ad` 后，平台会先把 h5ad 解析成自己的标准 JSON artifact，再由后端统一计算空间统计。</p>
          <p><strong>2. 先看中间主视图。</strong> 默认优先展示真实空间坐标；如果数据缺少空间坐标，系统会诚实降级为 `partial`，并关闭空间视图。</p>
          <p><strong>3. 再看右栏证据。</strong> 右栏会联动显示 cluster、cell、空间热点和共表达，帮助你判断某个基因或区域是否真的有空间限制性。</p>
          <p><strong>Moran&apos;s I</strong> 衡量相邻位置的表达是否相似。越高说明越有空间聚集性。</p>
          <p><strong>PAGA</strong> 把 cluster 间的连通关系抽象成轨迹图，用于观察状态分支和可能的细胞命运转换。</p>
        </div>
      </div>
    </div>
  );
}
