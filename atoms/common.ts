import { atom } from "jotai";
import { v6 } from "uuid";

export const sseDoId = atom<string>(v6())
export const isChatGenerating = atom<boolean>(false)
export const chatIdAtom = atom('')
export const activePersona = atom<string>('dalinar')
