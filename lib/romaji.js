// Japanese lyrics to romaji (Hepburn) with kuroshiro + the kuromoji analyzer. The analyzer's
// dictionary is ~12 MB, so nothing loads until romaji is actually wanted for a Japanese song; it
// comes from jsDelivr (CORS-enabled) and the browser caches it, instead of living in our bundle.
const DICT_URL = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/";
const KANA = /[぀-ヿ]/; // hiragana/katakana: Japanese, not just Chinese characters
const CJK = /[぀-ヿ㐀-鿿]/;

export const isJapanese = (texts) => texts.some((t) => KANA.test(t ?? ""));

let converter = null;
function load() {
  converter ??= (async () => {
    const [{ default: K }, { default: A }] = await Promise.all([import("kuroshiro"), import("kuroshiro-analyzer-kuromoji")]);
    const Kuroshiro = K.default ?? K; // CommonJS packages: the class may sit one level down
    const Analyzer = A.default ?? A;
    const k = new Kuroshiro();
    await k.init(new Analyzer({ dictPath: DICT_URL }));
    return k;
  })().catch((e) => {
    converter = null; // let a later attempt retry (e.g. after a network blip)
    throw e;
  });
  return converter;
}

const cache = new Map(); // text -> romaji

// Romaji for each text; text without Japanese characters comes back unchanged.
export async function toRomaji(texts) {
  const k = await load();
  return Promise.all(
    texts.map(async (t) => {
      if (!t || !CJK.test(t)) return t;
      if (!cache.has(t)) {
        const r = await k.convert(t, { to: "romaji", mode: "spaced", romajiSystem: "hepburn" });
        cache.set(t, r.replace(/\s+/g, " ").trim());
      }
      return cache.get(t);
    })
  );
}
