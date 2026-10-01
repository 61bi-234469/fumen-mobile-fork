// ラベルが枠に収まるかを描画前に判定するための文字幅測定。
// フォントは端末ごとに異なるため、実際の font-family で canvas に測らせ、使えない環境だけ係数で見積もる。

export type MeasureText = (text: string, fontSizePx: number, fontWeight: number) => number;

const WIDE_CHAR_EM = 1;
const NARROW_CHAR_EM = .62;
const FALLBACK_FONT_FAMILY = 'sans-serif';

// i18next の初期化前は翻訳が undefined になるため、文字列以外は空文字として扱う
const normalizeText = (text: unknown): string => (typeof text === 'string' ? text : '');

export const estimateTextWidth: MeasureText = (rawText, fontSizePx) => {
    const text = normalizeText(rawText);
    let em = 0;
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        // サロゲートペアの後半は前半と合わせて1文字として数える
        if (code >= 0xdc00 && code <= 0xdfff) {
            continue;
        }
        em += code > 0xff ? WIDE_CHAR_EM : NARROW_CHAR_EM;
    }
    return em * fontSizePx;
};

const cache = new Map<string, number>();
// undefined は未取得、null は取得できない環境
let context: CanvasRenderingContext2D | null | undefined;
let fontLoadWatched = false;

// フォント指定が変わっても古い幅を返さないよう、font-family は毎回読み直してキャッシュのキーに含める
const resolveFontFamily = (): string => {
    try {
        const family = document.body ? getComputedStyle(document.body).fontFamily : '';
        if (family) {
            return family;
        }
    } catch (e) {
        // 取得できない環境では既定値で測る
    }
    return FALLBACK_FONT_FAMILY;
};

// 同じ font-family でも、読み込み完了の前後で実際の字形（幅）が変わりうる
const watchFontLoading = () => {
    if (fontLoadWatched) {
        return;
    }
    fontLoadWatched = true;
    const fonts = (document as Document & { fonts?: { addEventListener?: Function } }).fonts;
    if (fonts !== undefined && typeof fonts.addEventListener === 'function') {
        fonts.addEventListener('loadingdone', () => cache.clear());
    }
};

const resolveContext = (): CanvasRenderingContext2D | null => {
    if (context !== undefined) {
        return context;
    }
    try {
        context = document.createElement('canvas').getContext('2d');
    } catch (e) {
        context = null;
    }
    return context;
};

export const measureTextWidth: MeasureText = (rawText, fontSizePx, fontWeight) => {
    const text = normalizeText(rawText);
    if (typeof document === 'undefined') {
        return estimateTextWidth(text, fontSizePx, fontWeight);
    }
    watchFontLoading();
    const family = resolveFontFamily();
    const key = `${family}|${fontSizePx}|${fontWeight}|${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
        return cached;
    }
    let width = estimateTextWidth(text, fontSizePx, fontWeight);
    const ctx = resolveContext();
    if (ctx !== null) {
        try {
            ctx.font = `${fontWeight} ${fontSizePx}px ${family}`;
            const measured = ctx.measureText(text).width;
            if (Number.isFinite(measured) && (measured > 0 || text === '')) {
                width = measured;
            }
        } catch (e) {
            // 見積もり値のまま使う
        }
    }
    cache.set(key, width);
    return width;
};

export const resetTextMeasureForTest = () => {
    cache.clear();
    context = undefined;
    fontLoadWatched = false;
};
