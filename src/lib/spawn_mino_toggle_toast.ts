import { i18n } from '../locales/keys';

// アクション層からDOMを直接触らないよう、M.toast の呼び出しをこのモジュールへ閉じ込める。
// src/lib/ には gif_export / thumbnail など既にDOMを扱うモジュールがあるため、
// actions → views の新しい依存を作らずに済むこの場所へ置く。

declare const M: any;

const TOAST_DISPLAY_LENGTH = 3000;

/**
 * SPAWNミノ⇄ペイント変換で「見た目以外の意味」が変わったときの事後通知。
 *
 * 変換そのものはブロックしない。確認ダイアログを出さない代わりに、
 * lockによるライン消去・以降ページへの波及・QuizのNEXT消費が実際に変わったときだけ
 * 1回だけトーストを出す。通常ケース（lock=true・ライン非完成・非Quiz）では何も出さない。
 */
export interface SpawnMinoToggleEffects {
    lineClearLost: boolean;
    persistsToLaterPages: boolean;
    quizConsumptionChanged: boolean;
}

export const hasSpawnMinoToggleEffect = (effects: SpawnMinoToggleEffects): boolean => (
    effects.lineClearLost || effects.persistsToLaterPages || effects.quizConsumptionChanged
);

export const showSpawnMinoToggleToast = (effects: SpawnMinoToggleEffects) => {
    const messages: string[] = [];
    if (effects.lineClearLost) {
        messages.push(i18n.EditorUi.SpawnMinoToggle.LineClearLost());
    }
    if (effects.persistsToLaterPages) {
        messages.push(i18n.EditorUi.SpawnMinoToggle.PersistsToLaterPages());
    }
    if (effects.quizConsumptionChanged) {
        messages.push(i18n.EditorUi.SpawnMinoToggle.QuizConsumptionChanged());
    }
    if (messages.length === 0) {
        return;
    }

    const toast = M.toast({
        html: '<span class="spawn-mino-toggle-toast-message"></span>',
        classes: 'spawn-mino-toggle-toast',
        displayLength: TOAST_DISPLAY_LENGTH,
    });
    const messageElement = toast.el.querySelector('.spawn-mino-toggle-toast-message');
    if (messageElement) {
        // textContent (not innerHTML) so no markup is ever injected
        messageElement.textContent = messages.join(' / ');
    }
};
