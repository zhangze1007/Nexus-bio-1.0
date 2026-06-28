import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    services: {
      redis: hasRedis ? 'configured' : 'missing (rate limiting uses per-instance memory fallback)',
      ai: {
        groq: Boolean(process.env.GROQ_API_KEY) ? 'configured' : 'missing',
        gemini: Boolean(process.env.GEMINI_API_KEY) ? 'configured' : 'missing',
      },
    },
  });
}
