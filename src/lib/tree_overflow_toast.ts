import { i18n } from '../locales/keys';
import { Page } from './fumen/types';
import { isTreeCommentOverLimit } from './fumen/tree_utils';

declare const M: any;

const TOAST_DISPLAY_LENGTH = 8000;

// 自動保存は編集のたびに走るため、上限を超えた瞬間に1回だけ知らせる。
// 上限内へ戻ったら再び警告できるようにする。
let warned = false;

export const warnIfTreeCommentOverLimit = (pages: Page[]): boolean => {
    const over = isTreeCommentOverLimit(pages);
    if (!over) {
        warned = false;
        return false;
    }
    if (!warned) {
        warned = true;
        if (typeof M !== 'undefined') {
            M.toast({
                html: i18n.TreeView.TreeDataTooLarge(),
                classes: 'top-toast',
                displayLength: TOAST_DISPLAY_LENGTH,
            });
        }
    }
    return true;
};

export const resetTreeOverflowWarningForTesting = () => {
    warned = false;
};
