
'use client'
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Loader2, Send } from "lucide-react";
import Image from "next/image";
import { useAtom, useSetAtom } from "jotai";
import { chatMessagesAtom, addUserMessageAtom } from "@/atoms/chatLog";
import { addDebugMessageAtom } from "@/atoms/debugLog";
import { sseDoId, isChatGenerating, activePersona } from "@/atoms/common";
import { useRef, useEffect, useState } from "react";
import { chatIdAtom } from "@/atoms/common"; // new atom for chatId

interface ChatCardProps {
  currentPersona: { name: string; accent: string };
}

export const ChatCard: React.FC<ChatCardProps> = ({ currentPersona }) => {
  const [chatMessages] = useAtom(chatMessagesAtom);
  const addUserMessage = useSetAtom(addUserMessageAtom);
  const addDebugMessage = useSetAtom(addDebugMessageAtom);

  const [promptText, setPromptText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [clientId] = useAtom(sseDoId);
  const [chatId] = useAtom(chatIdAtom);
  const [selectedPersona] = useAtom(activePersona);
  const [isGenerating, setIsGenerating] = useAtom(isChatGenerating);

  useEffect(() => {
    if (chatMessages.length > 0 || isGenerating) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isGenerating]);

  const handleSend = async () => {
    if (!promptText.trim() || isGenerating || !chatId) return;

    addUserMessage(promptText);
    addDebugMessage({ content: `Starting workflow with prompt...` });
    setIsGenerating(true);
    setPromptText('')
    try {
      const res = await fetch('https://llm-workflow.feldspar.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: promptText, clientId, chatId, persona: selectedPersona }),
      });
      const result = await res.json();
      addDebugMessage({ content: `Workflow started: ${result.workflowId}` });
    } catch (err) {
      addDebugMessage({ content: `Workflow failed: ${err}`, type: 'error' });
    } finally {
    }
  };

  return (
    <Card className="border-2 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col overflow-hidden h-[70vh]">
      {/* Header */}
      <CardHeader className="border-b shrink-0">
        <div className="flex items-center gap-2">
          <Image alt="convo" src={`/${selectedPersona}.png`} className="h-8 w-6" width={337} height={446} />
          <CardTitle>Conversation</CardTitle>
        </div>
        <CardDescription>Chatting with&nbsp;
          <span className="inline-block first-letter:capitalize">
            {selectedPersona}
          </span>
          &nbsp;in real-time</CardDescription>
      </CardHeader>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {chatMessages.length === 0 && (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center space-y-2">
                <div className={`w-16 h-16 rounded-full bg-linear-to-br ${currentPersona?.accent} flex items-center justify-center mx-auto`}>
                  <Image
                    width={337}
                    height={446}
                    alt={currentPersona!.name}
                    className={`w-8 h-12`}
                    src={`/${currentPersona!.name.toLowerCase()}.png`}
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">No conversation yet</p>
                <p className="text-xs text-slate-400">Connect and start chatting!</p>
              </div>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-md
                  ${msg.role === 'user'
                    ? 'bg-linear-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'
                  } ${msg.role === 'system' ? 'hidden' : ''}`}
              >
                <div className="whitespace-pre-wrap wrap-break-word">{msg.content}</div>
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

      {/* Input */}
      <div className="border-t p-4 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
        <div className="flex gap-2">
          <input
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isGenerating}
            placeholder={isGenerating ? "Thinking..." : "Type your message..."}
            className="flex-1 shadow-sm px-3 py-2 rounded-md border dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            onClick={handleSend}
            disabled={!promptText.trim() || isGenerating}
            className="flex-none bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};

