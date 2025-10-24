
export default {
  async fetch(req: Request, env: any) {
    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    server.addEventListener("message", async (evt) => {
      const data = evt.data;
      console.log("Received:", data);

      // Echo back the message for testing
      server.send(`Echo: ${data}`);
    });

    server.addEventListener("close", () => {
      console.log("Client disconnected");
    });

    return new Response(null, { status: 101, webSocket: client });
  },
};
