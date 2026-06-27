import * as vscode from "vscode";
import { DETAILS_URI_SCHEME, MAX_TURNS_IN_DETAILS } from "../constants";
import { AppServerThreadDetail, ExtensionSettings, SessionRecord } from "../types";
import { bullet, codeFence, heading } from "../utils/markdown";
import { formatAbsoluteTime } from "../utils/time";
import { SessionRepository } from "../data/sessionRepository";

export class SessionDetailsProvider implements vscode.TextDocumentContentProvider {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly cache = new Map<string, string>();

  public readonly onDidChange = this.onDidChangeEmitter.event;

  public constructor(private readonly repository: SessionRepository, private readonly getSettings: () => ExtensionSettings) {}

  public uriFor(sessionId: string): vscode.Uri {
    return vscode.Uri.parse(`${DETAILS_URI_SCHEME}:/${sessionId}.md`);
  }

  public async open(session: SessionRecord): Promise<void> {
    const uri = this.uriFor(session.sessionId);
    this.cache.set(uri.toString(), await this.render(session));
    this.onDidChangeEmitter.fire(uri);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false
    });
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.cache.get(uri.toString()) ?? "# Loading...";
  }

  private async render(session: SessionRecord): Promise<string> {
    const lines: string[] = [];
    lines.push(heading(1, session.displayName));
    lines.push("");
    lines.push(bullet(`Session ID: \`${session.sessionId}\``));
    lines.push(bullet(`Source: ${session.sourceLabel}`));
    lines.push(bullet(`Project: ${session.projectLabel}`));
    lines.push(bullet(`Updated: ${formatAbsoluteTime(session.updatedAt)}`));
    lines.push(bullet(`Created: ${formatAbsoluteTime(session.createdAt)}`));
    lines.push(bullet(`CWD: \`${session.cwd || "-"}\``));
    if (session.path) {
      lines.push(bullet(`Path: \`${session.path}\``));
    }
    if (session.local.note) {
      lines.push(bullet(`Note: ${session.local.note}`));
    }
    lines.push("");
    lines.push(heading(2, "Preview"));
    lines.push("");
    lines.push(codeFence(session.preview || session.name || "(empty preview)"));
    lines.push("");

    try {
      const detail = await this.repository.readDetails(session.sessionId);
      lines.push(...this.renderTurns(detail, this.getSettings()));
    } catch (error) {
      lines.push(heading(2, "Turns"));
      lines.push("");
      lines.push(bullet(`Detail view unavailable: ${String(error)}`));
      lines.push("");
      lines.push(bullet("List mode still works because the extension can fall back to local session files."));
    }

    return `${lines.join("\n")}\n`;
  }

  private renderTurns(detail: AppServerThreadDetail, settings: ExtensionSettings): string[] {
    const lines: string[] = [];
    lines.push(heading(2, "Turns"));
    lines.push("");
    const turns = detail.turns.slice(-MAX_TURNS_IN_DETAILS);

    if (turns.length === 0) {
      lines.push(bullet("No turns available."));
      return lines;
    }

    for (const turn of turns) {
      lines.push(heading(3, turn.id || "turn"));
      lines.push("");
      lines.push(bullet(`Status: ${turn.status ?? "unknown"}`));
      lines.push(bullet(`Started: ${formatAbsoluteTime(turn.startedAt)}`));
      lines.push(bullet(`Completed: ${formatAbsoluteTime(turn.completedAt)}`));
      lines.push("");

      const items = settings.detailTurnFetchMode === "summary" ? turn.items.slice(0, 4) : turn.items;
      for (const item of items) {
        lines.push(heading(4, item.label));
        lines.push("");
        lines.push(codeFence(item.text || "(empty)"));
        lines.push("");
      }
    }

    return lines;
  }
}
