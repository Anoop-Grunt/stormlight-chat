import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

// Workflow params
export interface LLMWorkflowParams {
  text: string;
  clientId: string;
}

// Environment interface for workflow
interface WorkflowEnv {
  CHAT_ROOM: DurableObjectNamespace;
  AI: Ai;
  LLM_WORKFLOW: Workflow;
}

// Workflow definition
export class LLMWorkflow extends WorkflowEntrypoint<WorkflowEnv, LLMWorkflowParams> {
  async run(event: WorkflowEvent<LLMWorkflowParams>, step: WorkflowStep) {
    const { text, clientId } = event.payload;

    // Get the DO stub for this client
    const id: DurableObjectId = this.env.CHAT_ROOM.idFromName(clientId);
    const stub: DurableObjectStub = this.env.CHAT_ROOM.get(id);

    // Call the AI model and stream tokens
    await step.do('stream-llm-response', async () => {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
        prompt: text,
        stream: true,
      });

      // Stream tokens to the DO
      const reader = response.getReader();
      const decoder = new TextDecoder();

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
                  // Send token to DO
                  const doUrl = new URL(`https://chat-room/send`);
                  await stub.fetch(doUrl.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: token }),
                  });
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

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

// Worker handler for workflow - receives requests from Next.js
export default {
  async fetch(request: Request, env: WorkflowEnv): Promise<Response> {
    // Handle CORS preflight
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

    const body: { text: string; clientId: string } = await request.json();

    if (!body.text || !body.clientId) {
      return new Response('Missing text or clientId', { status: 400 });
    }

    // Start the workflow
    const instance = await env.LLM_WORKFLOW.create({
      params: {
        text: body.text,
        clientId: body.clientId,
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

// wrangler.toml for Workflow:
//
// name = "llm-workflow"
// main = "src/llm-workflow.ts"
// compatibility_date = "2024-01-01"
//
// [ai]
// binding = "AI"
//
// [[workflows]]
// binding = "LLM_WORKFLOW"
// name = "llm-workflow"
// class_name = "LLMWorkflow"
//
// [[durable_objects.bindings]]
// name = "CHAT_ROOM"
// class_name = "ChatRoom"
// script_name = "sse-worker"  # Points to the SSE worker's DO
