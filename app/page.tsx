'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Sparkles, Terminal, MessageSquare, Link2, Plus, Smile, Frown, Meh, Laugh, User } from 'lucide-react';
import { v6 } from "uuid"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

const WORKER_URL = 'https://chat-room-do-worker.feldspar.workers.dev';
const WORKFLOW_URL = 'https://llm-workflow.feldspar.workers.dev';
const LIST_CHATS_URL = "https://chat-list-worker.feldspar.workers.dev"
const RETRIEVE_CHAT_URL = `https://chat-retrieve-worker.feldspar.workers.dev?chatId=`

const PERSONAS = [
  { id: 'friendly', name: 'Friendly', icon: Smile, color: 'text-green-500' },
  { id: 'neutral', name: 'Neutral', icon: Meh, color: 'text-slate-500' },
  { id: 'professional', name: 'Professional', icon: User, color: 'text-blue-500' },
  { id: 'sarcastic', name: 'Sarcastic', icon: Laugh, color: 'text-purple-500' },
  { id: 'snobby', name: 'Snobby', icon: Frown, color: 'text-amber-500' },
];

export default function Page() {
  const [clientId, setClientId] = useState(`${v6()}`);
  const [isConnected, setIsConnected] = useState(false);
  const [debugMessages, setDebugMessages] = useState<Array<{ time: string; content: string; type: 'info' | 'message' | 'error' }>>([]);
  const [promptText, setPromptText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatId, setChatId] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('friendly');
  const eventSourceRef = useRef<EventSource | null>(null);
  const debugEndRef = useRef<HTMLDivElement>(null);
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
    setDebugMessages(prev => [...prev, { time: new Date().toLocaleTimeString(), content, type }]);
  };

  const connect = async () => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    addMessage(`Connecting to ${WORKER_URL}/register/${clientId}...`, 'info');

    try {
      const res = await fetch(`${RETRIEVE_CHAT_URL}${chatId}`);
      const data = await res.json();
      setChatMessages(Array.isArray(data.chatMessages) ? data.chatMessages : []);
      addMessage(`Chat state loaded from KV (${chatId})`, 'info');
    } catch (err) {
      console.error('Failed to fetch chat from KV', err);
      setChatMessages([]);
      addMessage(`Failed to load chat from KV, starting fresh`, 'error');
    }

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
              return [...prev.slice(0, -1), { ...last, content: last.content + token }];
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
        body: JSON.stringify({ text: promptText, clientId, chatId, persona: selectedPersona }),
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
    if (chatMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isGenerating]);

  useEffect(() => {
    if (debugMessages.length > 0) {
      debugEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [debugMessages]);

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex">
      {/* Sidebar */}
      <div className="w-80 border-r bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Edge AI Chat
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Cloudflare Workers</p>
            </div>
          </div>

          <Badge variant={isConnected ? "default" : "secondary"} className="gap-2 w-full justify-center">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* Chat Selection */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Chat Session
              </label>
              <Input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Enter or create chat name"
                disabled={isConnected}
                className="text-sm"
              />
              <Button
                onClick={isConnected ? disconnect : connect}
                disabled={!isConnected && !chatId}
                className={`w-full ${isConnected
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                  } ${!isConnected && chatId ? 'animate-bounce' : ''}`}
                size="sm"
              >
                {isConnected ? (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Disconnect
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Previous Chats
              </label>
              <ScrollArea className="h-48 rounded-lg border bg-slate-50 dark:bg-slate-950/50">
                <div className="p-2 space-y-1">
                  {chatOptions.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-8">
                      No saved chats yet
                    </div>
                  )}
                  {chatOptions.map((id) => (
                    <Button
                      key={id}
                      variant={chatId === id ? "secondary" : "ghost"}
                      className="w-full justify-start text-xs h-8"
                      onClick={() => !isConnected && setChatId(id)}
                      disabled={isConnected}
                    >
                      <MessageSquare className="w-3 h-3 mr-2" />
                      {id}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Connection Info */}
          <div className="p-4 border-t mt-auto">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Client ID
              </label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={isConnected}
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 flex-shrink-0">
          <div className="flex items-center justify-start gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {chatId || 'No Chat Selected'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedPersona && `Persona: ${PERSONAS.find(p => p.id === selectedPersona)?.name}`}
              </p>
            </div>

            {/* Persona Selection */}
            <div className={`flex items-center scale-90 gap-2 ${!isConnected ? 'animate-bounce' : 'animate-none'}`}>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Persona:</span>
              {PERSONAS.map((persona) => {
                const Icon = persona.icon;
                return (
                  <button
                    key={persona.id}
                    onClick={() => setSelectedPersona(persona.id)}
                    disabled={isConnected}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all
                      ${selectedPersona === persona.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 scale-110'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }
                      ${isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                    `}
                    title={persona.name}
                  >
                    <Icon className={`w-5 h-5 ${persona.color}`} />
                    <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
                      {persona.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chat and Debug Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-hidden">
          {/* Chat Panel */}
          <Card className="border-2 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col overflow-hidden h-[70vh]">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                <CardTitle>Conversation</CardTitle>
              </div>
              <CardDescription>Chat with the AI assistant in real-time</CardDescription>
            </CardHeader>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {chatMessages.length === 0 && (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="text-center space-y-2">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center mx-auto">
                        <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">No conversation yet</p>
                      <p className="text-xs text-slate-400">Connect and start chatting!</p>
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-md
                        ${msg.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'
                        } ${msg.role === 'system' ? 'hidden' : ''}`}
                    >
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    </div>
                  </div>
                ))}

                {isGenerating && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm text-sm flex items-center gap-2 shadow-md border border-slate-200 dark:border-slate-700">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-slate-600 dark:text-slate-400">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="border-t p-4 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
              <div className="flex gap-2">
                <Input
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && isConnected && !isGenerating && chatId) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={!isConnected}
                  placeholder={isConnected ? "Type your message..." : "Connect to start chatting"}
                  className="flex-1 shadow-sm"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!isConnected || isGenerating || !chatId}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg px-6"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* Debug Panel */}
          <Card className="border-2 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col overflow-hidden h-[70vh]">
            <CardHeader className="border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-600" />
                <CardTitle>Debug Console</CardTitle>
              </div>
              <CardDescription>Real-time event stream and system logs</CardDescription>
            </CardHeader>

            <div className="flex-1 overflow-y-auto bg-slate-950 dark:bg-black p-4 font-mono text-xs">
              <div className="space-y-1">
                {debugMessages.length === 0 && (
                  <div className="text-slate-500 italic">Waiting for events...</div>
                )}
                {debugMessages.map((msg, idx) => (
                  <div key={idx} className="flex gap-2 hover:bg-slate-900/50 px-2 py-1 rounded">
                    <span className="text-slate-600 shrink-0">[{msg.time}]</span>
                    <span className={
                      msg.type === 'error' ? 'text-red-400' :
                        msg.type === 'message' ? 'text-emerald-400' :
                          'text-slate-300'
                    }>
                      {msg.content}
                    </span>
                  </div>
                ))}
                <div ref={debugEndRef} />
              </div>
            </div>
          </Card>
        </div>

        {/* Footer Info */}
        <div className="border-t bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-4 flex-shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="font-semibold">SSE:</span>
              <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">{WORKER_URL}</code>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="font-semibold">Workflow:</span>
              <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">{WORKFLOW_URL}</code>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="font-semibold">List:</span>
              <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">{LIST_CHATS_URL}</code>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-500" />
              <span className="font-semibold">Retrieve:</span>
              <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">{RETRIEVE_CHAT_URL}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
