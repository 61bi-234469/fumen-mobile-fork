import { GarbageEvent, PlayerRoundIR } from './types';

// P3 §3-2「ガベージ parcel とゲージ恒等式」。
//
// 1 回の攻撃（iid）を 1 つの parcel として扱い、その一生（受信 → 相殺 / 被弾）を記録する。
// ゲージ量は記録済みイベント列だけから再構成できる（V-02 で 2,844 検査点 / 不一致 0）ため、
// エンジンの再実行も lock ごとのスナップショットも要らない。
//
// timeline.ts と同じく、IR にも state にも依存しない純関数だけを置く。

export interface GarbageResolution {
    frame: number;
    kind: 'tank' | 'cancel';
    amount: number;
    column?: number;   // tank のみ。実際に穴が開いた列（0 始まり）
    size?: number;     // 穴幅
}

export interface GarbageParcel {
    iid: number;
    receivedFrame: number;
    amount: number;        // 受信時にキューへ入った行数（passthrough 相殺後）
    gameid?: number;       // confirm から。FR-45 用
    senderFrame?: number;  // 送信側クロックでの生成フレーム（V-01 で共通軸と実証済み）
    resolutions: GarbageResolution[];   // frame 昇順
}

export interface PendingParcel {
    iid: number;
    receivedFrame: number;
    remaining: number;
}

// 「次にせり上がる行」。保留中 parcel からの予測ではなく、実際にせり上がった tank
// をそのまま読む（§3-2 の警告: 予告は後知恵であり、UI 側でその旨を明示する）。
export interface RiseRow {
    frame: number;
    column: number;
    size: number;
    rows: number;
}

export interface KillerGarbage {
    frame: number;      // 着弾フレーム（自陣クロック）
    amount: number;
    column: number;
    senderFrame?: number;   // 相手の攻撃フレーム。共通軸なので相手の手番へ写せる
    gameid?: number;
}

export interface GaugePoint {
    frame: number;
    gauge: number;
}

export interface GarbageTimeline {
    parcels: GarbageParcel[];                 // receivedFrame 昇順
    gaugePoints: GaugePoint[];                // 昇順・イベント直後の値
    tanks: GarbageResolution[];               // frame 昇順（予告の先読み用）
    events: GarbageEvent[];                   // frame 昇順（直近イベント用。confirm は含まない）
    maxGauge: number;                         // バーのスケール決定用
    killer?: KillerGarbage;
}

// 既定の garbagecap。バーの満尺と「超過ぶんの色替え」の境目に使う。
export const DEFAULT_GARBAGE_CAP = 8;

export const garbageCapOf = (player: PlayerRoundIR): number => {
    const cap = player.resolvedOptions.garbagecap;
    return typeof cap === 'number' && 0 < cap ? cap : DEFAULT_GARBAGE_CAP;
};

// クロックは 20Hz で回る。プレイヤーラウンド 1 つにつき派生表現は 1 回だけ組み、
// WeakMap に載せる。IR を捨てれば自動的に解放される（replay_board.ts と同じ流儀）。
const timelineCache = new WeakMap<PlayerRoundIR, GarbageTimeline>();

