'use client';
import IDEShell from '../ide/IDEShell';
import MetabolicEngPage from './MetabolicEngPage';

export default function PathDPage() {
  return (
    <IDEShell moduleId="pathd">
      <MetabolicEngPage embedded />
    </IDEShell>
  );
}
