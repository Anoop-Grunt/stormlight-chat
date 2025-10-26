'use client'

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Sparkles, Terminal, MessageSquare, Link2, User } from 'lucide-react';
import { v6 } from "uuid";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image"
import { useAtom } from 'jotai'
import { sseDoId, activePersona, isChatGenerating, chatIdAtom } from "@/atoms/common"
import { useSetAtom } from "jotai";
import {
  addUserMessageAtom,
  addAssistantChunkAtom,
  setChatMessagesAtom,
} from "@/atoms/chatLog";
import { addDebugMessageAtom } from "@/atoms/debugLog";
import { ChatCard } from "@/components/stormlightchat/ChatCard"
import { DebugCard } from '@/components/stormlightchat/DebugCard'

const WORKER_URL = 'https://chat-room-do-worker.feldspar.workers.dev';
const WORKFLOW_URL = 'https://llm-workflow.feldspar.workers.dev';
const LIST_CHATS_URL = "https://chat-list-worker.feldspar.workers.dev"
const RETRIEVE_CHAT_URL = `https://chat-retrieve-worker.feldspar.workers.dev?chatId=`

// Stormlight Archive Characters as Personas
const PERSONAS = [
  { id: 'kaladin', name: 'Kaladin', icon: User, accent: 'from-sky-500 to-indigo-700', bg: 'from-sky-50 via-blue-50 to-indigo-100', text: 'text-blue-600' },
  { id: 'shallan', name: 'Shallan', icon: User, accent: 'from-rose-400 to-pink-600', bg: 'from-rose-50 via-pink-50 to-rose-100', text: 'text-rose-600' },
  { id: 'dalinar', name: 'Dalinar', icon: User, accent: 'from-slate-600 to-gray-800', bg: 'from-gray-100 via-slate-100 to-gray-200', text: 'text-slate-700' },
  { id: 'adolin', name: 'Adolin', icon: User, accent: 'from-amber-400 to-yellow-600', bg: 'from-amber-50 via-yellow-50 to-amber-100', text: 'text-amber-600' },
  { id: 'szeth', name: 'Szeth', icon: User, accent: 'from-zinc-300 to-slate-400', bg: 'from-zinc-50 via-slate-50 to-zinc-100', text: 'text-zinc-500' },
];

