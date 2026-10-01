// navigator.clipboard を優先し、使えない・拒否された環境では選択範囲 + execCommand にフォールバックする。
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall back to the legacy selection API below.
        }
    }

    const element = document.createElement('pre');
    element.style.position = 'fixed';
    element.style.left = '-100%';
    element.textContent = text;
    document.body.appendChild(element);

    try {
        const selection = typeof document.getSelection === 'function'
            ? document.getSelection()
            : window.getSelection();
        if (!selection || typeof document.execCommand !== 'function') {
            return false;
        }
        selection.selectAllChildren(element);
        return document.execCommand('copy');
    } finally {
        document.body.removeChild(element);
    }
};
