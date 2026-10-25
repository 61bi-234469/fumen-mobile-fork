import { localStorageWrapper } from '../memento';

// URLの d= を丸ごと保存すると容量を食うため、同じURLかどうかを照合できる短いキーにする
export const toUrlFumenKey = (fumen: string): string => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < fumen.length; i += 1) {
        hash ^= fumen.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return `${fumen.length}:${(hash >>> 0).toString(16)}`;
};

export interface StartupFumen {
    fumen: string;
    restored: boolean;
    pageIndex?: number;
    sourceUrlKey?: string;
}

// URLの d= で開いて編集したタブが同じURLで開き直されたとき（再読み込み・タブの復元）は、
// URLの元データではなく、そこから編集した保存データを復元する。
// 新しいタブで同じURLを開いたときは、共有されたとおりの元データを開く。
export const chooseStartupFumen = ({ urlFumen, storedFumen, storedSourceUrlKey, storedPageIndex, tabSourceUrlKey }: {
    urlFumen: string | undefined,
    storedFumen: string | undefined,
    storedSourceUrlKey: string | undefined,
    storedPageIndex: number | undefined,
    tabSourceUrlKey: string | undefined,
}): StartupFumen | undefined => {
    if (urlFumen !== undefined) {
        const sourceUrlKey = toUrlFumenKey(urlFumen);
        if (storedFumen && storedSourceUrlKey === sourceUrlKey && tabSourceUrlKey === sourceUrlKey) {
            return { sourceUrlKey, fumen: storedFumen, restored: true, pageIndex: storedPageIndex };
        }
        return { sourceUrlKey, fumen: urlFumen, restored: false };
    }

    if (storedFumen) {
        return {
            fumen: storedFumen,
            restored: true,
            pageIndex: storedPageIndex,
            sourceUrlKey: storedSourceUrlKey,
        };
    }

    return undefined;
};

// sessionStorage はタブごとに分かれ、再読み込みやタブの復元では残るため、
// 「このタブがどのURLの d= を開いたか」の記録に使う
const TAB_SOURCE_KEY = 'url-source@1';

export const loadTabSourceUrlKey = (): string | undefined => {
    try {
        return sessionStorage.getItem(TAB_SOURCE_KEY) ?? undefined;
    } catch {
        return undefined;
    }
};

export const saveTabSourceUrlKey = (sourceUrlKey: string | undefined): void => {
    try {
        if (sourceUrlKey !== undefined) {
            sessionStorage.setItem(TAB_SOURCE_KEY, sourceUrlKey);
        } else {
            sessionStorage.removeItem(TAB_SOURCE_KEY);
        }
    } catch {
        // サイトデータをブロックしたブラウザでは、同じURLを開き直しても元データを開くだけになる
    }
};

let lastPageIndex: number | undefined;

// ページ移動のたびに呼ばれるため、変わったときだけ書き込む
export const rememberPageIndex = (index: number): void => {
    if (lastPageIndex === index) {
        return;
    }
    lastPageIndex = index;
    localStorageWrapper.savePageIndex(index);
};
