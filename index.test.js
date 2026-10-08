// The plugin's own tests (Plan §53, plan-drive §6): the shelves against a fake core. The plugin
// only asks; the fake core is the drive.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatSize, iconOf, trailOf, whenLabel } from "./dist/index.js";
import { LANGUAGES, catalogueOf, t } from "./dist/i18n.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the manifest", () => {
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "module.json"), "utf8"));

  it("names the drive in each of the app's languages with its own title, and sums it up within the schema's limits", () => {
    const languages = ["es", "pt", "fr", "de", "it", "ro", "ru", "uk", "pl", "tr", "ar", "hi", "bn", "id", "vi", "th", "ja", "ko", "zh-CN", "zh-TW"];
    const length = (text) => [...text].length; // the schema counts code points, not UTF-16 units
    expect(Object.keys(manifest.locales ?? {})).toEqual(languages);
    for (const lang of languages) {
      const { name, summary, ...rest } = manifest.locales[lang];
      expect(rest, lang).toEqual({});
      expect(LANGUAGES, lang).toContain(lang);
      expect(name, lang).toBe(catalogueOf(lang).title);
      expect(length(name), lang).toBeLessThanOrEqual(64);
      expect(summary.trim(), lang).not.toBe("");
      expect(length(summary), lang).toBeLessThanOrEqual(200);
    }
  });

  it("keeps English at the top level, with the plugin's own English title", () => {
    expect(manifest.name).toBe(catalogueOf("en").title);
    expect(manifest.summary).toBe("Your files, sealed on the phone, in your own Google Drive.");
  });

  it("names the Ionicon the Apps grid shows for it", () => {
    expect(manifest.icon).toBe("cloud-outline");
  });
});

describe("the little helpers", () => {
  it("writes sizes, picks icons and walks the trail of folders", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(999)).toBe("999 B");
    expect(formatSize(2_500_000)).toBe("2.5 MB");
    expect(formatSize(1000)).toBe("1 KB");
    expect(formatSize(12_000_000_000)).toBe("12 GB");
    expect(iconOf("image/png")).toBe("image-outline");
    expect(iconOf("video/mp4")).toBe("play-outline");
    expect(iconOf("application/pdf")).toBe("document-text-outline");
    expect(iconOf(undefined)).toBe("document-text-outline");
    const folders = new Map([
      ["a", { id: "a", name: "A", parent: null }],
      ["b", { id: "b", name: "B", parent: "a" }],
      ["c", { id: "c", name: "C", parent: "b" }],
    ]);
    expect(trailOf(folders, "c").map((one) => one.name)).toEqual(["A", "B", "C"]);
    expect(trailOf(folders, null)).toEqual([]);
    expect(trailOf(folders, "nowhere")).toEqual([]);
    expect(whenLabel(new Date(2026, 8, 27).getTime(), "en")).toContain("2026");
  });

  it("speaks the 21 languages of the app, with the same keys, and fills the holes", () => {
    expect(LANGUAGES).toHaveLength(21);
    const keys = Object.keys(catalogueOf("en")).sort();
    for (const lang of LANGUAGES) expect(Object.keys(catalogueOf(lang)).sort(), lang).toEqual(keys);
    expect(t("es", "keep", { name: "tax.pdf" })).toBe("Guardar tax.pdf en el drive");
    expect(t("xx", "open")).toBe("Open");
    expect(t("en", "quota", { used: "1 MB" })).toBe("1 MB of {total} used in your cloud");
  });
});

