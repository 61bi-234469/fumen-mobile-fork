import { Actions } from '../actions';
import { Screens } from '../lib/enums';
import { State } from '../states';
import { isAnyModalOpen } from './shortcuts';

const isTtrmFileName = (name: string): boolean => /\.ttrm$/i.test(name);

// ブラウザ外から運ばれたファイルだけを扱う。List のページ並べ替えなど、
// アプリ内のドラッグは types に Files を持たないので素通しする。
const carriesFiles = (e: DragEvent): boolean => {
    return e.dataTransfer !== null && Array.from(e.dataTransfer.types).includes('Files');
};

// Replay 画面ではファイル選択と同じく拡張子を問わない（.json の書き出しも読める）。
// それ以外の画面では .ttrm だけを拾い、そのまま Replay 画面へ移って読み込む。
export const pickDroppedReplayFile = (
    files: ArrayLike<File>, screen: Screens,
): File | undefined => {
    const list = Array.from(files);
    if (screen === Screens.Replay) {
        return list[0];
    }
    return list.find(file => isTtrmFileName(file.name));
};

export const initReplayFileDrop = (
    stateGetter: () => State,
    actionsGetter: () => Actions,
) => {
    // ページ内の <img> を掴んだドラッグも、Chrome では画像そのものが Files として載る。
    // dragstart はページ内から始まったドラッグでしか起きないので、その間のドロップは
    // ファイルの取り込みとして扱わない（盤面などの PNG を JSON として読んでしまう）。
    let draggingFromPage = false;
    window.addEventListener('dragstart', (e: DragEvent) => {
        // 取り消されたドラッグは始まらず、dragend も来ない
        draggingFromPage = !e.defaultPrevented;
    });
    window.addEventListener('dragend', () => {
        draggingFromPage = false;
    });
    window.addEventListener('dragover', (e: DragEvent) => {
        if (!carriesFiles(e)) {
            return;
        }
        // 既定動作のままだとブラウザがファイルを開いて編集中の内容を失う
        e.preventDefault();
    });
    window.addEventListener('drop', (e: DragEvent) => {
        if (!carriesFiles(e) || e.dataTransfer === null) {
            return;
        }
        e.preventDefault();
        if (draggingFromPage) {
            draggingFromPage = false;
            return;
        }
        const state = stateGetter();
        if (isAnyModalOpen(state)) {
            return;
        }
        const file = pickDroppedReplayFile(e.dataTransfer.files, state.mode.screen);
        if (file === undefined) {
            return;
        }
        const actions = actionsGetter();
        if (state.mode.screen !== Screens.Replay) {
            actions.openReplayScreen();
        }
        actions.importTtrmFile({ file });
    });
};