const buildTimeline = (player: PlayerRoundIR): GarbageTimeline => {
    const events: GarbageEvent[] = [];
    const gaugePoints: GaugePoint[] = [];
    const tanks: GarbageResolution[] = [];
    const parcels: GarbageParcel[] = [];
    const byIid = new Map<number, GarbageParcel>();
    // tank から parcel を引くための対応（死因の送信元表示に使う）
    const tankIids: number[] = [];

    let gauge = 0;
    let maxGauge = 0;

    for (const event of player.garbageEvents) {
        if (event.kind === 'confirm') {
            const parcel = byIid.get(event.iid);
            if (parcel !== undefined) {
                parcel.gameid = event.gameid;
                parcel.senderFrame = event.senderFrame;
            } else {
                // confirm が receive より先に届く順序でも取りこぼさない
                const created: GarbageParcel = {
                    iid: event.iid,
                    receivedFrame: event.frame,
                    amount: 0,
                    gameid: event.gameid,
                    senderFrame: event.senderFrame,
                    resolutions: [],
                };
                byIid.set(event.iid, created);
                parcels.push(created);
            }
            continue;
        }

        events.push(event);

        if (event.kind === 'receive') {
            gauge += event.amount;
            const parcel = byIid.get(event.iid);
            if (parcel === undefined) {
                const created: GarbageParcel = {
                    iid: event.iid,
                    receivedFrame: event.frame,
                    amount: event.amount,
                    resolutions: [],
                };
                byIid.set(event.iid, created);
                parcels.push(created);
            } else {
                parcel.receivedFrame = parcel.amount === 0 ? event.frame : parcel.receivedFrame;
                parcel.amount += event.amount;
            }
        } else {
            gauge -= event.amount;
            const resolution: GarbageResolution = {
                frame: event.frame,
                kind: event.kind,
                amount: event.amount,
                column: event.column,
                size: event.size,
            };
            const parcel = byIid.get(event.iid);
            if (parcel !== undefined) {
                parcel.resolutions.push(resolution);
            }
            if (event.kind === 'tank') {
                tanks.push(resolution);
                tankIids.push(event.iid);
            }
        }

        gaugePoints.push({ gauge, frame: event.frame });
        if (maxGauge < gauge) {
            maxGauge = gauge;
        }
    }

    // confirm が先に来た parcel は receivedFrame があとから確定するので、最後に整列する
    parcels.sort((a, b) => a.receivedFrame - b.receivedFrame);

    const timeline: GarbageTimeline = { parcels, gaugePoints, tanks, events, maxGauge };
    timeline.killer = findKiller(player, tanks, tankIids, byIid);
    return timeline;
};

// FR-45。最後の tank が最後の設置以降に着弾していれば、それが死因。
// 設置で詰んだ（topout）場合はどの攻撃も死因ではないので undefined を返す。
const findKiller = (
    player: PlayerRoundIR,
    tanks: GarbageResolution[],
    tankIids: number[],
    byIid: Map<number, GarbageParcel>,
): KillerGarbage | undefined => {
    if (player.terminal.reason === 'winner') {
        return undefined;
    }
    const last = tanks[tanks.length - 1];
    if (last === undefined || last.column === undefined) {
        return undefined;
    }
    const lastLock = player.locks[player.locks.length - 1];
    if (lastLock !== undefined && last.frame < lastLock.frame) {
        return undefined;
    }
    const parcel = byIid.get(tankIids[tankIids.length - 1]);
    return {
        frame: last.frame,
        amount: last.amount,
        column: last.column,
        senderFrame: parcel !== undefined ? parcel.senderFrame : undefined,
        gameid: parcel !== undefined ? parcel.gameid : undefined,
    };
};

export const getGarbageTimeline = (player: PlayerRoundIR): GarbageTimeline => {
    const cached = timelineCache.get(player);
    if (cached !== undefined) {
        return cached;
    }
    const built = buildTimeline(player);
    timelineCache.set(player, built);
    return built;
};

