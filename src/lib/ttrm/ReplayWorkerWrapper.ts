import { ReplayWorkerRequest, ReplayWorkerResponse } from './types';

export class ReplayWorkerWrapper {
    private worker: Worker | null = null;
    private onMessage: ((msg: ReplayWorkerResponse) => void) | null = null;

    start(text: string, onMessage: (msg: ReplayWorkerResponse) => void): void {
        this.terminate();
        this.onMessage = onMessage;
        this.worker = new Worker(new URL('./replay.worker.ts', import.meta.url));
        this.worker.onmessage = (event: MessageEvent<ReplayWorkerResponse>) => {
            if (this.onMessage) {
                this.onMessage(event.data);
            }
        };
        this.worker.onerror = (error) => {
            if (this.onMessage) {
                this.onMessage({ type: 'error', stage: 'worker', message: String(error.message) });
            }
        };
        this.worker.postMessage({ text, type: 'parse' } as ReplayWorkerRequest);
    }

    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.onMessage = null;
    }
}
