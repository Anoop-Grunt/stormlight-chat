
import { atom } from "jotai";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export const chatMessagesAtom = atom<ChatMessage[]>([]);
export const promptTextAtom = atom<string>("");

export const addUserMessageAtom = atom(null, (get, set, content: string) => {
  set(chatMessagesAtom, (prev) => [...prev, { role: "user", content }]);
});

export const addAssistantChunkAtom = atom(null, (get, set, chunk: string) => {
  set(chatMessagesAtom, (prev) => {
    const last = prev.at(-1);
    if (last?.role === "assistant") {
      return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
    }
    return [...prev, { role: "assistant", content: chunk }];
  });
});

export const setChatMessagesAtom = atom(null, (get, set, messages: ChatMessage[]) => {
  set(chatMessagesAtom, messages);
});

export const clearChatAtom = atom(null, (get, set) => {
  set(chatMessagesAtom, []);
  set(promptTextAtom, "");
});

