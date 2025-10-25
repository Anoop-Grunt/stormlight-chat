
export interface Env {
  CHAT_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let chatId: string | null = null;

    if (request.method === 'GET') {
      const url = new URL(request.url);
      chatId = url.searchParams.get('chatId');
    } else if (request.method === 'POST') {
      const body = await request.json() as { chatId: string };
      chatId = body.chatId;
    } else {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'chatId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    try {
      const raw = await env.CHAT_KV.get(chatId);
      const chatMessages: ChatType = raw ? JSON.parse(raw) : {};

      return new Response(JSON.stringify(chatMessages), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
};
