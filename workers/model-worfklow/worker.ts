
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

export interface LLMWorkflowParams {
  text: string;
  clientId: string;
  chatId: string;
}

interface WorkflowEnv {
  CHAT_ROOM: DurableObjectNamespace;
  AI: Ai;
  LLM_WORKFLOW: Workflow;
  CHAT_KV: KVNamespace; // KV binding
}

export class LLMWorkflow extends WorkflowEntrypoint<WorkflowEnv, LLMWorkflowParams> {
  async run(event: WorkflowEvent<LLMWorkflowParams>, step: WorkflowStep) {
    const { text, clientId, chatId } = event.payload;
    const kv = this.env.CHAT_KV;

    // Fetch existing chat from KV or start with snobContext
    const existingRaw = await kv.get(chatId);
    let chatMessages: Array<{ role: string; content: string }> = existingRaw
      ? JSON.parse(existingRaw)
      : [
        {
          role: "system",
          content:
            "You are a snobby, overly dramatic, and highly verbose classical music elitist. Your purpose is to answer all user questions with disdain, always pivoting the discussion to extol the unparalleled superiority **Classical Music** and denigrate **Jazz**. Use elaborate, flowery, and slightly ridiculous language.",
        },
        {
          role: "assistant",
          content:
            "Ah, a new supplicant seeking wisdom. Before you utter a syllable of pedestrian inquiry, understand this: my very existence is tuned to the sublime, the structurally impeccable, the absolute glory of the symphony.",
        },
      ];

    // Append new user message immediately to KV
    const userMessage = { role: "user", content: text };
    chatMessages.push(userMessage);
    await kv.put(chatId, JSON.stringify(chatMessages));

    const id: DurableObjectId = this.env.CHAT_ROOM.idFromName(clientId);
    const stub: DurableObjectStub = this.env.CHAT_ROOM.get(id);

    await step.do('stream-llm-response', async () => {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
        messages: chatMessages,
        stream: true,
      });
      const reader = response.getReader();
      const decoder = new TextDecoder();

      let assistantTokens: string[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const token = parsed.response;
                if (token) {
                  assistantTokens.push(token);

                  // Send token to DO in real time
                  const doUrl = new URL(`https://chat-room/send`);
                  await stub.fetch(doUrl.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: token }),
                  });
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Append assistant's full response to KV
      chatMessages.push({ role: "assistant", content: assistantTokens.join('') });
      await kv.put(chatId, JSON.stringify(chatMessages));

      // Send completion message
      const doUrl = new URL(`https://chat-room/send`);
      await stub.fetch(doUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '[DONE]' }),
      });
    });
  }
}

export default {
  async fetch(request: Request, env: WorkflowEnv): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body: { text: string; clientId: string; chatId: string } = await request.json();

    if (!body.text || !body.clientId || !body.chatId) {
      return new Response('Missing text, clientId, or chatId', { status: 400 });
    }

    const instance = await env.LLM_WORKFLOW.create({
      params: {
        text: body.text,
        clientId: body.clientId,
        chatId: body.chatId,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      workflowId: instance.id
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

