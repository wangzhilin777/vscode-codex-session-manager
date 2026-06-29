import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { RepositorySnapshot, SessionFilterState, SessionRecord } from "../types";
import { isSessionPinned } from "../data/sessionTransforms";
import { formatRelativeTime } from "../utils/time";
import { t } from "../utils/i18n";

export type MetadataField = "alias" | "projectTag" | "note";

interface InlineSearchCallbacks {
  onSearchChanged(value: string): Promise<void>;
  onToggleCurrentProjectOnly(): Promise<void>;
  onToggleArchived(): Promise<void>;
  onClearSearch(): Promise<void>;
  onRefresh(): Promise<void>;
  onOpenOfficial(sessionId: string): Promise<void>;
  onOpenDetails(sessionId: string): Promise<void>;
  onToggleArchive(sessionId: string): Promise<void>;
  onDeleteSession(sessionId: string): Promise<void>;
  onSaveMetadata(sessionId: string, field: MetadataField, value: string): Promise<void>;
}

interface InlineSearchSessionItem {
  id: string;
  sessionId: string;
  displayName: string;
  preview: string;
  cwd: string;
  sourceLabel: string;
  projectLabel: string;
  updatedLabel: string;
  archived: boolean;
  pinned: boolean;
  unread: boolean;
  alias: string;
  projectTag: string;
  note: string;
}

interface InlineSearchRenderState {
  sessions: InlineSearchSessionItem[];
  totalVisible: number;
  fullCount: number;
  filter: SessionFilterState;
  viewMessage: string;
  editing: { sessionId: string; field: MetadataField } | null;
  labels: Record<string, string>;
}

type WebviewMessage =
  | { type: "ready" }
  | { type: "searchChanged"; value?: unknown }
  | { type: "clearSearch" }
  | { type: "toggleCurrentProjectOnly" }
  | { type: "toggleArchived" }
  | { type: "refresh" }
  | { type: "openOfficial"; sessionId?: unknown }
  | { type: "openDetails"; sessionId?: unknown }
  | { type: "toggleArchive"; sessionId?: unknown }
  | { type: "deleteSession"; sessionId?: unknown }
  | { type: "beginEdit"; sessionId?: unknown; field?: unknown }
  | { type: "cancelEdit" }
  | { type: "saveMetadata"; sessionId?: unknown; field?: unknown; value?: unknown };

const MAX_RENDERED_SESSIONS = 80;

function nonce(): string {
  return randomBytes(16).toString("hex");
}

function toInlineItem(session: SessionRecord): InlineSearchSessionItem {
  return {
    id: session.id,
    sessionId: session.sessionId,
    displayName: session.displayName,
    preview: session.preview,
    cwd: session.cwd || session.workspaceRoot,
    sourceLabel: session.sourceLabel,
    projectLabel: session.projectLabel,
    updatedLabel: formatRelativeTime(session.updatedAt),
    archived: session.archived,
    pinned: isSessionPinned(session),
    unread: !!session.local.unread,
    alias: session.local.alias,
    projectTag: session.local.projectTag,
    note: session.local.note
  };
}

function asMetadataField(value: unknown): MetadataField | null {
  return value === "alias" || value === "projectTag" || value === "note" ? value : null;
}

function labels(): Record<string, string> {
  return {
    title: t("inlineSearchTitle"),
    placeholder: t("searchSessionsPlaceholder"),
    currentWorkspace: t("currentGroupLabel"),
    allWorkspaces: t("allWorkspacesLabel"),
    showArchived: t("inlineShowArchivedLabel"),
    hideArchived: t("inlineHideArchivedLabel"),
    clear: t("inlineClearLabel"),
    refresh: t("inlineRefreshLabel"),
    open: t("inlineOpenLabel"),
    details: t("inlineDetailsLabel"),
    archive: t("inlineArchiveLabel"),
    unarchive: t("inlineUnarchiveLabel"),
    delete: t("inlineDeleteLabel"),
    rename: t("inlineRenameLabel"),
    projectTag: t("inlineProjectTagLabel"),
    note: t("inlineNoteLabel"),
    save: t("inlineSaveLabel"),
    cancel: t("inlineCancelLabel"),
    noSessions: t("noSessionsAvailable"),
    noMatches: t("inlineNoMatchesLabel"),
    resultSummary: t("inlineResultSummary"),
    filteredSummary: t("inlineFilteredSummary"),
    archived: t("archivedBadge"),
    pinned: t("pinnedBadge"),
    unread: t("unreadBadge"),
    editingPrefix: t("inlineEditingPrefix"),
    searchInPanel: t("inlineSearchInPanelLabel")
  };
}