// frame <= f を満たす最後の要素の位置。無ければ -1。timeline.ts の indexAtFrame と同じ流儀。
const lastIndexAtFrame = (frames: { frame: number }[], frame: number): number => {
    if (frames.length === 0 || frame < frames[0].frame) {
        return -1;
    }
    let lo = 0;
    let hi = frames.length;
    while (lo + 1 < hi) {
        const mid = (lo + hi) >>> 1;
        if (frames[mid].frame <= frame) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return lo;
};

// FR-40。任意フレームのゲージ量（未確定ガベージの行数）。
export const gaugeAtFrame = (timeline: GarbageTimeline, frame: number): number => {
    const index = lastIndexAtFrame(timeline.gaugePoints, frame);
    return index < 0 ? 0 : timeline.gaugePoints[index].gauge;
};

// frame 時点で被弾済みの累計行数（FR-26 の「エンジン基準で自己整合する値」）。
export const tankedAtFrame = (timeline: GarbageTimeline, frame: number): number => {
    let total = 0;
    for (const tank of timeline.tanks) {
        if (frame < tank.frame) {
            break;
        }
        total += tank.amount;
    }
    return total;
};

// FR-41。受信済みかつ未解決の parcel を receivedFrame 昇順で返す。
export const pendingParcelsAt = (timeline: GarbageTimeline, frame: number): PendingParcel[] => {
    const pending: PendingParcel[] = [];
    for (const parcel of timeline.parcels) {
        if (frame < parcel.receivedFrame) {
            continue;
        }
        const resolved = parcel.resolutions
            .filter(resolution => resolution.frame <= frame)
            .reduce((sum, resolution) => sum + resolution.amount, 0);
        const remaining = parcel.amount - resolved;
        if (0 < remaining) {
            pending.push({ remaining, iid: parcel.iid, receivedFrame: parcel.receivedFrame });
        }
    }
    return pending;
};

// FR-42 / 43。frame より後の tank を時刻順に、maxRows 行ぶんまで返す。
export const riseForecastAt = (
    timeline: GarbageTimeline, frame: number, maxRows: number,
): RiseRow[] => {
    const rows: RiseRow[] = [];
    let counted = 0;
    for (const tank of timeline.tanks) {
        if (tank.frame <= frame) {
            continue;
        }
        if (maxRows <= counted) {
            break;
        }
        rows.push({
            frame: tank.frame,
            column: tank.column ?? 0,
            size: tank.size !== undefined && 0 < tank.size ? tank.size : 1,
            rows: tank.amount,
        });
        counted += tank.amount;
    }
    return rows;
};

// FR-41。直近の受信 / 相殺 / 被弾。confirm は表示対象ではないので events に入っていない。
export const recentEventAt = (
    timeline: GarbageTimeline, frame: number,
): GarbageEvent | undefined => {
    const index = lastIndexAtFrame(timeline.events, frame);
    return index < 0 ? undefined : timeline.events[index];
};

// FR-45。勝者と「設置で詰んだ」ラウンドでは undefined。
export const killerGarbageOf = (player: PlayerRoundIR): KillerGarbage | undefined =>
    getGarbageTimeline(player).killer;

// 画面が 1 プレイヤーぶんで必要とするガベージ表現。1 フレームにつき 1 回だけ引く。
export interface ReplayGarbageView {
    gauge: number;
    cap: number;
    maxGauge: number;
    // Reserved rises in application order. The gauge uses these amounts as boundaries.
    rises: RiseRow[];
    // 次にせり上がる 1 行（実測）。ゲージが 0 の地点では出さない。
    rise?: RiseRow;
    // 予告 1 行を除いた残りの保留行数（FR-43）
    moreRows: number;
    recent?: GarbageEvent;
}

export const garbageViewAt = (player: PlayerRoundIR, frame: number): ReplayGarbageView => {
    const timeline = getGarbageTimeline(player);
    const gauge = gaugeAtFrame(timeline, frame);
    // 予告は「その後に実際にせり上がった行」なので、いま保留が無い地点では出さない。
    // FR-54 の切り出し条件（ゲージ 0 なら従来どおり）と同じ判定に揃えている。
    const rises = 0 < gauge ? riseForecastAt(timeline, frame, gauge) : [];
    const rise = rises[0];
    return {
        gauge,
        rise,
        rises,
        cap: garbageCapOf(player),
        maxGauge: timeline.maxGauge,
        moreRows: Math.max(0, gauge - 1),
        recent: recentEventAt(timeline, frame),
    };
};
