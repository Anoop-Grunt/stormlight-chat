

'use client'

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Terminal } from "lucide-react";
import { useAtomValue } from "jotai";
import { debugMessagesAtom } from "@/atoms/debugLog";
import { useRef, useEffect } from "react";

export const DebugCard: React.FC = () => {
  const debugMessages = useAtomValue(debugMessagesAtom);
  const debugEndRef = useRef<HTMLDivElement>(null);

  // auto-scroll when new debug messages arrive
  useEffect(() => {
    if (debugMessages.length > 0) {
      debugEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [debugMessages]);

  return (
    <Card className="border-2 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm flex flex-col overflow-hidden h-[70vh]">
      <CardHeader className="border-b shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-red-600" />
          <CardTitle>Debug Logs</CardTitle>
        </div>
        <CardDescription>Real-time SSE & workflow messages</CardDescription>
      </CardHeader>

      <div className="flex-1 p-4 overflow-y-scroll">
        <div className="space-y-1 font-mono text-xs">
          {debugMessages.map((msg, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap wrap-break-word ${msg.type === 'info'
                  ? 'text-slate-700 dark:text-slate-300'
                  : msg.type === 'error'
                    ? 'text-red-500'
                    : 'text-blue-600'
                }`}
            >
              [{msg.time}] {msg.content}
            </div>
          ))}
          <div ref={debugEndRef} />
        </div>
      </div>
    </Card>
  );
};

