'use client';

import { useEffect, useRef } from 'react';
import { useWorkbenchStore } from '../../store/workbenchStore';

const SYNC_DEBOUNCE_MS = 650;

export default function WorkbenchSyncProvider() {
  const hydratedFromServer = useWorkbenchStore((s) => s.hydratedFromServer);
  const revision = useWorkbenchStore((s) => s.revision);
  const lastServerSyncedRevision = useWorkbenchStore((s) => s.lastServerSyncedRevision);
  const syncStatus = useWorkbenchStore((s) => s.syncStatus);
  const loadFromServer = useWorkbenchStore((s) => s.loadFromServer);
  const syncToServer = useWorkbenchStore((s) => s.syncToServer);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  useEffect(() => {
    if (!hydratedFromServer || revision <= lastServerSyncedRevision) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      syncToServer();
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hydratedFromServer, lastServerSyncedRevision, revision, syncToServer]);

  useEffect(() => {
    if (syncStatus !== 'conflict' || !hydratedFromServer) return;
    syncToServer();
  }, [hydratedFromServer, syncStatus, syncToServer]);

  return null;
}
