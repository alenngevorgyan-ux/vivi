/**
 * Token ESTIMATE for text we have not sent to a model.
 *
 * No tokenizer ships with this repo, so counts are approximations: compact
 * JSON in Latin script averages ~3.4 characters per token in modern BPE
 * vocabularies; Cyrillic and Armenian tokenise roughly twice as densely. Any
 * figure produced here must be labelled an estimate. Authoritative counts come
 * only from a provider's reported usage.
 */
export function estimateTokens(text: string): number {
  let latin = 0;
  let other = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) < 0x250) latin++;
    else other++;
  }
  return Math.ceil(latin / 3.4 + other / 1.7);
}