export default function Page() {
  const [clientId, setClientId] = useAtom(sseDoId)
  const [isConnected, setIsConnected] = useState(false);
  const [promptText, setPromptText] = useState('');
  const addUserMessage = useSetAtom(addUserMessageAtom);
  const addAssistantChunk = useSetAtom(addAssistantChunkAtom);
  const setChatMessages = useSetAtom(setChatMessagesAtom);
  const addDebugMessage = useSetAtom(addDebugMessageAtom);
  const setIsGenerating = useSetAtom(isChatGenerating);
  const [chatId, setChatId] = useAtom(chatIdAtom);
  const [selectedPersona, setSelectedPersona] = useAtom(activePersona);
  const eventSourceRef = useRef<EventSource | null>(null);
  const debugEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatOptions, setChatOptions] = useState<string[]>([]);

  const fetchChatIds = async () => {
    try {
      const res = await fetch(LIST_CHATS_URL);
      const data = await res.json();
      setChatOptions(data.chatIds || []);
    } catch (e) {
      console.error('Failed to fetch chat IDs', e);
    }
  };

  useEffect(() => {
    fetchChatIds();
  }, []);


  const retrieveChats = async () => {

  }
  const connect = async () => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    addDebugMessage({ content: `Connecting to ${WORKER_URL}/register/${clientId}...` });

    try {
      const res = await fetch(`${RETRIEVE_CHAT_URL}${chatId}`);
      const data = await res.json();

      if (data.persona) setSelectedPersona(data.persona);

      // replace chat messages with retrieved chat from KV
      setChatMessages(Array.isArray(data.chat) ? data.chat : []);
      addDebugMessage({ content: `Chat state loaded from KV (${chatId})` });
    } catch (err) {
      console.error('Failed to fetch chat from KV', err);
      setChatMessages([]); // start fresh
      addDebugMessage({ content: `Failed to load chat from KV, starting fresh`, type: 'error' });
    }

    const eventSource = new EventSource(`${WORKER_URL}/register/${clientId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      addDebugMessage({ content: '✓ SSE connection established' });
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'message') {
          const token = data.message;

          if (token === '[DONE]') {
            setIsGenerating(false);
            addDebugMessage({ content: `Received DONE`, type: 'message' });
            return;
          }

          // append assistant chunk
          addAssistantChunk(token);
        }

        addDebugMessage({ content: `Received: ${JSON.stringify(data, null, 2)}`, type: 'message' });
      } catch {
        addDebugMessage({ content: `Raw message: ${event.data}`, type: 'message' });
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      addDebugMessage({ content: '✗ Connection error or closed', type: 'error' });
      eventSource.close();
    };
  };
  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      addDebugMessage({ content: 'Disconnected from chat', type: 'info' });
      setChatId('')
      setClientId(v6().toString())
      setIsGenerating((false))
      //Maybe a new chat got added? so refetch, but since it's edge, wait a sec
      setTimeout(() => { fetchChatIds() }, 1000);
    }
  };

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  const currentPersona = PERSONAS.find(p => p.id === selectedPersona)!;

  return (
    <div className={`min-h-screen bg-linear-to-br ${currentPersona?.bg} dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex`}>
      {/* Sidebar */}
      <div className="w-80 border-r bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${currentPersona?.accent} flex items-center justify-center`}>
              <Image width={337} height={446} alt={currentPersona!.name} className={`w-6 h-8`} src={`/${currentPersona!.name.toLowerCase()}.png`} />
            </div>
            <div>
              <h1 className={`text-lg font-bold bg-clip-text text-transparent bg-linear-to-r ${currentPersona?.accent}`}>
                Chat with <span className='inline-block first-letter:capitalize'>{selectedPersona}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">The Stormlight Archive</p>
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
                className={`text-sm ${!chatId && 'not-focus-within:animate-bounce'} mt-2 mb-4`}
              />
              <Button
                onClick={isConnected ? disconnect : connect}
                disabled={!isConnected && (!chatId || !clientId)}
                className={`w-full ${isConnected
                  ? 'bg-red-600 hover:bg-red-700'
                  : `bg-linear-to-r ${currentPersona?.accent} hover:from-blue-700 hover:to-indigo-700`
                  } ${!isConnected && chatId ? 'animate-bounce' : ''}`}
                size="sm"
              >
                <Link2 className="w-4 h-4 mr-2" />
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Previous Chats
              </label>
              <ScrollArea className="h-72 rounded-lg border bg-slate-50 dark:bg-slate-950/50">
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
                disabled={true}
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-4 shrink-0">
          <div className="flex items-center justify-start gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {chatId || 'No Chat Selected'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedPersona && `Persona: ${PERSONAS.find(p => p.id === selectedPersona)?.name}`}
              </p>
            </div>

            <div className={`flex items-center gap-2 scale-90 ${!isConnected ? 'animate-bounce' : 'animate-none'}`}>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Persona:</span>
              {PERSONAS.map((persona) => {
                return (
                  <button
                    key={persona.id}
                    onClick={() => setSelectedPersona(persona.id)}
                    disabled={isConnected}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all
                      ${selectedPersona === persona.id
                        ? `border-blue-500 bg-linear-to-br ${persona.bg} scale-110`
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }
                      ${isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                    `}
                    title={persona.name}
                  >
                    <Image width={337} height={446} alt={persona.name} className={`w-6 h-8`} src={`/${persona.name.toLowerCase()}.png`} />
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

          <ChatCard currentPersona={currentPersona} />
          <DebugCard />

          {/* Footer Info */}

        </div>

        <div className="border-t bg-transparent dark:bg-slate-900/60 backdrop-blur-sm p-4 shrink-0">
          <div className="text-xs w-full text-slate-500 dark:text-slate-400 text-center grid grid-cols-2 gap-2">
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

