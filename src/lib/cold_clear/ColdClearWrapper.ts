import { AiEngineId } from '../ai_engine';
import { CCAnalyzePositionMessage, CCInitMessage, WorkerMessage, WorkerResponse } from './types';

declare const __SOLD_SLEAR_ENABLED__: boolean;

// Worker の URL は webpack が静的に解析できるよう、エンジンごとにリテラルで書く。
// Sold Slear はビルドフラグが偽なら分岐ごと消え、Worker と WASM が出力されない。
const createEngineWorker = (engine: AiEngineId): Worker => {
    if (__SOLD_SLEAR_ENABLED__ && engine === 'soldSlear') {
        return new Worker(new URL('../sold_slear/sold_slear.worker.ts', import.meta.url));
    }
    return new Worker(new URL('./cold_clear.worker.ts', import.meta.url));
};

export class ColdClearWrapper {
    private worker: Worker | null = null;
    private onMessage: ((msg: WorkerResponse) => void) | null = null;

    constructor(readonly engine: AiEngineId = 'coldClear') {
    }

    // init を投げずに Worker だけ起こす。リプレイ解析は局面ごとに自己完結した
    // メッセージを送るため、モジュールスコープの bot を作らせない。
    open(onMessage: (msg: WorkerResponse) => void): void {
        // 再オープン時に前の Worker を残すと、thinkMs の同期探索が裏で走り続ける。
        this.terminate();
        this.onMessage = onMessage;
        this.worker = createEngineWorker(this.engine);
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
        this.worker.onmessageerror = () => {
            if (this.onMessage) {
                this.onMessage({ type: 'error', message: 'Failed to deserialize a worker message' });
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
