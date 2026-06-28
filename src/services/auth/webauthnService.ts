/**
 * WebAuthn / Passkey Service — Passwordless Authentication for Nexus-Bio
 *
 * Uses @simplewebauthn/server v13 for WebAuthn Level 3 compliance.
 * Credentials are stored in a `webauthn_credentials` table via libsql.
 * Challenges are stored in a `webauthn_challenges` table (short-lived, TTL 5 min).
 *
 * Supports:
 *   - Platform authenticators (Face ID, Touch ID, Windows Hello)
 *   - Roaming authenticators (USB security keys)
 *   - Passkey discovery (resident keys)
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON, WebAuthnCredential } from "@simplewebauthn/server";
import { getLibsqlClient } from "../../lib/db";

// ─── Configuration ───────────────────────────────────────────────────────

const RP_NAME = "Nexus-Bio";
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getRPID(): string {
  return process.env.WEBAUTHN_RP_ID || "localhost";
}

function getOrigin(): string {
  return process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";
}

// ─── Schema initialization ───────────────────────────────────────────────

let schemaReady = false;

export async function ensureWebAuthnSchema(): Promise<void> {
  if (schemaReady) return;
  const client = getLibsqlClient();
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key BLOB NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      device_name TEXT,
      transports TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON webauthn_credentials (user_id);
    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      user_id TEXT NOT NULL,
      challenge TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, type)
    );
  `);
  schemaReady = true;
}

// ─── Credential persistence helpers ──────────────────────────────────────

interface StoredCredential {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: Uint8Array;
  counter: number;
  device_name: string | null;
  transports: string | null;
  created_at: string;
  updated_at: string;
}

async function getCredentialsByUserId(userId: string): Promise<StoredCredential[]> {
  const client = getLibsqlClient();
  const result = await client.execute({
    sql: "SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at ASC",
    args: [userId],
  });
  return result.rows as unknown as StoredCredential[];
}

async function getCredentialById(credentialId: string): Promise<StoredCredential | undefined> {
  const client = getLibsqlClient();
  const result = await client.execute({
    sql: "SELECT * FROM webauthn_credentials WHERE credential_id = ?",
    args: [credentialId],
  });
  return (result.rows[0] as unknown as StoredCredential) || undefined;
}

function storedToWebAuthnCredential(stored: StoredCredential): WebAuthnCredential {
  return {
    id: stored.credential_id,
    publicKey: new Uint8Array(stored.public_key),
    counter: Number(stored.counter),
    transports: stored.transports ? JSON.parse(stored.transports) : undefined,
  };
}

// ─── Challenge persistence helpers ───────────────────────────────────────

async function storeChallenge(
  userId: string,
  challenge: string,
  type: "registration" | "authentication",
): Promise<void> {
  const client = getLibsqlClient();
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO webauthn_challenges (user_id, challenge, type, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, type) DO UPDATE SET
            challenge = excluded.challenge,
            created_at = excluded.created_at`,
    args: [userId, challenge, type, now],
  });
}

async function getAndConsumeChallenge(userId: string, type: "registration" | "authentication"): Promise<string | null> {
  const client = getLibsqlClient();
  const result = await client.execute({
    sql: "SELECT challenge, created_at FROM webauthn_challenges WHERE user_id = ? AND type = ?",
    args: [userId, type],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const createdAt = Number(row.created_at);
  if (Date.now() - createdAt > CHALLENGE_TTL_MS) {
    // Challenge expired — clean up
    await client.execute({
      sql: "DELETE FROM webauthn_challenges WHERE user_id = ? AND type = ?",
      args: [userId, type],
    });
    return null;
  }

  // Consume the challenge (delete after reading)
  await client.execute({
    sql: "DELETE FROM webauthn_challenges WHERE user_id = ? AND type = ?",
    args: [userId, type],
  });

  return row.challenge as string;
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Generate WebAuthn registration options for a user.
 *
 * Returns `PublicKeyCredentialCreationOptionsJSON` to send to the browser,
 * where `startRegistration()` will consume it.
 */
export async function generateRegistrationOptionsForUser(userId: string, userName: string) {
  await ensureWebAuthnSchema();

  const existingCredentials = await getCredentialsByUserId(userId);
  const rpID = getRPID();

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(userId) as Uint8Array<ArrayBuffer>,
    userName,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credential_id,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Store the challenge for later verification
  await storeChallenge(userId, options.challenge, "registration");

  return options;
}

/**
 * Verify a WebAuthn registration response from the browser.
 *
 * On success, persists the new credential and returns `{ verified: true }`.
 * On failure, returns `{ verified: false, error }`.
 */