/** A fake core: the drive in memory, moving through its states as the plugin asks. */
function fakeCore(state = "none") {
  const drive = { files: 0, folders: 0, used: 0, pending: 0, quota: { used: 500, total: 1000 }, backupAt: null };
  const status = { state, provider: state === "none" ? null : "google", drive: state === "ready" ? drive : null, problem: null };
  const folders = [];
  const files = [];
  const pending = [];
  const handlers = [];
  let granted = true;
  const guard = (answer) => (granted ? answer : false);
  return {
    status,
    folders,
    files,
    pending,
    deny: () => {
      granted = false;
    },
    open: (opening) => Promise.all(handlers.map((handler) => handler({ text: "", dark: false, lang: "en", file: null, ref: null, reminder: null, live: false, ...opening }))),
    ft: {
      onOpen: (handler) => handlers.push(handler),
      close: vi.fn(),
      drive: {
        status: vi.fn(async () => guard({ ...status, drive: status.drive ? { ...status.drive, files: files.length, folders: folders.length, pending: pending.length } : null })),
        connect: vi.fn(async () => {
          Object.assign(status, { state: "empty", provider: "google" });
          return guard({ ...status });
        }),
        setup: vi.fn(async () => {
          Object.assign(status, { state: "ready", drive });
          return guard("ABCDE-FGHJK-MNPQR-STVWX-YZ012-34567");
        }),
        unlock: vi.fn(async (code) => {
          if (code !== "GOOD") return false;
          Object.assign(status, { state: "ready", drive });
          return true;
        }),
        disconnect: vi.fn(async () => true),
        list: vi.fn(async (parent) =>
          guard({
            folders: folders.filter((one) => one.parent === parent),
            files: files.filter((one) => one.parent === parent),
            pending: pending.filter((one) => one.parent === parent),
          }),
        ),
        mkdir: vi.fn(async (name, parent) => {
          const id = `f${folders.length + 1}`;
          folders.push({ id, name, parent, modified: 1 });
          return id;
        }),
        rename: vi.fn(async (id, name) => {
          const one = files.find((file) => file.id === id) ?? folders.find((folder) => folder.id === id);
          if (one) one.name = name;
          return Boolean(one);
        }),
        move: vi.fn(async () => true),
        remove: vi.fn(async (id) => {
          const at = files.findIndex((file) => file.id === id);
          if (at >= 0) files.splice(at, 1);
          return at >= 0;
        }),
        upload: vi.fn(async (parent) => {
          files.push({ id: `x${files.length + 1}`, name: "picked.jpg", parent, size: 1234, mime: "image/jpeg", modified: 1 });
          return 1;
        }),
        keep: vi.fn(async (parent) => {
          files.push({ id: `x${files.length + 1}`, name: "from-chat.pdf", parent, size: 99, mime: "application/pdf", modified: 1 });
          return true;
        }),
        open: vi.fn(async () => true),
        save: vi.fn(async () => true),
        send: vi.fn(async () => true),
        retry: vi.fn(async () => {
          pending.splice(0);
          return 0;
        }),
        cancel: vi.fn(async (blob) => {
          const at = pending.findIndex((one) => one.blob === blob);
          if (at >= 0) pending.splice(at, 1);
          return true;
        }),
        backup: vi.fn(),
        backupInfo: vi.fn(),
        restore: vi.fn(),
      },
    },
  };
}

