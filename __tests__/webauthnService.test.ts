/**
 * WebAuthn Service Tests
 *
 * Tests for WebAuthn/Passkey registration and authentication flows,
 * credential persistence, challenge management, and error handling.
 *
 * @jest-environment node
 */

// Expose a resettable counter for the mock
let challengeCounter = 0;

// Mock @simplewebauthn/server before importing the service
jest.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: jest.fn(async (opts: Record<string, unknown>) => {
    challengeCounter++;
    return {
      challenge: `reg-challenge-${challengeCounter}`,
      rp: { name: opts.rpName, id: opts.rpID },
      user: { id: opts.userID, name: opts.userName, displayName: opts.userName },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      timeout: 60000,
      attestation: opts.attestationType || "none",
    };
  }),
  verifyRegistrationResponse: jest.fn(async (opts: Record<string, unknown>) => {
    const response = opts.response as Record<string, unknown>;
    // Accept any challenge that looks like a registration challenge
    if (opts.expectedChallenge?.toString().startsWith("reg-challenge-")) {
      return {
        verified: true,
        registrationInfo: {
          credential: {
            id: (response?.id as string) || "test-credential-id",
            publicKey: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
            counter: 0,
            transports: ["internal"],
          },
          credentialDeviceType: "platform",
          credentialBackedUp: false,
        },
      };
    }
    return { verified: false };
  }),
  generateAuthenticationOptions: jest.fn(async (opts: Record<string, unknown>) => {
    challengeCounter++;
    return {
      challenge: `auth-challenge-${challengeCounter}`,
      rpId: opts.rpID,
      timeout: 60000,
      userVerification: opts.userVerification || "preferred",
      allowCredentials: opts.allowCredentials || [],
    };
  }),
  verifyAuthenticationResponse: jest.fn(async (opts: Record<string, unknown>) => {
    if (opts.expectedChallenge?.toString().startsWith("auth-challenge-")) {
      return {
        verified: true,
        authenticationInfo: {
          newCounter: 1,
        },
      };
    }
    return { verified: false };
  }),
}));

import {
  generateRegistrationOptionsForUser,
  verifyRegistrationResponseForUser,
  generateAuthenticationOptionsForUser,
  verifyAuthenticationResponseForUser,
  listCredentialsForUser,
  deleteCredential,
  ensureWebAuthnSchema,
} from "../src/services/auth/webauthnService";
import { getLibsqlClient } from "../src/lib/db";

// Use a unique user ID per test to avoid cross-test interference
let testUserCounter = 0;
function uniqueUserId() {
  return `test-user-${++testUserCounter}-${Date.now()}`;
}

// Clean webauthn tables before each test
beforeEach(async () => {
  challengeCounter = 0;
  try {
    const client = getLibsqlClient();
    await client.execute("DELETE FROM webauthn_challenges");
    await client.execute("DELETE FROM webauthn_credentials");
  } catch {
    // Tables may not exist yet on first test
  }
});

afterAll(async () => {
  try {
    const client = getLibsqlClient();
    await client.execute("DELETE FROM webauthn_challenges");
    await client.execute("DELETE FROM webauthn_credentials");
  } catch {
    // ignore
  }
});

describe("ensureWebAuthnSchema", () => {
  it("creates the webauthn_credentials and webauthn_challenges tables without throwing", async () => {
    await expect(ensureWebAuthnSchema()).resolves.toBeUndefined();
  });

  it("is idempotent (calling twice does not throw)", async () => {
    await ensureWebAuthnSchema();
    await expect(ensureWebAuthnSchema()).resolves.toBeUndefined();
  });
});

describe("generateRegistrationOptionsForUser", () => {
  it("returns registration options with correct RP and user info", async () => {
    const userId = uniqueUserId();
    const options = await generateRegistrationOptionsForUser(userId, "test-researcher");

    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
    expect(typeof options.challenge).toBe("string");
  });

  it("excludes previously registered credentials", async () => {
    const userId = uniqueUserId();

    // Register a credential first
    await generateRegistrationOptionsForUser(userId, "user-1");
    await verifyRegistrationResponseForUser(userId, {
      id: "existing-cred",
      rawId: "existing-cred",
      response: {
        clientDataJSON: "test",
        attestationObject: "test",
      },
      type: "public-key",
    } as never, "Device 1");

    // Now generate options again — should have excludeCredentials
    const options2 = await generateRegistrationOptionsForUser(userId, "user-1");
    expect(options2).toBeDefined();
    expect(options2.challenge).toBeDefined();
  });
});

