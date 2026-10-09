// My drive for FlickerTalk (plan-drive, 2026-09-27): the user's files, sealed on the phone, in
// the user's own Google Drive. The core does the login, the sealing and the cloud; this frame is
// only the shelves: folders, files, what waits to go up. It never sees a byte of a file, a token
// or the recovery phrase: the drive is set up and opened only in the app's Settings (2026-09-28).

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

// Ionic draws the window (the app lends it to the frame, app 1.6.0): header, toolbar, buttons and
// the scrolling content. This is only what is the drive's own, with the app's colours through
// Ionic's variables.
const STYLE = `
ft-drive { display: flex; flex-direction: column; height: 100%; font: 15px system-ui, sans-serif; color: var(--ion-text-color, #111); --paper: var(--ion-background-color, #fff); --line: var(--ion-border-color, #d8d8d8); --soft: var(--ion-color-medium, #666); --accent: var(--ion-color-danger, #e0562b); }
@media (prefers-color-scheme: dark) { ft-drive { color: var(--ion-text-color, #f4f4f4); --paper: var(--ion-background-color, #111); --line: var(--ion-border-color, #3a3a3a); --soft: var(--ion-color-medium, #aaa); } }
[data-dark] ft-drive { color: var(--ion-text-color, #f4f4f4); --paper: var(--ion-background-color, #111); --line: var(--ion-border-color, #3a3a3a); --soft: var(--ion-color-medium, #aaa); }
ft-drive * { box-sizing: border-box; }
ft-drive ion-content { flex: 1; }
ft-drive .view { padding: 0 8px 16px; }
ft-drive .grow { flex: 1; }
ft-drive button {
  appearance: none; border: 1px solid currentColor; background: transparent; color: inherit;
  border-radius: 10px; min-width: 44px; height: 40px; font: inherit; padding: 0 10px; cursor: pointer; opacity: .8;
}
ft-drive button.on { opacity: 1; box-shadow: inset 0 0 0 2px currentColor; }
ft-drive .i { display: block; width: 22px; height: 22px; margin: auto; background: currentColor; -webkit-mask: var(--i) center/contain no-repeat; mask: var(--i) center/contain no-repeat; }
ft-drive .i.small { width: 18px; height: 18px; display: inline-block; vertical-align: -4px; margin: 0 6px 0 0; }
ft-drive ul { list-style: none; margin: 0; padding: 0; }
ft-drive li { display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--line); }
ft-drive li .open { flex: 1; text-align: start; border: 0; border-radius: 0; height: auto; padding: 10px 4px; opacity: 1; min-width: 0; }
ft-drive .title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
ft-drive .meta { color: var(--soft); font-size: 13px; margin-top: 2px; }
ft-drive .meta.warn { color: var(--accent); }
ft-drive .trail { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 14px; color: var(--soft); margin: 8px 0; }
ft-drive .trail button { height: 30px; min-width: 0; border: 0; padding: 0 4px; }
ft-drive .empty { color: var(--soft); text-align: center; padding: 40px 0; }
ft-drive .hint { color: var(--soft); font-size: 13px; margin: 4px 0; }
ft-drive .warn { color: var(--accent); margin: 8px 0; }
ft-drive .card { text-align: center; padding: 30px 0; }
ft-drive .card .big { width: 56px; height: 56px; margin: 0 auto 12px; }
ft-drive .actions { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--line); width: 100%; }
`;

/** An Ionicon in a button: Ionic's own `ion-icon` when the app lent it by name, else the one the
 *  app serves at `./icon/<name>.svg`, painted in the button's colour. */
const icon = (name, slot = "icon-only") =>
  globalThis.Ionicons?.map?.has(name)
    ? `<ion-icon slot="${slot}" name="${name}" aria-hidden="true"></ion-icon>`
    : `<i slot="${slot}" class="i" style="--i:url(./icon/${name}.svg)" aria-hidden="true"></i>`;
const smallIcon = (name) => `<i class="i small" style="--i:url(./icon/${name}.svg)" aria-hidden="true"></i>`;
/** An Ionic button with an icon only. */
const button = (act, label, name, extra = "") =>
  `<ion-button ${/\bfill=/.test(extra) ? "" : 'fill="clear"'} data-act="${act}" aria-label="${escape(label)}" ${extra}>${icon(name)}</ion-button>`;

/** The plugin's view: the shelves of the drive, or the way to a drive when there is none yet. */
class Drive extends HTMLElement {
  constructor() {
    super();
    this.lang = "en";
    this.status = null;
    this.granted = true;
    this.folder = null;
    this.folders = new Map();
    this.listing = { folders: [], files: [], pending: [] };
    this.selected = null;
    this.handed = null;
    this.warning = "";
    this.notice = "";
    this.working = false;
    this.canSend = false;
  }

