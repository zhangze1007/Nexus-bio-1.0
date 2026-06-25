import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../src/lib/auth';
import { getLibsqlClient } from '../../../../src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/keys/[id] — Revoke (delete) an API key.
 * Only the key owner can delete it.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const client = getLibsqlClient();
  const result = await client.execute({
    sql: 'DELETE FROM api_keys WHERE id = ? AND user_id = ?',
    args: [id, session.user.id],
  });

  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
