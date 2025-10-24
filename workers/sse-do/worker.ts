export class ChatRoom {
  private state: DurableObjectState;
  private env: Env;
  private controller: ReadableStreamDefaultController<Uint8Array> | null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.controller = null;
  }

  async fetch(request: Request): Promise<Response> {
    const url: URL = new URL(request.url);

    if (url.pathname === '/connect') {
      return this.handleConnect(request);
    } else if (url.pathname === '/send') {
      return this.handleSend(request);
    }

    return new Response('Not found', { status: 404 });
  }

  async handleConnect(request: Request): Promise<Response> {
    const encoder: TextEncoder = new TextEncoder();

    const stream = new ReadableStream({
      start: (controller) => {
        // Store controller for later use
        this.controller = controller;

        // Send initial message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

        // Keepalive every 15 seconds
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch (e) {
            clearInterval(keepAlive);
          }
        }, 15000);

        // Cleanup on disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAlive);
          this.controller = null;
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        });
      },
      cancel: () => {
        this.controller = null;
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  async handleSend(request: Request): Promise<Response> {
    const body: { message: string } = await request.json();
    const message: string = body.message;

    if (!this.controller) {
      return new Response(JSON.stringify({ success: false, error: 'No active connection' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const encoder: TextEncoder = new TextEncoder();
    const data: string = `data: ${JSON.stringify({ type: 'message', message, timestamp: Date.now() })}\n\n`;

    try {
      this.controller.enqueue(encoder.encode(data));
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (err) {
      this.controller = null;
      return new Response(JSON.stringify({ success: false, error: 'Write failed' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
}

// Environment interface
export interface Env {
  CHAT_ROOM: DurableObjectNamespace;
}

// Worker (main entry point)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url: URL = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Route: /register/:clientId - Connect to SSE stream
    if (url.pathname.startsWith('/register/')) {
      const clientId: string | undefined = url.pathname.split('/')[2];

      if (!clientId) {
        return new Response('Client ID required', { status: 400 });
      }

      const id: DurableObjectId = env.CHAT_ROOM.idFromName(clientId);
      const stub: DurableObjectStub = env.CHAT_ROOM.get(id);

      const doUrl: URL = new URL(request.url);
      doUrl.pathname = '/connect';

      return stub.fetch(doUrl.toString(), request);
    }

    // Route: /push/:clientId - Send message to specific client
    if (url.pathname.startsWith('/push/') && request.method === 'POST') {
      const clientId: string | undefined = url.pathname.split('/')[2];

      if (!clientId) {
        return new Response('Client ID required', { status: 400 });
      }

      const id: DurableObjectId = env.CHAT_ROOM.idFromName(clientId);
      const stub: DurableObjectStub = env.CHAT_ROOM.get(id);

      const doUrl: URL = new URL(request.url);
      doUrl.pathname = '/send';

      return stub.fetch(doUrl.toString(), request);
    }

    return new Response('Not found', { status: 404 });
  }
};;