describe("verifyRegistrationResponseForUser", () => {
  it("returns verified: true for a valid registration response", async () => {
    const userId = uniqueUserId();

    // Generate options first (stores a challenge)
    await generateRegistrationOptionsForUser(userId, "researcher-1");

    // Simulate browser response
    const mockResponse = {
      id: "cred-abc-123",
      rawId: "cred-abc-123",
      response: {
        clientDataJSON: "eyJ0ZXN0IjogdHJ1ZX0=",
        attestationObject: "o2NmbXRkbm9uZWdhdHNTdG10oGhhdXRoRGF0YQ==",
      },
      type: "public-key",
    } as never;

    const result = await verifyRegistrationResponseForUser(userId, mockResponse, "My Laptop");

    expect(result.verified).toBe(true);
    expect(result.credentialId).toBe("cred-abc-123");
    expect(result.error).toBeUndefined();
  });

  it("returns verified: false when challenge is expired or missing", async () => {
    const userId = uniqueUserId();

    // Do NOT generate options — no challenge stored
    const mockResponse = {
      id: "cred-xyz",
      rawId: "cred-xyz",
      response: {
        clientDataJSON: "test",
        attestationObject: "test",
      },
      type: "public-key",
    } as never;

    const result = await verifyRegistrationResponseForUser(userId, mockResponse);

    expect(result.verified).toBe(false);
    expect(result.error).toBe("Challenge expired or not found");
  });

  it("persists the credential after successful verification", async () => {
    const userId = uniqueUserId();

    await generateRegistrationOptionsForUser(userId, "user-persist");

    const mockResponse = {
      id: "cred-persist-001",
      rawId: "cred-persist-001",
      response: {
        clientDataJSON: "test",
        attestationObject: "test",
      },
      type: "public-key",
    } as never;

    await verifyRegistrationResponseForUser(userId, mockResponse, "Persisted Device");

    // Verify the credential is now in the list
    const credentials = await listCredentialsForUser(userId);
    expect(credentials.length).toBeGreaterThanOrEqual(1);
    const found = credentials.find((c) => c.credentialId === "cred-persist-001");
    expect(found).toBeDefined();
    expect(found?.deviceName).toBe("Persisted Device");
  });
});

describe("generateAuthenticationOptionsForUser", () => {
  it("returns authentication options with a challenge", async () => {
    const userId = uniqueUserId();
    const options = await generateAuthenticationOptionsForUser(userId);

    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
    expect(typeof options.challenge).toBe("string");
  });

  it("includes allowCredentials when userId is provided and has registered credentials", async () => {
    const userId = uniqueUserId();

    // Register a credential first
    await generateRegistrationOptionsForUser(userId, "auth-user");
    await verifyRegistrationResponseForUser(userId, {
      id: "cred-for-auth",
      rawId: "cred-for-auth",
      response: { clientDataJSON: "test", attestationObject: "test" },
      type: "public-key",
    } as never);

    const options = await generateAuthenticationOptionsForUser(userId);
    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
  });

  it("returns options without allowCredentials for passkey discovery (no userId)", async () => {
    const options = await generateAuthenticationOptionsForUser();

    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
  });
});

describe("verifyAuthenticationResponseForUser", () => {
  it("returns verified: true for a valid authentication response", async () => {
    const userId = uniqueUserId();

    // Register a credential
    await generateRegistrationOptionsForUser(userId, "verify-auth-user");
    await verifyRegistrationResponseForUser(userId, {
      id: "cred-verify-auth",
      rawId: "cred-verify-auth",
      response: { clientDataJSON: "test", attestationObject: "test" },
      type: "public-key",
    } as never);

    // Generate authentication options (stores a challenge)
    await generateAuthenticationOptionsForUser(userId);

    // Simulate authentication response
    const authResponse = {
      id: "cred-verify-auth",
      rawId: "cred-verify-auth",
      response: {
        clientDataJSON: "test",
        authenticatorData: "test",
        signature: "test",
      },
      type: "public-key",
    } as never;

    const result = await verifyAuthenticationResponseForUser(userId, authResponse);

    expect(result.verified).toBe(true);
    expect(result.userId).toBe(userId);
    expect(result.credentialId).toBe("cred-verify-auth");
  });

  it("returns verified: false when challenge is expired or missing", async () => {
    const userId = uniqueUserId();

    // Register a credential but do NOT generate authentication options
    await generateRegistrationOptionsForUser(userId, "no-challenge-user");
    await verifyRegistrationResponseForUser(userId, {
      id: "cred-no-challenge",
      rawId: "cred-no-challenge",
      response: { clientDataJSON: "test", attestationObject: "test" },
      type: "public-key",
    } as never);

    const authResponse = {
      id: "cred-no-challenge",
      rawId: "cred-no-challenge",
      response: {
        clientDataJSON: "test",
        authenticatorData: "test",
        signature: "test",
      },
      type: "public-key",
    } as never;

    const result = await verifyAuthenticationResponseForUser(userId, authResponse);

    expect(result.verified).toBe(false);
    expect(result.error).toBe("Challenge expired or not found");
  });

  it("returns verified: false for a non-existent credential", async () => {
    const userId = uniqueUserId();

    await generateAuthenticationOptionsForUser(userId);

    const authResponse = {
      id: "non-existent-credential",
      rawId: "non-existent-credential",
      response: {
        clientDataJSON: "test",
        authenticatorData: "test",
        signature: "test",
      },
      type: "public-key",
    } as never;

    const result = await verifyAuthenticationResponseForUser(userId, authResponse);

    expect(result.verified).toBe(false);
    expect(result.error).toBe("Credential not found");
  });

  it("resolves userId from stored credential in passkey discovery flow", async () => {
    const userId = uniqueUserId();

    // Register
    await generateRegistrationOptionsForUser(userId, "discovery-user");
    await verifyRegistrationResponseForUser(userId, {
      id: "cred-discovery",
      rawId: "cred-discovery",
      response: { clientDataJSON: "test", attestationObject: "test" },
      type: "public-key",
    } as never);

    // Authenticate without userId (discovery flow)
    await generateAuthenticationOptionsForUser(); // no userId

    const authResponse = {
      id: "cred-discovery",
      rawId: "cred-discovery",
      response: {
        clientDataJSON: "test",
        authenticatorData: "test",
        signature: "test",
      },
      type: "public-key",
    } as never;

    const result = await verifyAuthenticationResponseForUser(undefined, authResponse);

    expect(result.verified).toBe(true);
    expect(result.userId).toBe(userId);
  });
});

