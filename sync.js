// 雲端同步：資料先在裝置上用同步密碼加密（PBKDF2 → AES-GCM），再存到使用者自己的 GitHub Gist
const Sync = {
  KEY: "invest-helper-sync-v1",
  FILE: "invest-helper.enc.json",
  DESC: "投資助手同步資料（已加密）",
  cfg() { try { return JSON.parse(localStorage.getItem(Sync.KEY)) || {}; } catch (e) { return {}; } },
  setCfg(c) { try { localStorage.setItem(Sync.KEY, JSON.stringify(c)); } catch (e) {} },
  on() { const c = Sync.cfg(); return !!(c.token && c.pass); },

  b64(buf) { let s = ""; new Uint8Array(buf).forEach(b => s += String.fromCharCode(b)); return btoa(s); },
  unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },
  async keyFrom(pass, salt) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  },
  async encrypt(obj, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await Sync.keyFrom(pass, salt);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
    return { v: 1, updatedAt: obj.updatedAt || 0, salt: Sync.b64(salt), iv: Sync.b64(iv), data: Sync.b64(ct) };
  },
  async decrypt(env, pass) {
    const key = await Sync.keyFrom(pass, Sync.unb64(env.salt));
    try {
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Sync.unb64(env.iv) }, key, Sync.unb64(env.data));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) { throw new Error("同步密碼不對，解不開雲端資料"); }
  },

  async api(path, opt = {}) {
    const r = await fetch("https://api.github.com" + path, {
      ...opt,
      headers: { Authorization: "Bearer " + Sync.cfg().token, Accept: "application/vnd.github+json", "Content-Type": "application/json" }
    });
    if (r.status === 401) throw new Error("GitHub token 無效或已過期");
    if (!r.ok) throw new Error("GitHub 回應錯誤 " + r.status);
    return r.json();
  },
  async findGist() {
    const c = Sync.cfg();
    if (c.gistId) return c.gistId;
    const list = await Sync.api("/gists?per_page=100");
    const g = list.find(x => x.files && x.files[Sync.FILE]);
    if (g) { c.gistId = g.id; Sync.setCfg(c); return g.id; }
    return null;
  },
  async pull() {
    const id = await Sync.findGist();
    if (!id) return null;
    const g = await Sync.api("/gists/" + id);
    const f = g.files[Sync.FILE];
    if (!f) return null;
    const raw = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    return Sync.decrypt(JSON.parse(raw), Sync.cfg().pass);
  },
  async push(state) {
    const c = Sync.cfg();
    const data = structuredClone(state);
    data.settings.apiKey = "";
    const content = JSON.stringify(await Sync.encrypt(data, c.pass));
    const id = await Sync.findGist();
    if (id) await Sync.api("/gists/" + id, { method: "PATCH", body: JSON.stringify({ files: { [Sync.FILE]: { content } } }) });
    else {
      const g = await Sync.api("/gists", { method: "POST", body: JSON.stringify({ description: Sync.DESC, public: false, files: { [Sync.FILE]: { content } } }) });
      c.gistId = g.id; Sync.setCfg(c);
    }
    c.last = Date.now(); Sync.setCfg(c);
  }
};
