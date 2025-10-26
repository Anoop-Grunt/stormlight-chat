
import { atom } from "jotai";

export type DebugMessage = {
  time: string;
  content: string;
  type: "info" | "message" | "error";
};

export const debugMessagesAtom = atom<DebugMessage[]>([]);

export const addDebugMessageAtom = atom(
  null,
  (
    get,
    set,
    { content, type = "info" }: { content: string; type?: "info" | "message" | "error" }
  ) => {
    const time = new Date().toLocaleTimeString();
    set(debugMessagesAtom, (prev) => [...prev, { time, content, type }]);
  }
);

export const clearDebugAtom = atom(null, (get, set) => {
  set(debugMessagesAtom, []);
});

