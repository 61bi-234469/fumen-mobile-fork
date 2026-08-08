import { getGarbageTimeline } from '../../lib/ttrm/garbage';
import { PlayerRoundIR } from '../../lib/ttrm/types';

// P3 §3-5 / §4-4。タイムライン直下に敷くガベージマーカーの帯。
// 被弾（tank）を赤、相殺（cancel）を緑で描く。受信は描かない ―― 受信は必ず
// 被弾か相殺のどちらかに解決されるので、3 色にすると密度が上がるだけになる。
//
// 素直に SVG / div の並びで描くと 20Hz のクロックごとに数十ノードの差分計算が
// 走るため、canvas → data URL にして WeakMap でメモ化する（replay_board.ts と同じ流儀）。
// 再生中はキーが変わらないので img の src も変わらない。

export const MARKER_BAND_HEIGHT = 6;

const TANK_COLOR = '#e53935';
const CANCEL_COLOR = '#43a047';
const MARKER_WIDTH = 2;
const RENDER_SCALE = 2;

interface MarkerMemo {
    width: number;
    endFrame: number;
    url: string;
}

const markerMemo = new WeakMap<PlayerRoundIR, MarkerMemo>();

export const renderReplayTimelineMarkers = (
    player: PlayerRoundIR, width: number, endFrame: number,
): string => {
    const memo = markerMemo.get(player);
    if (memo !== undefined && memo.width === width && memo.endFrame === endFrame) {
        return memo.url;
    }

    const url = drawMarkers(player, width, endFrame);
    if (url !== '') {
        markerMemo.set(player, { width, endFrame, url });
    }
    return url;
};

const drawMarkers = (player: PlayerRoundIR, width: number, endFrame: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * RENDER_SCALE));
    canvas.height = MARKER_BAND_HEIGHT * RENDER_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }
    ctx.scale(RENDER_SCALE, RENDER_SCALE);

    const span = Math.max(1, endFrame);
    for (const event of getGarbageTimeline(player).events) {
        if (event.kind === 'receive') {
            continue;
        }
        const x = Math.min(width - MARKER_WIDTH, Math.max(0, event.frame / span * width));
        ctx.fillStyle = event.kind === 'tank' ? TANK_COLOR : CANCEL_COLOR;
        ctx.fillRect(x, 0, MARKER_WIDTH, MARKER_BAND_HEIGHT);
    }

    return canvas.toDataURL('image/png');
};
