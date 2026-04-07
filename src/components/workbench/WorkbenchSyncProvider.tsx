'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkbenchStore } from '../../store/workbenchStore';

const SYNC_DEBOUNCE_MS = 650;

export default function WorkbenchSyncProvider() {
  const pathname = usePathname();
  const hydratedFromServer = useWorkbenchStore((s) => s.hydratedFromServer);
  const revision = useWorkbenchStore((s) => s.revision);
  const lastServerSyncedRevision = useWorkbenchStore((s) => s.lastServerSyncedRevision);
  const syncStatus = useWorkbenchStore((s) => s.syncStatus);
  const loadFromServer = useWorkbenchStore((s) => s.loadFromServer);
  const syncToServer = useWorkbenchStore((s) => s.syncToServer);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWorkbenchRoute = pathname === '/research'
    || pathname === '/analyze'
    || pathname.startsWith('/tools');

  useEffect(() => {
    if (!isWorkbenchRoute) return;
    loadFromServer();
  }, [isWorkbenchRoute, loadFromServer]);

  useEffect(() => {
    if (!isWorkbenchRoute) return;
    if (!hydratedFromServer || revision <= lastServerSyncedRevision) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      syncToServer();
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hydratedFromServer, isWorkbenchRoute, lastServerSyncedRevision, revision, syncToServer]);

  useEffect(() => {
    if (!isWorkbenchRoute) return;
    if (syncStatus !== 'conflict' || !hydratedFromServer) return;
    syncToServer();
  }, [hydratedFromServer, isWorkbenchRoute, syncStatus, syncToServer]);

  return null;
}
