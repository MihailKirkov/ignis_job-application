import 'server-only';

// Thin server-only wrapper around the official Anthropic SDK that produces a
// ModelCall (the injectable seam the pure orchestrators consume). The API key is
// passed in (resolved + decrypted by the caller) — never read here from a global.

import Anthropic from '@anthropic-ai/sdk';
import type { ModelCall, ModelRequest } from './types';

export function anthropicCall(apiKey: string): ModelCall {
  const client = new Anthropic({ apiKey });
  return async (req: ModelRequest): Promise<string> => {
    const message = await client.messages.create({
      model: req.model,
      max_tokens: req.max_tokens,
      // Mark the stable system prefix for prompt caching when asked — reused
      // across the chunks of a batch run (no-op below the model's min prefix).
      system: req.cacheSystem
        ? [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }]
        : req.system,
      messages: req.messages,
    });
    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  };
}
