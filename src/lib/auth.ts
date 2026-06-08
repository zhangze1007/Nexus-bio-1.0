import NextAuth, { type NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { getDb } from './db';

/**
 * Auth.js v5 configuration for Nexus-Bio researcher accounts.
 *
 * Providers: GitHub (primary for researchers), Google (institutional accounts)
 * Strategy: JWT (stateless, no DB session lookup per request)
 * Database: upserts user on sign-in via the `signIn` callback
 */

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      institution?: string | null;
      researchArea?: string | null;
      orcid?: string | null;
    };
  }

  interface User {
    institution?: string | null;
    researchArea?: string | null;
    orcid?: string | null;
  }
}

declare module 'next-auth' {
  interface JWT {
    id?: string;
    institution?: string | null;
    researchArea?: string | null;
    orcid?: string | null;
  }
}

const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      try {
        const db = getDb();
        const now = new Date().toISOString();

        // Upsert user
        db.prepare(`
          INSERT INTO users (id, email, name, image, provider, provider_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            name = excluded.name,
            image = excluded.image,
            provider = excluded.provider,
            provider_id = excluded.provider_id,
            updated_at = excluded.updated_at
        `).run(
          user.id || crypto.randomUUID(),
          user.email,
          user.name || null,
          user.image || null,
          account?.provider || 'unknown',
          account?.providerAccountId || null,
          now,
          now,
        );
      } catch (err) {
        console.error('Auth signIn upsert failed:', err);
        // Still allow sign-in even if DB write fails
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.institution = user.institution;
        token.researchArea = user.researchArea;
        token.orcid = user.orcid;
      }

      // Fetch fresh profile data from DB on each JWT creation
      if (token.email) {
        try {
          const db = getDb();
          const row = db.prepare(
            'SELECT institution, research_area, orcid FROM users WHERE email = ?'
          ).get(token.email) as Record<string, string> | undefined;

          if (row) {
            token.institution = row.institution;
            token.researchArea = row.research_area;
            token.orcid = row.orcid;
          }
        } catch {
          // DB not available, use token values
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.institution = token.institution as string | null;
        session.user.researchArea = token.researchArea as string | null;
        session.user.orcid = token.orcid as string | null;
      }
      return session;
    },
  },

  secret: process.env.AUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
