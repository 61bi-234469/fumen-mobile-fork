import { CCAnalyzePositionMessage, CCInitMessage, WorkerMessage, WorkerResponse } from './types';

export class ColdClearWrapper {
    private worker: Worker | null = null;
    private onMessage: ((msg: WorkerResponse) => void) | null = null;

    // init を投げずに Worker だけ起こす。リプレイ解析は局面ごとに自己完結した
    // メッセージを送るため、モジュールスコープの bot を作らせない。
    open(onMessage: (msg: WorkerResponse) => void): void {
        this.onMessage = onMessage;
        this.worker = new Worker(new URL('./cold_clear.worker.ts', import.meta.url));
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            if (this.onMessage) {
                this.onMessage(event.data);
            }
        };
        this.worker.onerror = (error) => {
            if (this.onMessage) {
                this.onMessage({ type: 'error', message: String(error.message) });
            }
        };
    }

    start(initMsg: CCInitMessage, onMessage: (msg: WorkerResponse) => void): void {
        this.open(onMessage);
        if (this.worker) {
            this.worker.postMessage(initMsg);
        }
    }

    analyzePosition(msg: CCAnalyzePositionMessage): void {
        if (this.worker) {
            this.worker.postMessage(msg as WorkerMessage);
        }
    }

    requestMove(incoming?: number): void {
        if (this.worker) {
            this.worker.postMessage({ incoming, type: 'requestMove' } as WorkerMessage);
        }
    }

    requestTopMoves(count: number, incoming?: number): void {
        if (this.worker) {
            this.worker.postMessage({ count, incoming, type: 'requestTopMoves' } as WorkerMessage);
        }
    }

    requestSequence(count: number, incoming?: number): void {
        if (this.worker) {
            this.worker.postMessage({ count, incoming, type: 'requestSequence' } as WorkerMessage);
        }
    }

    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.onMessage = null;
    }
}
