import type { Page } from './fumen/types';
import { cloneInputReplayContext } from './input_replay';

// Same-position copies and history snapshots must not share mutable working data.
export const clonePageInternal = (internal: Page['internal']): Page['internal'] => (
    internal === undefined ? undefined : {
        sevenBagGrayProgress: internal.sevenBagGrayProgress === undefined
            ? undefined : { ...internal.sevenBagGrayProgress },
        sevenBagGrayDisplay: internal.sevenBagGrayDisplay === undefined ? undefined : {
            pieces: internal.sevenBagGrayDisplay.pieces.slice(),
            rowMap: internal.sevenBagGrayDisplay.rowMap.slice(),
        },
        sevenBagGrayWorkspace: internal.sevenBagGrayWorkspace,
        inputReplayContext: internal.inputReplayContext === undefined
            ? undefined : cloneInputReplayContext(internal.inputReplayContext),
    }
);
