/**
 * Input Sanitization Utilities
 *
 * Pure TypeScript functions for sanitizing and validating user input.
 * No external dependencies.
 */

/**
 * Strips all HTML tags from a string, returning only the text content.
 * Also decodes common HTML entities.
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Escapes single quotes and backslashes for safe use in SQL contexts.
 * NOTE: This is a lightweight utility — for production database access,
 * always use parameterized queries / prepared statements.
 */
export function sanitizeSql(input: string): string {
  if (typeof input !== "string") return "";
  return input.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/"/g, '""');
}

/**
 * Validates an email address against a standard pattern.
 * Returns true if the email is structurally valid.
 */
export function validateEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validates a URL, ensuring it uses http or https protocol.
 * Returns true if the URL is structurally valid and safe.
 */
export function validateUrl(url: string): boolean {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
