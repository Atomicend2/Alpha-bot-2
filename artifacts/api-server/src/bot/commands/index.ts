import type { WASocket, proto } from "@whiskeysockets/baileys";

export interface CommandContext {
  sock: WASocket;
  msg: proto.IWebMessageInfo;
  from: string;
  sender: string;
  command: string;
  args: string[];
  isAdmin: boolean;
  isBotAdmin: boolean;
  isOwner: boolean;
  isGroupAdmin: boolean;
  groupMeta: any;
  prefix: string;
  body: string;
}
