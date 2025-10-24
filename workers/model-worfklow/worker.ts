import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

export interface LLMWorkflowParams {
  text: string;
  clientId: string;
}

interface WorkflowEnv {
  CHAT_ROOM: DurableObjectNamespace;
  AI: Ai;
  LLM_WORKFLOW: Workflow;
}

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

    const body: { text: string; clientId: string } = await request.json();

    if (!body.text || !body.clientId) {
      return new Response('Missing text or clientId', { status: 400 });
    }

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
