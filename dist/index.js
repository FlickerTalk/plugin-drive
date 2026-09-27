// My drive for FlickerTalk (plan-drive, 2026-09-27): the user's files, sealed on the phone, in
// the user's own Google Drive. The core does the login, the sealing and the cloud; this frame is
// only the shelves: folders, files, what waits to go up. It never sees a byte of a file, a token
// or the recovery code.

import { t } from "./i18n.js";

/** Bytes as people read them. */
export function formatSize(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0).replace(/\.0$/, "")} ${units[unit]}`;
}

/** The icon of a file, by its kind. */
export function iconOf(mime) {
  const kind = String(mime ?? "").toLowerCase();
  if (kind.startsWith("image/")) return "image-outline";
  if (kind.startsWith("video/")) return "play-outline";
  if (kind.startsWith("audio/")) return "play-outline";
  if (kind === "application/pdf" || kind.startsWith("text/")) return "document-text-outline";
  return "document-text-outline";
}

/** The folders from the root down to `folder`, for the breadcrumb. */
export function trailOf(folders, folder) {
  const trail = [];
  let at = folder;
  let steps = 0;
  while (at && steps < 100) {
    const found = folders.get(at);
    if (!found) break;
    trail.unshift(found);
    at = found.parent;
    steps += 1;
  }
  return trail;
}

/** A moment as the phone writes it. */
export function whenLabel(at, lang = "en") {
  try {
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(at));
  } catch {
    return new Date(at).toDateString();
  }
}

const escape = (text) =>
  String(text).replace(/[&<>"']/g, (one) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[one]);

const STYLE = `
:host { display: block; font: 15px system-ui, sans-serif; color: #111; --paper: #fff; --line: #d8d8d8; --soft: #666; --accent: #e0562b; }
@media (prefers-color-scheme: dark) { :host { color: #f4f4f4; --paper: #111; --line: #3a3a3a; --soft: #aaa; } }
:host-context([data-dark]) { color: #f4f4f4; --paper: #111; --line: #3a3a3a; --soft: #aaa; }
* { box-sizing: border-box; }
.bar { display: flex; gap: 6px; align-items: center; padding: 4px 0 10px; flex-wrap: wrap; }
.grow { flex: 1; }
button {
  appearance: none; border: 1px solid currentColor; background: transparent; color: inherit;
  border-radius: 10px; min-width: 44px; height: 40px; font: inherit; padding: 0 10px; cursor: pointer; opacity: .8;
}
button.on { opacity: 1; box-shadow: inset 0 0 0 2px currentColor; }
button.text { min-width: 0; }
button.danger { color: var(--accent); }
button:disabled { opacity: .3; }
.i { display: block; width: 22px; height: 22px; margin: auto; background: currentColor; -webkit-mask: var(--i) center/contain no-repeat; mask: var(--i) center/contain no-repeat; }
.i.small { width: 18px; height: 18px; display: inline-block; vertical-align: -4px; margin: 0 6px 0 0; }
input { font: inherit; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; width: 100%; }
ul { list-style: none; margin: 0; padding: 0; }
li { display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--line); }
li .open { flex: 1; text-align: start; border: 0; border-radius: 0; height: auto; padding: 10px 4px; opacity: 1; min-width: 0; }
.title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { color: var(--soft); font-size: 13px; margin-top: 2px; }
.meta.warn { color: var(--accent); }
.trail { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 14px; color: var(--soft); margin: 0 0 8px; }
.trail button { height: 30px; min-width: 0; border: 0; padding: 0 4px; }
.empty { color: var(--soft); text-align: center; padding: 40px 0; }
.hint { color: var(--soft); font-size: 13px; margin: 4px 0; }
.warn { color: var(--accent); margin: 8px 0; }
.card { text-align: center; padding: 30px 0; }
.card .big { width: 56px; height: 56px; margin: 0 auto 12px; }
.code { display: block; padding: 12px; border-radius: 10px; background: var(--line); font: 17px monospace; letter-spacing: 1px; margin: 12px 0; user-select: all; word-break: break-all; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.row { display: flex; gap: 6px; margin: 8px 0; }
`;

const icon = (name) => `<i class="i" style="--i:url(./icon/${name}.svg)"></i>`;
const smallIcon = (name) => `<i class="i small" style="--i:url(./icon/${name}.svg)"></i>`;
const button = (act, label, name, extra = "") => `<button data-act="${act}" aria-label="${escape(label)}" ${extra}>${icon(name)}</button>`;

/** The plugin's view: the shelves of the drive, or the way to a drive when there is none yet. */
class Drive extends HTMLElement {
  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.lang = "en";
    this.status = null;
    this.granted = true;
    this.folder = null;
    this.folders = new Map();
    this.listing = { folders: [], files: [], pending: [] };
    this.selected = null;
    this.handed = null;
    this.code = "";
    this.warning = "";
    this.notice = "";
    this.working = false;
    this.canSend = false;
  }

  connectedCallback() {
    this.root.innerHTML = `<style>${STYLE}</style><div class="view"></div>`;
    this.view = this.root.querySelector(".view");
    this.root.addEventListener("click", (event) => this.onClick(event));
    this.root.addEventListener("keydown", (event) => this.onKey(event));
    globalThis.ft?.onOpen?.((opening) => this.onOpen(opening));
    this.paint();
  }

  async onOpen(opening) {
    this.lang = opening.lang || "en";
    this.handed = opening.file && opening.file.name ? { name: opening.file.name, mime: opening.file.mime, ref: opening.ref } : null;
    this.canSend = Boolean(opening.ref) || Boolean(opening.live) || true;
    await this.refresh();
  }

  /** Asks the core where the drive stands and, when it is open, what the folder holds. */
  async refresh() {
    const status = await globalThis.ft.drive.status();
    if (status === false) {
      this.granted = false;
      this.status = null;
      return this.paint();
    }
    this.granted = true;
    this.status = status;
    if (status.state === "ready") await this.load();
    this.paint();
  }

  async load() {
    const listing = await globalThis.ft.drive.list(this.folder);
    if (listing === false) {
      this.warning = t(this.lang, "failed");
      return;
    }
    this.listing = listing;
    for (const folder of listing.folders) this.folders.set(folder.id, folder);
  }

  /** Runs one step, showing that it works and, honestly, when it did not. */
  async step(work) {
    this.working = true;
    this.warning = "";
    this.notice = "";
    this.paint();
    try {
      const outcome = await work();
      if (outcome === false) this.warning = t(this.lang, "failed");
    } catch (error) {
      this.warning = `${t(this.lang, "failed")}: ${error}`;
    }
    this.working = false;
    await this.refresh();
  }

  async onClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const { act, id } = button.dataset;
    const T = (key, holes) => t(this.lang, key, holes);
    const drive = globalThis.ft.drive;
    switch (act) {
      case "close":
        return globalThis.ft.close();
      case "connect":
        return this.step(() => drive.connect("google"));
      case "setup":
        return this.step(async () => {
          const code = await drive.setup();
          if (code === false) return false;
          this.code = code;
          return true;
        });
      case "codeDone":
        this.code = "";
        return this.paint();
      case "unlock": {
        const typed = this.view.querySelector('input[name="code"]')?.value ?? "";
        return this.step(() => drive.unlock(typed));
      }
      case "go":
        this.folder = id || null;
        this.selected = null;
        return this.step(async () => true);
      case "openFolder":
        this.folder = id;
        this.selected = null;
        return this.step(async () => true);
      case "select":
        this.selected = this.selected === id ? null : id;
        return this.paint();
      case "mkdir": {
        const name = prompt(T("folderName"), "");
        if (!name) return;
        return this.step(() => drive.mkdir(name, this.folder));
      }
      case "upload":
        return this.step(async () => {
          const went = await drive.upload(this.folder);
          if (went === false) return false;
          if (went > 0) this.notice = T("kept");
          return true;
        });
      case "keep":
        return this.step(async () => {
          const kept = await drive.keep(this.folder);
          if (kept) {
            this.notice = T("kept");
            this.handed = null;
          }
          return kept;
        });
      case "open":
        return this.step(() => drive.open(id));
      case "save":
        return this.step(() => drive.save(id));
      case "send":
        return this.step(() => drive.send(id));
      case "rename": {
        const current = this.listing.files.find((one) => one.id === id) ?? this.listing.folders.find((one) => one.id === id);
        const name = prompt(T("name"), current?.name ?? "");
        if (!name) return;
        return this.step(() => drive.rename(id, name));
      }
      case "remove": {
        const current = this.listing.files.find((one) => one.id === id) ?? this.listing.folders.find((one) => one.id === id);
        if (!confirm(T("confirmRemove", { name: current?.name ?? "" }))) return;
        this.selected = null;
        return this.step(() => drive.remove(id));
      }
      case "retry":
        return this.step(() => drive.retry());
      case "cancel":
        return this.step(() => drive.cancel(id));
      default:
    }
  }

  onKey(event) {
    if (event.key === "Enter" && event.target.name === "code") this.onClick({ target: this.view.querySelector('[data-act="unlock"]') });
  }

  paint() {
    const T = (key, holes) => t(this.lang, key, holes);
    if (!this.granted) {
      this.view.innerHTML = `<div class="bar">${button("close", T("close"), "close-outline")}</div><p class="warn">${escape(T("notGranted"))}</p>`;
      return;
    }
    const state = this.status?.state ?? "none";
    if (this.code) return this.paintCard("key-outline", T("codeTitle"), `<code class="code" data-code>${escape(this.code)}</code><p class="hint">${escape(T("codeHint"))}</p>`, button("codeDone", T("codeDone"), "checkmark-outline", 'class="on"'));
    if (state === "none") return this.paintCard("cloud-outline", T("none"), `<p class="hint">${escape(T("noneHint"))}</p>`, `<button data-act="connect" class="text on" ${this.working ? "disabled" : ""}>${escape(T("connectGoogle"))}</button>`);
    if (state === "empty") return this.paintCard("cloud-upload-outline", T("emptyDrive"), "", `<button data-act="setup" class="text on" ${this.working ? "disabled" : ""}>${escape(T("setUp"))}</button>`);
    if (state === "locked") {
      return this.paintCard(
        "lock-closed-outline",
        T("locked"),
        `<div class="row"><input name="code" placeholder="${escape(T("codePlaceholder"))}" aria-label="${escape(T("codePlaceholder"))}" autocapitalize="characters"><button data-act="unlock" class="text on" ${this.working ? "disabled" : ""}>${escape(T("unlock"))}</button></div>`,
        "",
      );
    }
    this.paintShelves();
  }

  paintCard(name, title, body, action) {
    const T = (key) => t(this.lang, key);
    this.view.innerHTML = `
      <div class="bar">${button("close", T("close"), "close-outline")}<span class="grow"></span></div>
      <div class="card">
        <i class="i big" style="--i:url(./icon/${name}.svg)"></i>
        <p class="title">${escape(title)}</p>
        ${body}
        ${action}
        ${this.warning ? `<p class="warn" role="alert">${escape(this.warning)}</p>` : ""}
        <p class="hint">${escape(T("sees"))}</p>
      </div>`;
  }

  paintShelves() {
    const T = (key, holes) => t(this.lang, key, holes);
    const trail = trailOf(this.folders, this.folder);
    const crumbs = [`<button data-act="go" data-id="">${escape(T("root"))}</button>`]
      .concat(trail.map((folder) => `<span>›</span><button data-act="go" data-id="${escape(folder.id)}">${escape(folder.name)}</button>`))
      .join("");
    const handed = this.handed
      ? `<div class="actions"><button data-act="keep" class="text on" ${this.working ? "disabled" : ""}>${smallIcon("cloud-upload-outline")}${escape(T("keep", { name: this.handed.name }))}</button></div>`
      : "";
    const folders = this.listing.folders
      .map(
        (folder) => `<li>
          <button class="open" data-act="openFolder" data-id="${escape(folder.id)}"><div class="title">${smallIcon("folder-outline")}${escape(folder.name)}</div></button>
          ${button("rename", T("rename"), "text-outline", `data-id="${escape(folder.id)}"`)}
          ${button("remove", T("remove"), "trash-outline", `data-id="${escape(folder.id)}" class="danger"`)}
        </li>`,
      )
      .join("");
    const files = this.listing.files
      .map((file) => {
        const chosen = this.selected === file.id;
        const actions = chosen
          ? `<div class="actions">
              ${button("open", T("open"), "eye-outline", `data-id="${escape(file.id)}"`)}
              ${button("save", T("save"), "download-outline", `data-id="${escape(file.id)}"`)}
              ${button("send", T("send"), "send-outline", `data-id="${escape(file.id)}"`)}
              ${button("rename", T("rename"), "text-outline", `data-id="${escape(file.id)}"`)}
              <span class="grow"></span>
              ${button("remove", T("remove"), "trash-outline", `data-id="${escape(file.id)}" class="danger"`)}
            </div>`
          : "";
        return `<li style="flex-wrap:wrap">
          <button class="open ${chosen ? "on" : ""}" data-act="select" data-id="${escape(file.id)}">
            <div class="title">${smallIcon(iconOf(file.mime))}${escape(file.name)}</div>
            <div class="meta">${escape(formatSize(file.size))} · ${escape(whenLabel(file.modified, this.lang))}</div>
          </button>
          ${actions}
        </li>`;
      })
      .join("");
    const pending = this.listing.pending
      .map(
        (one) => `<li>
          <div class="open"><div class="title">${smallIcon("time-outline")}${escape(one.name)}</div><div class="meta warn">${escape(T("pending"))} · ${escape(one.error)}</div></div>
          ${button("retry", T("retry"), "refresh-outline", `data-id="${escape(one.blob)}"`)}
          ${button("cancel", T("cancel"), "close-outline", `data-id="${escape(one.blob)}" class="danger"`)}
        </li>`,
      )
      .join("");
    const rows = folders + files + pending;
    const drive = this.status?.drive;
    const usage = drive
      ? drive.quota
        ? T("quota", { used: formatSize(drive.quota.used), total: formatSize(drive.quota.total) })
        : T("used", { size: formatSize(drive.used) })
      : "";
    this.view.innerHTML = `
      <div class="bar">
        ${button("close", T("close"), "close-outline")}
        <span class="grow"></span>
        ${button("mkdir", T("newFolder"), "folder-open-outline", this.working ? "disabled" : "")}
        ${button("upload", T("upload"), "cloud-upload-outline", `class="on" ${this.working ? "disabled" : ""}`)}
      </div>
      <nav class="trail" aria-label="${escape(T("root"))}">${crumbs}</nav>
      ${handed}
      ${rows ? `<ul>${rows}</ul>` : `<p class="empty">${escape(T("empty"))}</p>`}
      ${this.notice ? `<p class="hint" role="status">${escape(this.notice)}</p>` : ""}
      ${this.warning ? `<p class="warn" role="alert">${escape(this.warning)}</p>` : ""}
      <p class="hint">${escape(usage)}${this.working ? ` · ${escape(T("working"))}` : ""}</p>`;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("ft-drive")) customElements.define("ft-drive", Drive);