describe("the plugin", () => {
  let core;
  let element;
  const inside = () => element.shadowRoot;
  const press = async (act, extra = "") => {
    const button = inside().querySelector(`[data-act="${act}"]${extra}`);
    if (!button) throw new Error(`no button ${act}${extra}`);
    button.click();
    await tick();
    await tick();
    await tick();
  };
  const mountWith = async (state, opening = {}) => {
    core = fakeCore(state);
    globalThis.ft = core.ft;
    document.body.innerHTML = "";
    element = document.createElement("ft-drive");
    document.body.append(element);
    await core.open(opening);
    await tick();
  };

  beforeEach(() => {
    globalThis.confirm = () => true;
    globalThis.prompt = () => "Docs";
  });

  // The recovery phrase (2026-09-28) is typed only in the app's Settings → Backup: the plugin
  // connects the cloud, but setting the drive up or opening one from another phone is done there.
  it("connects the cloud and sends the user to Settings to set the drive up", async () => {
    await mountWith("none");
    expect(inside().textContent).toContain("No cloud connected");
    await press("connect");
    expect(core.ft.drive.connect).toHaveBeenCalledWith("google");
    expect(inside().textContent).toContain("has no FlickerTalk drive yet");
    expect(inside().textContent).toContain("Settings → Backup");
    expect(inside().querySelector('[data-act="setup"]')).toBeNull();
    expect(core.ft.drive.setup).not.toHaveBeenCalled();
  });

  it("asks for no phrase for a drive from another phone: that is for Settings too", async () => {
    for (const state of ["locked", "outdated"]) {
      await mountWith(state);
      expect(inside().textContent).toContain("Settings → Backup");
      expect(inside().querySelector("input")).toBeNull();
      expect(inside().querySelector('[data-act="unlock"]')).toBeNull();
    }
    expect(core.ft.drive.unlock).not.toHaveBeenCalled();
  });

  it("makes folders, uploads into them, walks the trail and acts on a file", async () => {
    await mountWith("ready", { lang: "es" });
    await press("mkdir");
    expect(core.ft.drive.mkdir).toHaveBeenCalledWith("Docs", null);
    expect(inside().textContent).toContain("Docs");
    await press("openFolder", '[data-id="f1"]');
    expect(core.ft.drive.list).toHaveBeenLastCalledWith("f1");
    expect(inside().querySelector(".trail").textContent).toContain("Mi drive");
    expect(inside().querySelector(".trail").textContent).toContain("Docs");

    await press("upload");
    expect(core.ft.drive.upload).toHaveBeenCalledWith("f1");
    expect(inside().textContent).toContain("picked.jpg");
    expect(inside().textContent).toContain("1.2 KB");
    expect(inside().querySelector("[role='status']").textContent).toBe("Guardado en el drive");

    // The file stays chosen from one action to the next.
    await press("select", '[data-id="x1"]');
    await press("send", '[data-id="x1"]');
    expect(core.ft.drive.send).toHaveBeenCalledWith("x1");
    await press("open", '[data-id="x1"]');
    expect(core.ft.drive.open).toHaveBeenCalledWith("x1");
    globalThis.prompt = () => "renamed.jpg";
    await press("rename", '[data-id="x1"]');
    expect(inside().textContent).toContain("renamed.jpg");
    await press("remove", '[data-id="x1"]');
    expect(core.ft.drive.remove).toHaveBeenCalledWith("x1");
    expect(inside().textContent).not.toContain("renamed.jpg");

    await press("go", '[data-id=""]');
    expect(core.ft.drive.list).toHaveBeenLastCalledWith(null);
    expect(inside().textContent).toContain("500 B de 1 KB");
  });

  it("keeps the file it was opened with, by its ref and never its bytes", async () => {
    await mountWith("ready", { file: { name: "tax.pdf", mime: "application/pdf", data: "" }, ref: "ref_1" });
    expect(inside().textContent).toContain("Keep tax.pdf in the drive");
    await press("keep");
    expect(core.ft.drive.keep).toHaveBeenCalledWith(null);
    expect(inside().textContent).toContain("from-chat.pdf");
    expect(inside().textContent).not.toContain("Keep tax.pdf in the drive");
  });

  it("shows what waits for the network, with the reason, and lets it be tried again or dropped", async () => {
    await mountWith("ready");
    core.pending.push({ blob: "b1", name: "big.mp4", parent: null, size: 5, mime: "video/mp4", error: "the cloud is out of reach" });
    await press("go", '[data-id=""]');
    expect(inside().textContent).toContain("big.mp4");
    expect(inside().textContent).toContain("out of reach");
    await press("cancel", '[data-id="b1"]');
    expect(core.ft.drive.cancel).toHaveBeenCalledWith("b1");
    expect(inside().textContent).not.toContain("big.mp4");
  });

  it("says when it was not allowed the drive", async () => {
    core = fakeCore("ready");
    core.deny();
    globalThis.ft = core.ft;
    document.body.innerHTML = "";
    element = document.createElement("ft-drive");
    document.body.append(element);
    await core.open({});
    await tick();
    expect(inside().textContent).toContain("not allowed to use the drive");
    await press("close");
    expect(core.ft.close).toHaveBeenCalled();
  });
});
