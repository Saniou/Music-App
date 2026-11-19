// Japanese lyrics to romaji (Hepburn), with kuroshiro + the kuromoji analyzer, in a Web Worker.
// Unpacking kuromoji's ~12 MB dictionary and building its index takes seconds of CPU; on the main
// thread that froze the page. The worker is made from a Blob and pulls the libraries' browser builds
// from jsDelivr with importScripts, so the bundler isn't involved (Turbopack copied a worker file
// instead of bundling it). Nothing loads until romaji is first wanted for a Japanese song, and the
// browser caches the downloads.
const CDN = "https://cdn.jsdelivr.net/npm";
const KUROSHIRO_URL = `${CDN}/kuroshiro@1.2.1/dist/kuroshiro.min.js`;
const ANALYZER_URL = `${CDN}/kuroshiro-analyzer-kuromoji@1.1.0/dist/kuroshiro-analyzer-kuromoji.min.js`;
const DICT_URL = `${CDN}/kuromoji@0.1.2/dict/`;

const KANA = /[぀-ヿ]/; // hiragana/katakana: Japanese, not just Chinese characters
const CJK = /[぀-ヿ㐀-鿿]/;

export const isJapanese = (texts) => texts.some((t) => KANA.test(t ?? ""));

// The worker: { id, texts } in, { id, result } or { id, error } out.
const WORKER_SOURCE = `
importScripts(${JSON.stringify(KUROSHIRO_URL)}, ${JSON.stringify(ANALYZER_URL)});
const Kuroshiro = self.Kuroshiro.default || self.Kuroshiro;
const Analyzer = self.KuromojiAnalyzer.default || self.KuromojiAnalyzer;
let ready = null;
function load() {
  if (!ready) {
    ready = (async () => {
      const k = new Kuroshiro();
      await k.init(new Analyzer({ dictPath: ${JSON.stringify(DICT_URL)} }));
      return k;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
self.onmessage = async ({ data: { id, texts } }) => {
  try {
    const k = await load();
    const result = [];
    for (const t of texts) {
      const r = await k.convert(t, { to: "romaji", mode: "spaced", romajiSystem: "hepburn" });
      result.push(r.replace(/\\s+/g, " ").trim());
    }
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: String((e && e.message) || e) });
  }
};
`;

let worker = null;
let nextId = 0;
const pending = new Map(); // id -> { resolve, reject }

function getWorker() {
  if (worker) return worker;
  worker = new Worker(URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" })));
  worker.onmessage = ({ data: { id, result, error } }) => {
    const p = pending.get(id);
    pending.delete(id);
    if (error) p?.reject(new Error(error));
    else p?.resolve(result);
  };
  worker.onerror = (e) => {
    // A crashed worker (e.g. the CDN unreachable) fails what's waiting; the next request starts fresh.
    for (const p of pending.values()) p.reject(e);
    pending.clear();
    worker.terminate();
    worker = null;
  };
  return worker;
}

const cache = new Map(); // text -> romaji

// Romaji for each text; text without Japanese characters comes back unchanged.
export async function toRomaji(texts) {
  const todo = [...new Set(texts.filter((t) => t && CJK.test(t) && !cache.has(t)))];
  if (todo.length) {
    const id = nextId++;
    const result = await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, texts: todo });
    });
    todo.forEach((t, i) => cache.set(t, result[i]));
  }
  return texts.map((t) => (t && CJK.test(t) ? cache.get(t) : t));
}
