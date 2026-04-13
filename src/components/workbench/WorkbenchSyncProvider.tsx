'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useWorkbenchStore } from '../../store/workbenchStore';

const SYNC_DEBOUNCE_MS = 650;

export default function WorkbenchSyncProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const artifactId = searchParams.get('artifact');
  const hydratedFromServer = useWorkbenchStore((s) => s.hydratedFromServer);
  const revision = useWorkbenchStore((s) => s.revision);
  const lastServerSyncedRevision = useWorkbenchStore((s) => s.lastServerSyncedRevision);
  const syncStatus = useWorkbenchStore((s) => s.syncStatus);
  const loadFromServer = useWorkbenchStore((s) => s.loadFromServer);
  const syncToServer = useWorkbenchStore((s) => s.syncToServer);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLegacyToolRoute = pathname.startsWith('/tools') && !artifactId;
  const isCanonicalArtifactRoute = Boolean(artifactId && (pathname === '/analyze' || pathname.startsWith('/tools')));
  const shouldHydrate = isCanonicalArtifactRoute || isLegacyToolRoute;

  useEffect(() => {
    if (!shouldHydrate) return;
    loadFromServer({ artifactId });
  }, [artifactId, loadFromServer, shouldHydrate]);

  useEffect(() => {
    if (!shouldHydrate) return;
    if (!hydratedFromServer || revision <= lastServerSyncedRevision) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      syncToServer({ artifactId });
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [artifactId, hydratedFromServer, lastServerSyncedRevision, revision, shouldHydrate, syncToServer]);

  useEffect(() => {
    if (!shouldHydrate) return;
    if (syncStatus !== 'conflict' || !hydratedFromServer) return;
    syncToServer({ artifactId });
  }, [artifactId, hydratedFromServer, shouldHydrate, syncStatus, syncToServer]);

  return null;
}