export class SessionInlineSearchProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null = null;
  private snapshot: RepositorySnapshot | null = null;
  private filter: SessionFilterState = {
    currentProjectOnly: false,
    showArchived: true,
    searchTerm: ""
  };
  private fullCount = 0;
  private viewMessage = "";
  private editing: { sessionId: string; field: MetadataField } | null = null;

  public constructor(private readonly callbacks: InlineSearchCallbacks) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.html = this.html(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.handleMessage(message);
    });
  }

  public setSnapshot(snapshot: RepositorySnapshot, filter: SessionFilterState, viewMessage: string, fullCount: number): void {
    this.snapshot = snapshot;
    this.filter = { ...filter };
    this.viewMessage = viewMessage;
    this.fullCount = fullCount;
    this.postRenderState();
  }

  public focusSearch(): void {
    this.post({ type: "focusSearch" });
  }

  public beginEdit(sessionId: string, field: MetadataField): void {
    this.editing = { sessionId, field };
    this.postRenderState();
    this.post({ type: "focusEditor", sessionId, field });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.postRenderState();
        return;
      case "searchChanged":
        await this.callbacks.onSearchChanged(typeof message.value === "string" ? message.value : "");
        return;
      case "clearSearch":
        await this.callbacks.onClearSearch();
        this.focusSearch();
        return;
      case "toggleCurrentProjectOnly":
        await this.callbacks.onToggleCurrentProjectOnly();
        return;
      case "toggleArchived":
        await this.callbacks.onToggleArchived();
        return;
      case "refresh":
        await this.callbacks.onRefresh();
        return;
      case "openOfficial":
        if (typeof message.sessionId === "string") {
          await this.callbacks.onOpenOfficial(message.sessionId);
        }
        return;
      case "openDetails":
        if (typeof message.sessionId === "string") {
          await this.callbacks.onOpenDetails(message.sessionId);
        }
        return;
      case "toggleArchive":
        if (typeof message.sessionId === "string") {
          await this.callbacks.onToggleArchive(message.sessionId);
        }
        return;
      case "deleteSession":
        if (typeof message.sessionId === "string") {
          await this.callbacks.onDeleteSession(message.sessionId);
        }
        return;
      case "beginEdit": {
        const field = asMetadataField(message.field);
        if (typeof message.sessionId === "string" && field) {
          this.beginEdit(message.sessionId, field);
        }
        return;
      }
      case "cancelEdit":
        this.editing = null;
        this.postRenderState();
        return;
      case "saveMetadata": {
        const field = asMetadataField(message.field);
        const value = typeof message.value === "string" ? message.value : "";
        if (typeof message.sessionId === "string" && field) {
          this.editing = null;
          await this.callbacks.onSaveMetadata(message.sessionId, field, value);
        }
        return;
      }
    }
  }

  private postRenderState(): void {
    const sessions = this.snapshot?.sessions ?? [];
    const renderState: InlineSearchRenderState = {
      sessions: sessions.slice(0, MAX_RENDERED_SESSIONS).map(toInlineItem),
      totalVisible: sessions.length,
      fullCount: this.fullCount,
      filter: { ...this.filter },
      viewMessage: this.viewMessage,
      editing: this.editing,
      labels: labels()
    };
    this.post({ type: "render", state: renderState });
  }

  private post(message: unknown): void {
    void this.view?.webview.postMessage(message);
  }

  private html(webview: vscode.Webview): string {
    const scriptNonce = nonce();
    const styleNonce = nonce();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'nonce-${styleNonce}'`,
      `script-src 'nonce-${scriptNonce}'`
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${styleNonce}">
    :root {
      color-scheme: light dark;
    }
    body {
      margin: 0;
      padding: 8px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .search-row {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 6px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
    }
    .search-icon {
      opacity: 0.78;
      user-select: none;
    }
    #searchInput {
      width: 100%;
      min-width: 0;
      border: 0;
      outline: 0;
      padding: 2px 0;
      color: inherit;
      background: transparent;
      font: inherit;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    button {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 999px;
      padding: 3px 9px;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    button.primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    button.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .status {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.45;
      word-break: break-word;
    }
    .summary {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      padding: 0 2px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .card {
      border: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
      border-radius: 9px;
      padding: 8px;
      background: color-mix(in srgb, var(--vscode-editor-background) 72%, transparent);
    }
    .card:hover {
      border-color: var(--vscode-focusBorder);
    }
    .title {
      font-weight: 600;
      line-height: 1.35;
      word-break: break-word;
    }
    .meta,
    .preview,
    .cwd {
      margin-top: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }
    .badge {
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 11px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .badge.archived {
      background: color-mix(in srgb, var(--vscode-charts-orange) 30%, transparent);
      color: var(--vscode-foreground);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 8px;
    }
    .edit-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 8px;
      padding: 8px;
      border-radius: 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-focusBorder);
    }
    .edit-box label {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .edit-box input,
    .edit-box textarea {
      box-sizing: border-box;
      width: 100%;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 6px;
      outline: 0;
      padding: 5px 7px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font: inherit;
    }
    .edit-box textarea {
      min-height: 70px;
      resize: vertical;
    }
    .empty {
      padding: 14px 8px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      border: 1px dashed var(--vscode-sideBarSectionHeader-border, var(--vscode-input-border));
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <main class="panel">
    <div class="search-row">
      <input id="searchInput" type="search" autocomplete="off" spellcheck="false">
    </div>
    <div class="toolbar">
      <button id="scopeButton" type="button"></button>
      <button id="archiveButton" type="button"></button>
      <button id="clearButton" type="button"></button>
      <button id="refreshButton" type="button"></button>
    </div>
    <div id="status" class="status"></div>
    <div id="summary" class="summary"></div>
    <section id="list" class="list"></section>
  </main>
  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();
    const searchInput = document.getElementById('searchInput');
    const scopeButton = document.getElementById('scopeButton');
    const archiveButton = document.getElementById('archiveButton');
    const clearButton = document.getElementById('clearButton');
    const refreshButton = document.getElementById('refreshButton');
    const status = document.getElementById('status');
    const summary = document.getElementById('summary');
    const list = document.getElementById('list');
    let state = null;
    let suppressSearchEvent = false;
    let debounceTimer = 0;

    function post(type, payload = {}) {
      vscode.postMessage({ type, ...payload });
    }

    function label(key) {
      return state?.labels?.[key] ?? key;
    }

    function setText(node, value) {
      node.textContent = value || '';
    }

    function metadataValue(session, field) {
      if (field === 'alias') {
        return session.alias || '';
      }
      if (field === 'projectTag') {
        return session.projectTag || '';
      }
      return session.note || '';
    }

    function metadataLabel(field) {
      if (field === 'alias') {
        return label('rename');
      }
      if (field === 'projectTag') {
        return label('projectTag');
      }
      return label('note');
    }

    function renderEditBox(session, field) {
      const box = document.createElement('div');
      box.className = 'edit-box';

      const editLabel = document.createElement('label');
      editLabel.htmlFor = 'inline-editor-' + session.sessionId;
      editLabel.textContent = label('editingPrefix') + metadataLabel(field);
      box.appendChild(editLabel);

      const editor = field === 'note' ? document.createElement('textarea') : document.createElement('input');
      editor.id = 'inline-editor-' + session.sessionId;
      editor.value = metadataValue(session, field);
      editor.dataset.sessionId = session.sessionId;
      editor.dataset.field = field;
      box.appendChild(editor);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'primary';
      save.textContent = label('save');
      save.addEventListener('click', () => {
        post('saveMetadata', { sessionId: session.sessionId, field, value: editor.value });
      });
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = label('cancel');
      cancel.addEventListener('click', () => post('cancelEdit'));
      actions.append(save, cancel);
      box.appendChild(actions);

      editor.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          post('cancelEdit');
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          post('saveMetadata', { sessionId: session.sessionId, field, value: editor.value });
        }
      });

      return box;
    }

    function renderSession(session) {
      const card = document.createElement('article');
      card.className = 'card';

      const title = document.createElement('div');
      title.className = 'title';
      setText(title, session.displayName);
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'meta';
      setText(meta, [session.sourceLabel, session.projectLabel, session.updatedLabel].filter(Boolean).join(' · '));
      card.appendChild(meta);

      if (session.preview) {
        const preview = document.createElement('div');
        preview.className = 'preview';
        setText(preview, session.preview);
        card.appendChild(preview);
      }

      if (session.cwd) {
        const cwd = document.createElement('div');
        cwd.className = 'cwd';
        setText(cwd, session.cwd);
        card.appendChild(cwd);
      }

      const badgeValues = [
        session.archived ? { text: label('archived'), className: 'archived' } : null,
        session.pinned ? { text: label('pinned'), className: '' } : null,
        session.unread ? { text: label('unread'), className: '' } : null
      ].filter(Boolean);
      if (badgeValues.length > 0) {
        const badges = document.createElement('div');
        badges.className = 'badges';
        for (const badgeValue of badgeValues) {
          const badge = document.createElement('span');
          badge.className = ['badge', badgeValue.className].filter(Boolean).join(' ');
          badge.textContent = badgeValue.text;
          badges.appendChild(badge);
        }
        card.appendChild(badges);
      }

      const actions = document.createElement('div');
      actions.className = 'actions';
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'primary';
      open.textContent = label('open');
      open.addEventListener('click', () => post('openOfficial', { sessionId: session.sessionId }));
      const details = document.createElement('button');
      details.type = 'button';
      details.textContent = label('details');
      details.addEventListener('click', () => post('openDetails', { sessionId: session.sessionId }));
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.textContent = label('rename');
      rename.addEventListener('click', () => post('beginEdit', { sessionId: session.sessionId, field: 'alias' }));
      const projectTag = document.createElement('button');
      projectTag.type = 'button';
      projectTag.textContent = label('projectTag');
      projectTag.addEventListener('click', () => post('beginEdit', { sessionId: session.sessionId, field: 'projectTag' }));
      const note = document.createElement('button');
      note.type = 'button';
      note.textContent = label('note');
      note.addEventListener('click', () => post('beginEdit', { sessionId: session.sessionId, field: 'note' }));
      const archive = document.createElement('button');
      archive.type = 'button';
      archive.textContent = session.archived ? label('unarchive') : label('archive');
      archive.addEventListener('click', () => post('toggleArchive', { sessionId: session.sessionId }));
      actions.append(open, details, rename, projectTag, note, archive);
      if (session.archived) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = label('delete');
        deleteButton.addEventListener('click', () => post('deleteSession', { sessionId: session.sessionId }));
        actions.appendChild(deleteButton);
      }
      card.appendChild(actions);

      if (state?.editing?.sessionId === session.sessionId) {
        card.appendChild(renderEditBox(session, state.editing.field));
      }

      return card;
    }

    function render(nextState) {
      state = nextState;
      suppressSearchEvent = true;
      searchInput.placeholder = label('placeholder');
      searchInput.value = state.filter.searchTerm || '';
      suppressSearchEvent = false;

      scopeButton.textContent = state.filter.currentProjectOnly ? label('currentWorkspace') : label('allWorkspaces');
      archiveButton.textContent = state.filter.showArchived ? label('hideArchived') : label('showArchived');
      clearButton.textContent = label('clear');
      refreshButton.textContent = label('refresh');
      status.textContent = state.viewMessage || label('searchInPanel');

      const resultText = (state.filter.searchTerm ? label('filteredSummary') : label('resultSummary'))
        .replace('{visible}', String(state.totalVisible))
        .replace('{total}', String(state.fullCount));
      summary.textContent = resultText;

      list.replaceChildren();
      if (state.fullCount === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = label('noSessions');
        list.appendChild(empty);
        return;
      }
      if (state.sessions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = label('noMatches');
        list.appendChild(empty);
        return;
      }
      for (const session of state.sessions) {
        list.appendChild(renderSession(session));
      }
    }

    searchInput.addEventListener('input', () => {
      if (suppressSearchEvent) {
        return;
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        post('searchChanged', { value: searchInput.value });
      }, 120);
    });
    scopeButton.addEventListener('click', () => post('toggleCurrentProjectOnly'));
    archiveButton.addEventListener('click', () => post('toggleArchived'));
    clearButton.addEventListener('click', () => post('clearSearch'));
    refreshButton.addEventListener('click', () => post('refresh'));

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message?.type === 'render') {
        render(message.state);
      }
      if (message?.type === 'focusSearch') {
        searchInput.focus();
        searchInput.select();
      }
      if (message?.type === 'focusEditor') {
        requestAnimationFrame(() => {
          const editor = document.querySelector('[data-session-id="' + message.sessionId + '"][data-field="' + message.field + '"]');
          if (editor) {
            editor.focus();
            editor.select?.();
          }
        });
      }
    });

    post('ready');
  </script>
</body>
</html>`;
  }
}
