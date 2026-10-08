/**
 * The line that tells a reader a model wrote the text beside it.
 *
 * EU AI Act Art. 50(4): deployers of an AI system that generates text
 * "published with the purpose of informing the public on matters of public
 * interest shall disclose that the text has been artificially generated";
 * Art. 50(5) asks for it "in a clear and distinguishable manner". Article 50
 * applies from 2 August 2026 (Art. 113, as amended), read on the Commission's
 * AI Act Service Desk on 2026-10-08.
 *
 * A provider and model name ("anthropic · claude-…") is not that disclosure
 * to a reader who does not know the names. So the words say it plainly, and the
 * deterministic reading, which no model wrote, says that instead.
 */
export function aiDisclosure(verdict: { provider: string; model: string | null }): string {
  return verdict.model ? `AI-generated · ${verdict.provider} · ${verdict.model}` : 'computed — no model'
}
