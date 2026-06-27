function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-!.]/g, "\\$&");
}

export function codeFence(value: string): string {
  return `\`\`\`\n${value.replace(/\r\n/g, "\n")}\n\`\`\``;
}

export function heading(level: number, text: string): string {
  return `${"#".repeat(level)} ${escapeMarkdown(text)}`;
}

export function bullet(text: string): string {
  return `- ${text}`;
}
