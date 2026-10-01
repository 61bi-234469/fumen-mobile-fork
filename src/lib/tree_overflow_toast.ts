import { i18n } from '../locales/keys';
import { Page } from './fumen/types';
import { isTreeCommentOverLimit } from './fumen/tree_utils';
import { showToast } from './toast';

const TOAST_DISPLAY_LENGTH = 8000;

// 自動保存は編集のたびに走るため、上限を超えた瞬間に1回だけ知らせる。
// 上限内へ戻ったら再び警告できるようにする。URLコピーなど明示的な書き出しは毎回知らせる。
let warned = false;

export const warnIfTreeCommentOverLimit = (pages: Page[], { everyTime = false } = {}): boolean => {
    const over = isTreeCommentOverLimit(pages);
    if (!over) {
        warned = false;
        return false;
    }
    if (!warned || everyTime) {
        warned = true;
        showToast(i18n.TreeView.TreeDataTooLarge(), TOAST_DISPLAY_LENGTH);
    }
    return true;
};

export const resetTreeOverflowWarningForTesting = () => {
    warned = false;
};
