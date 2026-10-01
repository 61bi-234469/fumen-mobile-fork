// AI エンジンの識別子と、エンジンごとに UI・探索入力を切り替えるための能力表。
// Sold Slear は開発版のため、ビルドフラグで無効なビルド（本番）では選べない。

declare const __SOLD_SLEAR_ENABLED__: boolean;

export type AiEngineId = 'coldClear' | 'soldSlear';

export const AI_ENGINE_DEFAULT: AiEngineId = 'coldClear';

export const isSoldSlearAvailable = (): boolean => (
    typeof __SOLD_SLEAR_ENABLED__ !== 'undefined' && __SOLD_SLEAR_ENABLED__
);

export const availableAiEngines = (): AiEngineId[] => (
    isSoldSlearAvailable() ? ['coldClear', 'soldSlear'] : ['coldClear']
);

export const isAiEngineId = (value: unknown): value is AiEngineId => (
    value === 'coldClear' || value === 'soldSlear'
);

// 保存値が無効・未知、またはこのビルドで使えないエンジンなら既定へ戻す。
export const resolveAiEngine = (value: unknown): AiEngineId => (
    isAiEngineId(value) && availableAiEngines().includes(value) ? value : AI_ENGINE_DEFAULT
);

export const nextAiEngine = (engine: AiEngineId): AiEngineId => {
    const engines = availableAiEngines();
    const index = engines.indexOf(engine);
    return engines[(index + 1) % engines.length];
};

export interface AiEngineCapabilities {
    // HOLD 使用可否・先読み推測・重みプリセットの設定を持つか（持たない項目は UI に出さない）
    holdToggle: boolean;
    speculateToggle: boolean;
    weightsPreset: boolean;
    maxTopBranches: number;
    // current に加えて最低限必要な NEXT の個数
    minNext: number;
    // 置いたミノ評価・リプレイ解析で照合する候補数の上限
    candidateLimit: number;
    // 探索が b2b / combo を返すか。返さないエンジンはアプリ側で連鎖状態を進める
    reportsChain: boolean;
}

export const SOLD_SLEAR_CANDIDATE_LIMIT = 16;

const CAPABILITIES: Record<AiEngineId, AiEngineCapabilities> = {
    coldClear: {
        holdToggle: true,
        speculateToggle: true,
        weightsPreset: true,
        maxTopBranches: 20,
        minNext: 0,
        candidateLimit: 5000,
        reportsChain: true,
    },
    soldSlear: {
        holdToggle: false,
        speculateToggle: false,
        weightsPreset: false,
        maxTopBranches: SOLD_SLEAR_CANDIDATE_LIMIT,
        minNext: 1,
        candidateLimit: SOLD_SLEAR_CANDIDATE_LIMIT,
        reportsChain: false,
    },
};

export const aiEngineCapabilities = (engine: AiEngineId): AiEngineCapabilities => CAPABILITIES[engine];
