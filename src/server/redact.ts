/**
 * Strip anything credential-shaped from text before it is logged, stored or
 * returned. Applied to every provider error message on the server.
 */
const PATTERNS: RegExp[] = [
  /sk-or-[A-Za-z0-9_-]{4,}/g, // OpenRouter keys
  /sk-[A-Za-z0-9_-]{16,}/g, // OpenAI-style keys
  /AIza[0-9A-Za-z_-]{20,}/g, // Google API keys
  /(Bearer\s+)[^\s"',}]+/gi,
  /("?authorization"?\s*[:=]\s*"?)[^"',}\s]+/gi,
];

export function redactSecrets(text: string, secrets: Array<string | undefined> = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) out = out.split(secret).join('[redacted]');
  }
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, (_m, prefix?: string) => (typeof prefix === 'string' ? `${prefix}[redacted]` : '[redacted]'));
  }
  return out;
}
