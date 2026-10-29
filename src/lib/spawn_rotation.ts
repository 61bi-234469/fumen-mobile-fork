// 出現時の先行回転: 新しいミノが出現するとき回転キー/ボタンが押されたままなら、
// その向きに回した状態で出現させる。
// 'off' 以外のモードを後から足せるよう、真偽値ではなく文字列のユニオンで持つ。
// このアプリには ARE がなく、次のミノは設置直後に出現するため「押して離した」入力を
// 溜めるモードは意味を持たない。そのため 'hold'（出現時に押下中）のみを提供する。

export type SpawnRotationMode = 'off' | 'hold';

export type SpawnRotationDirection = 'cw' | 'ccw' | '180';

export const DEFAULT_SPAWN_ROTATION: SpawnRotationMode = 'off';

export const isValidSpawnRotationMode = (value: unknown): value is SpawnRotationMode =>
    value === 'off' || value === 'hold';

interface HeldRotation {
    direction: SpawnRotationDirection;
    order: number;
}

// 押下中の回転入力。キーボードとトレイのボタンは同じ入力IDで startPieceShortcut /
// endPieceShortcut を通るため、そこから登録・解除する。
const heldRotations = new Map<string, HeldRotation>();
let pressCounter = 0;

export const pressRotation = (id: string, direction: SpawnRotationDirection) => {
    pressCounter += 1;
    heldRotations.set(id, { direction, order: pressCounter });
};

export const releaseRotation = (id: string) => {
    heldRotations.delete(id);
};

export const releaseAllRotations = () => {
    heldRotations.clear();
};

/** 押下中の回転入力のうち、最後に押されたものの向き。押されていなければ null。 */
export const heldSpawnRotation = (): SpawnRotationDirection | null => {
    let latest: HeldRotation | undefined;
    for (const held of Array.from(heldRotations.values())) {
        if (latest === undefined || latest.order < held.order) {
            latest = held;
        }
    }
    return latest === undefined ? null : latest.direction;
};

// フォーカスを失うと keyup / pointerup を受け取れないため、押下状態を破棄する
if (typeof window !== 'undefined') {
    window.addEventListener('blur', releaseAllRotations);
}
