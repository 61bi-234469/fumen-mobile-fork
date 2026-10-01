declare const M: any;

const escapeHtml = (text: string): string => String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// M.toast は html を解釈するため、エラー文言やクリップボード由来の文字列はエスケープしてから渡す。
export const showToast = (message: string, displayLength: number = 1500): void => {
    if (typeof M === 'undefined') {
        return;
    }
    M.toast({ displayLength, html: escapeHtml(message), classes: 'top-toast' });
};
