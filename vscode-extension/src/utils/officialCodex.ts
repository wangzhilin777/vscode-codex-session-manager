import * as vscode from "vscode";
import { OFFICIAL_CODEX_EXTENSION_ID } from "../constants";
import { buildOfficialCodexConversationUriString } from "./officialCodexRoute";

export function buildOfficialCodexConversationUri(
  sessionId: string,
  uriScheme: string = vscode.env.uriScheme
): vscode.Uri {
  return vscode.Uri.parse(buildOfficialCodexConversationUriString(uriScheme, sessionId));
}

export function hasOfficialCodexExtension(): boolean {
  return vscode.extensions.getExtension(OFFICIAL_CODEX_EXTENSION_ID) != null;
}

export async function openOfficialCodexConversation(sessionId: string): Promise<boolean> {
  const extension = vscode.extensions.getExtension(OFFICIAL_CODEX_EXTENSION_ID);
  if (!extension) {
    throw new Error("official Codex VS Code extension is not installed.");
  }

  if (!extension.isActive) {
    await extension.activate();
  }

  try {
    await vscode.commands.executeCommand("chatgpt.openSidebar");
  } catch {
    // The deep link still works through the URI handler even if the command is unavailable.
  }

  return await vscode.env.openExternal(buildOfficialCodexConversationUri(sessionId));
}
