import { parseTtrm, TtrmError } from './parser';
import { buildReplayIR } from './simulator';
import { ReplayWorkerRequest, ReplayWorkerResponse } from './types';

const postResponse = (msg: ReplayWorkerResponse) => {
    (self as any).postMessage(msg);
};

(self as any).onmessage = (event: MessageEvent<ReplayWorkerRequest>) => {
    const msg = event.data;
    if (msg.type !== 'parse') {
        return;
    }
    try {
        const file = parseTtrm(msg.text);
        postResponse({ type: 'ir', ir: buildReplayIR(file) });
    } catch (e) {
        postResponse({
            type: 'error',
            stage: e instanceof TtrmError ? e.stage : 'unexpected',
            message: e instanceof Error ? e.message : String(e),
        });
    }
};
