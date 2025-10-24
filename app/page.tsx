
"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Message {
  id: number;
  sender: "user" | "server";
  text: string;
}

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const clientIdRef = useRef<string>(Date.now().toString());
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const clientId = clientIdRef.current;
    const evtSource = new EventSource(
      `https://chat-room-do-worker.feldspar.workers.dev/register?clientId=${clientId}`
    );
    eventSourceRef.current = evtSource;

    evtSource.onmessage = (evt) => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: "server", text: evt.data },
      ]);
    };

    evtSource.onerror = (err) => {
      console.error("EventSource error:", err);
      evtSource.close();
    };

    return () => {
      evtSource.close();
    };
  }, []);

  const sendMessage = async () => {
    const clientId = clientIdRef.current;
    if (!input.trim()) return;

    // Add the user message locally
    const newMessage: Message = { id: Date.now(), sender: "user", text: input };
    setMessages((prev) => [...prev, newMessage]);

    // Send to the DO via POST
    try {
      await fetch(
        `https://chat-room-do-worker.feldspar.workers.dev/push?clientId=${clientId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ msg: input }),
        }
      );
    } catch (err) {
      console.error("Failed to send message:", err);
    }

    setInput("");
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-80 h-[400px] flex flex-col shadow-lg">
        <CardContent className="flex-1 p-2">
          <ScrollArea className="h-full">
            <div ref={scrollRef} className="flex flex-col gap-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded-md max-w-[70%] ${msg.sender === "user"
                      ? "self-end bg-blue-500 text-white"
                      : "self-start bg-gray-200 text-gray-900"
                    }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        <div className="flex gap-2 p-2 border-t">
          <Textarea
            placeholder="Type a message..."
            className="flex-1 resize-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </Card>
    </div>
  );
}

