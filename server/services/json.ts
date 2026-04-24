export function parseJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('AI 未返回有效内容');
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  const candidate =
    firstBrace >= 0 && lastBrace >= 0 ? withoutFence.slice(firstBrace, lastBrace + 1) : withoutFence;

  return JSON.parse(candidate);
}
