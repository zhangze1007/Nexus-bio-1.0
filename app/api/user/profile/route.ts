import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../src/lib/auth';
import { sqlAll, sqlRun } from '../../../../src/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/user/profile — Fetch current user's profile
 * PUT /api/user/profile — Update profile fields (institution, research_area, orcid, bio)
 */

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const rows = await sqlAll(
      'SELECT id, email, name, image, institution, research_area, orcid, bio, created_at FROM users WHERE email = ?',
      [session.user.email],
    );
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error('[api/user/profile] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowedFields = ['institution', 'research_area', 'orcid', 'bio', 'name'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (field in body && typeof body[field] === 'string') {
      updates.push(`${field} = ?`);
      values.push(body[field].slice(0, 500)); // cap length
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  values.push(session.user.email);

  try {
    await sqlRun(
      `UPDATE users SET ${updates.join(', ')} WHERE email = ?`,
      values,
    );

    const rows = await sqlAll(
      'SELECT id, email, name, image, institution, research_area, orcid, bio FROM users WHERE email = ?',
      [session.user.email],
    );
    const user = rows[0];

    return NextResponse.json({ user });
  } catch (err) {
    console.error('[api/user/profile] PUT error:', err);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 },
    );
  }
}
