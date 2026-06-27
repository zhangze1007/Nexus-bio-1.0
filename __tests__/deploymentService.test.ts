/** @jest-environment node */
import {
  getDeploymentStatus,
  getEnvironmentConfig,
  validateDeployment,
} from "../src/services/infra/deploymentService";
import type { Environment } from "../src/services/infra/deploymentService";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Save and restore process.env across tests so mutations don't leak. */
const savedEnv: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function restoreEnv() {
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("deploymentService", () => {
  afterEach(() => {
    restoreEnv();
  });

  /* ================================================================ */
  /*  getDeploymentStatus                                              */
  /* ================================================================ */

  describe("getDeploymentStatus", () => {
    it("returns a valid DeploymentStatus object", async () => {
      const status = await getDeploymentStatus();

      expect(status).toHaveProperty("currentVersion");
      expect(status).toHaveProperty("lastDeployedAt");
      expect(status).toHaveProperty("environment");
      expect(status).toHaveProperty("health");
    });

    it("detects development environment by default", async () => {
      delete process.env.VERCEL_ENV;
      const status = await getDeploymentStatus();

      expect(status.environment).toBe("development");
    });

    it("detects production environment when VERCEL_ENV is production", async () => {
      setEnv("VERCEL_ENV", "production");
      setEnv("GROQ_API_KEY", "test-key");
      setEnv("GEMINI_API_KEY", "test-key");
      const status = await getDeploymentStatus();

      expect(status.environment).toBe("production");
    });

    it("detects staging environment when VERCEL_ENV is preview", async () => {
      setEnv("VERCEL_ENV", "preview");
      setEnv("GROQ_API_KEY", "test-key");
      setEnv("GEMINI_API_KEY", "test-key");
      const status = await getDeploymentStatus();

      expect(status.environment).toBe("staging");
    });

    it("reports unhealthy when required vars are missing in production", async () => {
      setEnv("VERCEL_ENV", "production");
      delete process.env.GROQ_API_KEY;
      delete process.env.GEMINI_API_KEY;
      const status = await getDeploymentStatus();

      expect(status.health).toBe("unhealthy");
    });

    it("uses VERCEL_GIT_COMMIT_SHA for version when available", async () => {
      setEnv("VERCEL_GIT_COMMIT_SHA", "abc1234567890");
      const status = await getDeploymentStatus();

      expect(status.currentVersion).toBe("abc1234");
    });

    it("falls back to local version when no commit SHA is set", async () => {
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      delete process.env.npm_package_version;
      const status = await getDeploymentStatus();

      expect(status.currentVersion).toBe("0.0.0-local");
    });

    it("returns a valid ISO-8601 lastDeployedAt timestamp", async () => {
      const status = await getDeploymentStatus();

      expect(() => new Date(status.lastDeployedAt)).not.toThrow();
      expect(new Date(status.lastDeployedAt).toISOString()).toBe(status.lastDeployedAt);
    });
  });

  /* ================================================================ */
  /*  getEnvironmentConfig                                             */
  /* ================================================================ */

  describe("getEnvironmentConfig", () => {
    it("returns requiredVars, optionalVars, and featureFlags for development", async () => {
      const config = await getEnvironmentConfig("development");

      expect(config).toHaveProperty("requiredVars");
      expect(config).toHaveProperty("optionalVars");
      expect(config).toHaveProperty("featureFlags");
      expect(Array.isArray(config.requiredVars)).toBe(true);
      expect(Array.isArray(config.optionalVars)).toBe(true);
    });

    it("has empty requiredVars for development", async () => {
      const config = await getEnvironmentConfig("development");

      expect(config.requiredVars).toHaveLength(0);
    });

    it("requires GROQ_API_KEY and GEMINI_API_KEY for production", async () => {
      const config = await getEnvironmentConfig("production");

      expect(config.requiredVars).toContain("GROQ_API_KEY");
      expect(config.requiredVars).toContain("GEMINI_API_KEY");
    });

    it("enables beta tools in development but disables in production", async () => {
      const devConfig = await getEnvironmentConfig("development");
      const prodConfig = await getEnvironmentConfig("production");

      expect(devConfig.featureFlags.enableBetaTools).toBe(true);
      expect(prodConfig.featureFlags.enableBetaTools).toBe(false);
    });

    it("enables rate limiting in staging and production but not development", async () => {
      const devConfig = await getEnvironmentConfig("development");
      const stagingConfig = await getEnvironmentConfig("staging");
      const prodConfig = await getEnvironmentConfig("production");

      expect(devConfig.featureFlags.enableRateLimit).toBe(false);
      expect(stagingConfig.featureFlags.enableRateLimit).toBe(true);
      expect(prodConfig.featureFlags.enableRateLimit).toBe(true);
    });

    it("returns a defensive copy that does not mutate internal state", async () => {
      const config1 = await getEnvironmentConfig("development");
      const config2 = await getEnvironmentConfig("development");

      // Mutate the first result
      config1.requiredVars.push("EVIL_VAR");
      config1.featureFlags["evilFlag"] = true;

      // Second call should be unaffected
      expect(config2.requiredVars).not.toContain("EVIL_VAR");
      expect(config2.featureFlags).not.toHaveProperty("evilFlag");
    });
  });

  /* ================================================================ */
  /*  validateDeployment                                               */
  /* ================================================================ */

  describe("validateDeployment", () => {
    it("returns a ValidationResult with a checks array", async () => {
      const result = await validateDeployment();

      expect(result).toHaveProperty("checks");
      expect(Array.isArray(result.checks)).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it("each check has name, status, and message", async () => {
      const result = await validateDeployment();

      for (const check of result.checks) {
        expect(check).toHaveProperty("name");
        expect(check).toHaveProperty("status");
        expect(check).toHaveProperty("message");
        expect(["pass", "fail", "warn"]).toContain(check.status);
      }
    });

    it("always includes a node_version check", async () => {
      const result = await validateDeployment();

      const nodeCheck = result.checks.find((c) => c.name === "node_version");
      expect(nodeCheck).toBeDefined();
      expect(nodeCheck!.status).toBe("pass"); // CI runs Node >= 18
    });

    it("always includes a required_env_vars check", async () => {
      const result = await validateDeployment();

      const envCheck = result.checks.find((c) => c.name === "required_env_vars");
      expect(envCheck).toBeDefined();
    });

    it("warns when only one AI provider key is configured", async () => {
      setEnv("VERCEL_ENV", undefined as unknown as string);
      delete process.env.VERCEL_ENV;
      setEnv("GROQ_API_KEY", "test-key");
      delete process.env.GEMINI_API_KEY;

      const result = await validateDeployment();
      const aiCheck = result.checks.find((c) => c.name === "ai_providers");

      expect(aiCheck).toBeDefined();
      expect(aiCheck!.status).toBe("warn");
    });

    it("fails ai_providers check in production when no keys are set", async () => {
      setEnv("VERCEL_ENV", "production");
      delete process.env.GROQ_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const result = await validateDeployment();
      const aiCheck = result.checks.find((c) => c.name === "ai_providers");

      expect(aiCheck).toBeDefined();
      expect(aiCheck!.status).toBe("fail");
    });

    it("produces at least 5 distinct validation checks", async () => {
      const result = await validateDeployment();

      expect(result.checks.length).toBeGreaterThanOrEqual(5);
    });
  });
});
