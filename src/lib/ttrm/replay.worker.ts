import { parseTtrm, TtrmError } from './parser';
import { buildReplayIR, nowMs } from './simulator';
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
        // NFR-02: JSON パースからシミュレーションまでの実測を meta.parseMs に載せる。
        const startedAt = nowMs();
        const file = parseTtrm(msg.text);
        postResponse({ type: 'ir', ir: buildReplayIR(file, startedAt) });
    } catch (e) {
        postResponse({
            type: 'error',
            stage: e instanceof TtrmError ? e.stage : 'unexpected',
            message: e instanceof Error ? e.message : String(e),
        });
    }
};
