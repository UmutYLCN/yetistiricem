// The AI assistants that connect over MCP (docs: /docs/yapay-zeka). Their
// logos are in `src/components/ui/AiLogos.tsx`.

export type AiClient = 'claude' | 'chatgpt' | 'gemini';

export const AI_CLIENTS: AiClient[] = ['claude', 'chatgpt', 'gemini'];

const NAMES: Record<AiClient, string> = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini' };

export function aiClientName(client: AiClient): string {
  return NAMES[client];
}

/** Which assistant an OAuth client is, from the name it registered with; null for any other. */
export function aiClientOf(name: string): AiClient | null {
  const text = name.toLocaleLowerCase('en');
  if (text.includes('claude') || text.includes('anthropic')) return 'claude';
  if (text.includes('chatgpt') || text.includes('openai')) return 'chatgpt';
  if (text.includes('gemini') || text.includes('google')) return 'gemini';
  return null;
}