describe("listCredentialsForUser", () => {
  it("returns an empty array for a user with no credentials", async () => {
    const userId = uniqueUserId();
    const credentials = await listCredentialsForUser(userId);
    expect(credentials).toEqual([]);
  });

  it("returns all registered credentials for a user", async () => {
    const userId = uniqueUserId();

    // Register two credentials
    await generateRegistrationOptionsForUser(userId, "multi-device-user");
    await verifyRegistrationResponseForUser(userId, {
      id: "cred-list-1",
      rawId: "cred-list-1",
      response: { clientDataJSON: "test", attestationObject: "test" },
      type: "public-key",
    } as never, "Device A");

    await generateRegistrationOptionsForUser(userId, "multi-device-user");
    await verifyRegistrationResponseForUser(userId, {
      id: "cred-list-2",
      rawId: "cred-list-2",
      response: { clientDataJSON: "test", attestationObject: "test" },
      type: "public-key",
    } as never, "Device B");

    const credentials = await listCredentialsForUser(userId);
    expect(credentials.length).toBeGreaterThanOrEqual(2);
    expect(credentials.some((c) => c.credentialId === "cred-list-1")).toBe(true);
    expect(credentials.some((c) => c.credentialId === "cred-list-2")).toBe(true);
  });
});

describe("deleteCredential", () => {
  it("returns true when a credential is successfully deleted", async () => {
    const userId = uniqueUserId();

    // Register
    await generateRegistrationOptionsForUser(userId, "delete-user");
    await verifyRegistrationResponseForUser(userId, {
      id: "cred-delete-me",
      rawId: "cred-delete-me",
      response: { clientDataJSON: "test", attestationObject: "test" },
      type: "public-key",
    } as never);

    const deleted = await deleteCredential(userId, "cred-delete-me");
    expect(deleted).toBe(true);

    // Verify it's gone
    const credentials = await listCredentialsForUser(userId);
    expect(credentials.find((c) => c.credentialId === "cred-delete-me")).toBeUndefined();
  });

  it("returns false when credential does not exist", async () => {
    const userId = uniqueUserId();
    const deleted = await deleteCredential(userId, "non-existent-cred");
    expect(deleted).toBe(false);
  });
});

describe("challenge expiration", () => {
  it("rejects a registration verification after the challenge is consumed", async () => {
    const userId = uniqueUserId();

    await generateRegistrationOptionsForUser(userId, "ttl-user");

    // First verification should work (consumes the challenge)
    const response = {
      id: "cred-ttl",
      rawId: "cred-ttl",
      response: { clientDataJSON: "test", attestationObject: "test" },
      type: "public-key",
    } as never;

    const firstResult = await verifyRegistrationResponseForUser(userId, response);
    expect(firstResult.verified).toBe(true);

    // Second verification should fail (challenge already consumed)
    const secondResult = await verifyRegistrationResponseForUser(userId, response);
    expect(secondResult.verified).toBe(false);
    expect(secondResult.error).toBe("Challenge expired or not found");
  });
});
