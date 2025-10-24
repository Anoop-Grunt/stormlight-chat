
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

const WORKER_URL = 'https://chat-room-do-worker.feldspar.workers.dev';
const WORKFLOW_URL = 'https://llm-workflow.feldspar.workers.dev';
const LIST_CHATS_URL = "https://chat-list-worker.feldspar.workers.dev"

export default function Page() {
  const [clientId, setClientId] = useState('test-client-1');
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Array<{ time: string; content: string; type: 'info' | 'message' | 'error' }>>([]);
  const [promptText, setPromptText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatId, setChatId] = useState('default-chat');
  const eventSourceRef = useRef<EventSource | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatOptions, setChatOptions] = useState<string[]>([]);

  useEffect(() => {
    const fetchChatIds = async () => {
      try {
        const res = await fetch(LIST_CHATS_URL);
        const data = await res.json();
        setChatOptions(data.chatIds || []);
      } catch (e) {
        console.error('Failed to fetch chat IDs', e);
      }
    };

    fetchChatIds();
  }, []);

  const addMessage = (content: string, type: 'info' | 'message' | 'error' = 'info') => {
    setMessages(prev => [...prev, { time: new Date().toLocaleTimeString(), content, type }]);
  };

  const connect = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    addMessage(`Connecting to ${WORKER_URL}/register/${clientId}...`, 'info');
    const eventSource = new EventSource(`${WORKER_URL}/register/${clientId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      addMessage('✓ SSE connection established', 'info');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'message') {
          const token = data.message;

          if (token === '[DONE]') {
            setIsGenerating(false);
            addMessage(`Received: ${JSON.stringify(data, null, 2)}`, 'message');
            return;
          }

          setChatMessages(prev => {
            const last = prev[prev.length - 1];

            if (last && last.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + token }
              ];
            } else {
              return [...prev, { role: 'assistant', content: token }];
            }
          });
        }

        addMessage(`Received: ${JSON.stringify(data, null, 2)}`, 'message');
      } catch {
        addMessage(`Raw message: ${event.data}`, 'message');
      }
    };
    eventSource.onerror = () => {
      setIsConnected(false);
      addMessage('✗ Connection error or closed', 'error');
      eventSource.close();
    };
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      addMessage('Disconnected', 'info');
    }
  };

  const sendMessage = async () => {
    try {
      setChatMessages(prev => [...prev, { role: 'user', content: promptText }]);
      setIsGenerating(true);
      addMessage(`Starting workflow with prompt...`, 'info');


      const response = await fetch(WORKFLOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: promptText, clientId, chatId }),
      });
      const result = await response.json();
      addMessage(`Workflow started: ${result.workflowId}`, 'info');
      setPromptText('');
    } catch (error) {
      addMessage(`Workflow failed: ${error}`, 'error');
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isGenerating]);

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Connection + workflow controls */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Settings</CardTitle>
            <CardDescription>
              SSE Worker: {WORKER_URL}<br />
              Workflow Worker: {WORKFLOW_URL}<br />
              List Chats Worker: {LIST_CHATS_URL}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Client ID</label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Enter client ID"
                  disabled={isConnected}
                />
              </div>


              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Chat ID</label>
                <div className="flex gap-2">
                  {/* Manual entry */}
                  <Input
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="Enter chat ID"
                    disabled={isConnected}
                  />
                  {/* Dropdown selection */}
                  <select
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    className="border rounded px-2 py-1"
                    disabled={isConnected}
                  >
                    <option value="">Select existing chat</option>
                    {chatOptions.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button onClick={connect} disabled={isConnected || !chatId}>Connect</Button>
              <Button onClick={disconnect} disabled={!isConnected} variant="outline">Disconnect</Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </Badge>
            </div>

            <div className="border-t pt-4 space-y-2">
              <label className="text-sm font-medium block">Trigger AI Generation</label>
              <div className="flex gap-2">
                <Input
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder={isConnected ? "Chat with a snobby classical music elitist" : `You can chat here after you "Connect"`}
                />
                <Button onClick={sendMessage} disabled={!isConnected || isGenerating || !chatId}>
                  {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 💬 Chat UI */}
        <Card>
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 h-96 overflow-y-auto space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-muted-foreground text-center">No conversation yet...</div>
              )}


              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm wrap-break-word 
      ${msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-secondary text-secondary-foreground rounded-bl-none'
                      }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="bg-secondary text-secondary-foreground px-4 py-2 rounded-2xl rounded-bl-none text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Debug Log */}
        <Card>
          <CardHeader><CardTitle>Debug Log</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm space-y-2">
              {messages.length === 0 && (
                <div className="text-muted-foreground">No messages yet...</div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">[{msg.time}]</span>
                  <span className={
                    msg.type === 'error' ? 'text-red-500' :
                      msg.type === 'message' ? 'text-green-600' :
                        'text-foreground'
                  }>
                    {msg.content}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