  connectedCallback() {
    // In the page, not in a shadow root: the frame holds only this plugin, and Ionic's global
    // styles do not cross a shadow boundary. Each screen is its own header and content.
    this.view = this;
    this.addEventListener("click", (event) => this.onClick(event));
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

  /** Asks in the app's Ionic alert: the frame has no browser dialogs. Resolves {role, data}. */
  async ask(options) {
    const alerts = globalThis.ftIonic?.alertController;
    if (!alerts) return { role: "cancel" };
    const alert = await alerts.create(options);
    await alert.present();
    return alert.onDidDismiss();
  }

  /** A name, asked in an alert with one field: what was typed, or nothing if the user backed out. */
  async askName(header, placeholder, value, T) {
    const { role, data } = await this.ask({
      header,
      inputs: [{ name: "name", value, placeholder, attributes: { "aria-label": placeholder } }],
      buttons: [
        { text: T("cancel"), role: "cancel" },
        { text: header, role: "confirm" },
      ],
    });
    return role === "confirm" ? String(data?.values?.name ?? "").trim() : "";
  }

  async onClick(event) {
    const button = event.target.closest("button, ion-button");
    if (!button) return;
    const { act, id } = button.dataset;
    const T = (key, holes) => t(this.lang, key, holes);
    const drive = globalThis.ft.drive;
    switch (act) {
      case "connect":
        return this.step(() => drive.connect("google"));
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
        const name = await this.askName(T("newFolder"), T("folderName"), "", T);
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
        const name = await this.askName(T("rename"), T("name"), current?.name ?? "", T);
        if (!name) return;
        return this.step(() => drive.rename(id, name));
      }
      case "remove": {
        const current = this.listing.files.find((one) => one.id === id) ?? this.listing.folders.find((one) => one.id === id);
        const { role } = await this.ask({
          message: T("confirmRemove", { name: current?.name ?? "" }),
          buttons: [
            { text: T("cancel"), role: "cancel" },
            { text: T("remove"), role: "destructive" },
          ],
        });
        if (role !== "destructive") return;
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

  paint() {
    const T = (key, holes) => t(this.lang, key, holes);
    if (!this.granted) {
      this.view.innerHTML = `<style>${STYLE}</style><ion-content><div class="view"><p class="warn">${escape(T("notGranted"))}</p></div></ion-content>`;
      return;
    }
    const state = this.status?.state ?? "none";
    if (state === "none") return this.paintCard("cloud-outline", T("none"), `<p class="hint">${escape(T("noneHint"))}</p>`, `<ion-button data-act="connect" ${this.working ? "disabled" : ""}>${escape(T("connectGoogle"))}</ion-button>`);
    // The recovery phrase is only ever typed in Settings → Backup: never in this frame.
    if (state === "empty" || state === "outdated") return this.paintCard("cloud-upload-outline", T("emptyDrive"), `<p class="hint">${escape(T("inSettings"))}</p>`, "");
    if (state === "locked") return this.paintCard("lock-closed-outline", T("locked"), `<p class="hint">${escape(T("inSettings"))}</p>`, "");
    this.paintShelves();
  }

  paintCard(name, title, body, action) {
    const T = (key) => t(this.lang, key);
    // No bar: the name and the way out are the app's tool window.
    this.view.innerHTML = `<style>${STYLE}</style>
      <ion-content><div class="view">
      <div class="card">
        <i class="i big" style="--i:url(./icon/${name}.svg)"></i>
        <p class="title">${escape(title)}</p>
        ${body}
        ${action}
        ${this.warning ? `<p class="warn" role="alert">${escape(this.warning)}</p>` : ""}
        <p class="hint">${escape(T("sees"))}</p>
      </div>
      </div></ion-content>`;
  }

  paintShelves() {
    const T = (key, holes) => t(this.lang, key, holes);
    const trail = trailOf(this.folders, this.folder);
    const crumbs = [`<button data-act="go" data-id="">${escape(T("root"))}</button>`]
      .concat(trail.map((folder) => `<span>›</span><button data-act="go" data-id="${escape(folder.id)}">${escape(folder.name)}</button>`))
      .join("");
    const handed = this.handed
      ? `<div class="actions"><ion-button data-act="keep" ${this.working ? "disabled" : ""}>${icon("cloud-upload-outline", "start")}${escape(T("keep", { name: this.handed.name }))}</ion-button></div>`
      : "";
    const folders = this.listing.folders
      .map(
        (folder) => `<li>
          <button class="open" data-act="openFolder" data-id="${escape(folder.id)}"><div class="title">${smallIcon("folder-outline")}${escape(folder.name)}</div></button>
          ${button("rename", T("rename"), "text-outline", `data-id="${escape(folder.id)}"`)}
          ${button("remove", T("remove"), "trash-outline", `data-id="${escape(folder.id)}" color="danger"`)}
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
              ${button("remove", T("remove"), "trash-outline", `data-id="${escape(file.id)}" color="danger"`)}
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
          ${button("cancel", T("cancel"), "close-outline", `data-id="${escape(one.blob)}" color="danger"`)}
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
    this.view.innerHTML = `<style>${STYLE}</style>
      <ion-header><ion-toolbar><ion-buttons slot="end">
        ${button("mkdir", T("newFolder"), "folder-open-outline", this.working ? "disabled" : "")}
        ${button("upload", T("upload"), "cloud-upload-outline", `fill="solid" ${this.working ? "disabled" : ""}`)}
      </ion-buttons></ion-toolbar></ion-header>
      <ion-content><div class="view">
      <nav class="trail" aria-label="${escape(T("root"))}">${crumbs}</nav>
      ${handed}
      ${rows ? `<ul>${rows}</ul>` : `<p class="empty">${escape(T("empty"))}</p>`}
      ${this.notice ? `<p class="hint" role="status">${escape(this.notice)}</p>` : ""}
      ${this.warning ? `<p class="warn" role="alert">${escape(this.warning)}</p>` : ""}
      <p class="hint">${escape(usage)}${this.working ? ` · ${escape(T("working"))}` : ""}</p>
      </div></ion-content>`;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("ft-drive")) customElements.define("ft-drive", Drive);
