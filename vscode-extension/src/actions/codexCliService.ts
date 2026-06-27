import { spawn } from "node:child_process";
import * as vscode from "vscode";
import { CLI_TERMINAL_NAME } from "../constants";
import { ExtensionSettings, Logger, SessionRecord } from "../types";

function quoteArgument(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export class CodexCliService {
  public constructor(private readonly settings: ExtensionSettings, private readonly logger: Logger) {}

  public async checkAvailability(): Promise<boolean> {
    try {
      await this.run(["--version"]);
      return true;
    } catch (error) {
      this.logger.appendLine(`[cli] unavailable: ${String(error)}`);
      return false;
    }
  }

  public resumeInTerminal(session: SessionRecord): void {
    const terminal = this.ensureTerminal(session.cwd || undefined);
    const command = `${this.settings.codexCliPath} resume ${quoteArgument(session.sessionId)}`;
    terminal.show(true);
    terminal.sendText(command, true);
  }

  public async archive(session: SessionRecord): Promise<void> {
    await this.run(["archive", session.sessionId]);
  }

  public async unarchive(session: SessionRecord): Promise<void> {
    await this.run(["unarchive", session.sessionId]);
  }

  public copyResumeCommand(session: SessionRecord): string {
    return `${this.settings.codexCliPath} resume ${quoteArgument(session.sessionId)}`;
  }

  private ensureTerminal(cwd?: string): vscode.Terminal {
    const existing = vscode.window.terminals.find((terminal) => terminal.name === CLI_TERMINAL_NAME);
    if (existing) {
      return existing;
    }
    return vscode.window.createTerminal({
      name: CLI_TERMINAL_NAME,
      cwd: cwd || undefined
    });
  }

  private async run(args: string[]): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const env = { ...process.env };
      if (this.settings.codexHomeOverride.trim()) {
        env.CODEX_HOME = this.settings.codexHomeOverride.trim();
      }

      const child = spawn(this.settings.codexCliPath || "codex", args, {
        env,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (error) => {
        reject(error);
      });
      child.on("exit", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
          return;
        }
        reject(new Error(stderr.trim() || `codex exited with code ${code}`));
      });
    });
  }
}