export async function verifyRegistrationResponseForUser(
  userId: string,
  response: RegistrationResponseJSON,
  deviceName?: string,
): Promise<{ verified: boolean; credentialId?: string; error?: string }> {
  await ensureWebAuthnSchema();

  const expectedChallenge = await getAndConsumeChallenge(userId, "registration");
  if (!expectedChallenge) {
    return { verified: false, error: "Challenge expired or not found" };
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRPID(),
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { verified: false, error: "Registration verification failed" };
    }

    const { credential } = verification.registrationInfo;

    // Persist the credential
    const client = getLibsqlClient();
    const now = new Date().toISOString();
    const credentialId = credential.id;

    // Convert publicKey to a Buffer for storage
    const publicKeyBuffer = Buffer.from(credential.publicKey);

    await client.execute({
      sql: `INSERT INTO webauthn_credentials (id, user_id, credential_id, public_key, counter, device_name, transports, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        userId,
        credentialId,
        publicKeyBuffer,
        credential.counter,
        deviceName || null,
        credential.transports ? JSON.stringify(credential.transports) : null,
        now,
        now,
      ],
    });

    return { verified: true, credentialId };
  } catch (err) {
    return {
      verified: false,
      error: err instanceof Error ? err.message : "Unknown verification error",
    };
  }
}

/**
 * Generate WebAuthn authentication options for a user.
 *
 * If `userId` is provided, scopes `allowCredentials` to that user's registered
 * credentials. Otherwise, returns options suitable for passkey discovery
 * (no `allowCredentials`).
 */
export async function generateAuthenticationOptionsForUser(userId?: string) {
  await ensureWebAuthnSchema();

  const rpID = getRPID();
  let allowCredentials;

  if (userId) {
    const credentials = await getCredentialsByUserId(userId);
    allowCredentials = credentials.map((cred) => ({
      id: cred.credential_id,
      transports: cred.transports ? JSON.parse(cred.transports) : undefined,
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
  });

  // Store the challenge — if userId is known, store under that user;
  // otherwise store under a sentinel key for discovery flows
  const challengeKey = userId || "__passkey_discovery__";
  await storeChallenge(challengeKey, options.challenge, "authentication");

  return options;
}

/**
 * Verify a WebAuthn authentication response from the browser.
 *
 * Looks up the credential, verifies the response, and updates the stored
 * counter to prevent replay attacks.
 *
 * If `userId` is not provided (passkey discovery flow), the user is resolved
 * from the credential's stored `user_id`.
 */
export async function verifyAuthenticationResponseForUser(
  userId: string | undefined,
  response: AuthenticationResponseJSON,
): Promise<{
  verified: boolean;
  userId?: string;
  credentialId?: string;
  error?: string;
}> {
  await ensureWebAuthnSchema();

  // Try the specific user's challenge first, then the discovery sentinel
  const challengeKey = userId || "__passkey_discovery__";
  let expectedChallenge = await getAndConsumeChallenge(challengeKey, "authentication");

  // If no challenge found under the sentinel and we have a userId, try that
  if (!expectedChallenge && !userId) {
    // nothing more to try
  } else if (!expectedChallenge && userId) {
    // Challenge may have been stored under the user's key during a non-discovery flow
    expectedChallenge = await getAndConsumeChallenge(userId, "authentication");
  }

  if (!expectedChallenge) {
    return { verified: false, error: "Challenge expired or not found" };
  }

  // Look up the credential
  const credentialId = response.id;
  const stored = await getCredentialById(credentialId);
  if (!stored) {
    return { verified: false, error: "Credential not found" };
  }

  // If userId was not provided (passkey discovery), resolve from stored credential
  const resolvedUserId = userId || stored.user_id;

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRPID(),
      credential: storedToWebAuthnCredential(stored),
    });

    if (!verification.verified) {
      return { verified: false, error: "Authentication verification failed" };
    }

    // Update the counter to prevent replay attacks
    const client = getLibsqlClient();
    const now = new Date().toISOString();
    await client.execute({
      sql: "UPDATE webauthn_credentials SET counter = ?, updated_at = ? WHERE credential_id = ?",
      args: [verification.authenticationInfo.newCounter, now, credentialId],
    });

    return { verified: true, userId: resolvedUserId, credentialId };
  } catch (err) {
    return {
      verified: false,
      error: err instanceof Error ? err.message : "Unknown verification error",
    };
  }
}

/**
 * List all WebAuthn credentials for a user.
 */
export async function listCredentialsForUser(userId: string): Promise<
  Array<{
    credentialId: string;
    deviceName: string | null;
    createdAt: string;
  }>
> {
  await ensureWebAuthnSchema();
  const credentials = await getCredentialsByUserId(userId);
  return credentials.map((cred) => ({
    credentialId: cred.credential_id,
    deviceName: cred.device_name,
    createdAt: cred.created_at,
  }));
}

/**
 * Delete a specific WebAuthn credential.
 * Returns true if a row was deleted.
 */
export async function deleteCredential(userId: string, credentialId: string): Promise<boolean> {
  await ensureWebAuthnSchema();
  const client = getLibsqlClient();
  const result = await client.execute({
    sql: "DELETE FROM webauthn_credentials WHERE user_id = ? AND credential_id = ?",
    args: [userId, credentialId],
  });
  return result.rowsAffected > 0;
}
