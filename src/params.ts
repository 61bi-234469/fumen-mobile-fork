export interface Query {
    get: (name: string) => string | undefined;
}

export const getURLQuery = (): Query => {
    // Query文字列を取得
    let search = '';
    if (location.search !== '') {
        search = location.search.substr(1);
    } else {
        const hash = location.hash;
        const index = hash.indexOf('?');
        if (index !== -1) {
            search = hash.substr(index + 1);
        }
    }

    return parseQuery(search);
};

// 壊れたエスケープ（チャットで途中切れした共有URLの `%2` など）で起動が止まらないよう、
// デコードに失敗した値は生のまま返す。
const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

// 値の中の `%26` を区切りとして扱わないよう、分割してから値ごとにデコードする。
export const parseQuery = (search: string): Query => {
    const array = search.split('&');
    return {
        get: (name: string): string | undefined => {
            const data = array.find(value => value.indexOf('=') !== -1
                && safeDecode(value.substr(0, value.indexOf('='))) === name);
            if (data === undefined) {
                return undefined;
            }
            return safeDecode(data.substr(data.indexOf('=') + 1));
        },
    };
};
