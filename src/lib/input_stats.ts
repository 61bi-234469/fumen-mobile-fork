import { Piece, Rotation, isMinoPiece } from './enums';
import { Field } from './fumen/field';
import { Page } from './fumen/types';
import { InputRotationEvidence, parseInputRotationEvidence, parseSevenBagGrayProgress } from './comment_metadata';
import { parseQueueStateComment } from './cold_clear/queueParser';
import { PageFieldOperation, Pages, resolvePageCommentText } from './pages';
import { SerializedTree } from './fumen/tree_types';
import { findNodeByPageIndex, getPathToNode } from './fumen/tree_utils';

export type InputRulesPreset = 'none' | 'ppt' | 'tetrioS2';
export type Spin = 'none' | 'mini' | 'full';

export interface PlacementResult {
    clearedLines: number;
    spin: Spin;
    perfectClear: boolean;
    piece?: Piece;
}

export interface InputStats {
    b2bChain: number;
    renChain: number;
    pieces: number;
    lines: number;
    perfectClears: number;
    lastAction?: PlacementResult;
}

export interface InputStatsOptions {
    rotationSystem: 'classic' | 'srs' | 'srsPlus';
    tree?: SerializedTree;
}

// Cold Clear's Board::combo is represented as the raw consecutive-clear count.
const COMBO_TOKEN_BASE = 1;

export const toCommentCombo = (renChain: number): number => Math.max(0, renChain - (1 - COMBO_TOKEN_BASE));
export const fromCommentCombo = (combo: number): number => combo > 0 ? combo + (1 - COMBO_TOKEN_BASE) : 0;

export const resolveInputRulesPreset = (rotationSystem: 'classic' | 'srs' | 'srsPlus'): InputRulesPreset => {
    switch (rotationSystem) {
    case 'srs': return 'ppt';
    case 'srsPlus': return 'tetrioS2';
    case 'classic': return 'none';
    }
};

const filled = (field: Field, x: number, y: number): boolean => {
    if (x < 0 || 10 <= x || y < 0) return true;
    if (23 <= y) return false;
    return field.get(x, y) !== Piece.Empty;
};

const countClearedLines = (field: Field, piece: Page['piece']): number => {
    if (piece === undefined) return 0;
    const placed = field.copy();
    placed.put(piece);
    let lines = 0;
    for (let y = 0; y < 23; y += 1) {
        if (Array.from({ length: 10 }).every((_, x) => placed.get(x, y) !== Piece.Empty)) lines += 1;
    }
    return lines;
};

const isImmobile = (field: Field, piece: NonNullable<Page['piece']>): boolean => (
    !field.canPut(piece.type, piece.rotation, piece.coordinate.x - 1, piece.coordinate.y)
    && !field.canPut(piece.type, piece.rotation, piece.coordinate.x + 1, piece.coordinate.y)
    && !field.canPut(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y - 1)
    && !field.canPut(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y + 1)
);

const tSpin = (field: Field, piece: NonNullable<Page['piece']>, evidence: InputRotationEvidence): Spin => {
    const { x, y } = piece.coordinate;
    const corners = [filled(field, x - 1, y - 1), filled(field, x + 1, y - 1),
        filled(field, x - 1, y + 1), filled(field, x + 1, y + 1)];
    if (corners.filter(Boolean).length < 3) return 'none';
    const front = piece.rotation === Rotation.Spawn ? [corners[2], corners[3]]
        : piece.rotation === Rotation.Right ? [corners[1], corners[3]]
            : piece.rotation === Rotation.Reverse ? [corners[0], corners[1]] : [corners[0], corners[2]];
    return front.every(Boolean) || evidence.kickIndex === 4 ? 'full' : 'mini';
};

export const evaluatePlacement = (
    field: Field,
    piece: Page['piece'],
    preset: InputRulesPreset,
    evidence: InputRotationEvidence | undefined,
): PlacementResult => {
    const clearedLines = countClearedLines(field, piece);
    if (!piece || !isMinoPiece(piece.type)) return { clearedLines, spin: 'none', perfectClear: false };
    let spin: Spin = 'none';
    if (preset !== 'none' && evidence !== undefined) {
        // PPT's T-spin table is based on the preceding 90-degree SRS rotation.
        // SRS+ may use 180-degree rotation only for its All-Mini+ immobile rule.
        if (piece.type === Piece.T && (preset === 'tetrioS2' || evidence.direction !== '180')) {
            spin = tSpin(field, piece, evidence);
        }
        if (preset === 'tetrioS2' && spin === 'none' && isImmobile(field, piece)) spin = 'mini';
    }
    const after = field.copy();
    after.put(piece);
    after.clearLine();
    return {
        clearedLines,
        spin,
        perfectClear: clearedLines > 0 && after.toPlayFieldPieces().every(cell => cell === Piece.Empty),
        piece: piece.type,
    };
};

export const advanceStats = (stats: InputStats, result: PlacementResult, preset: InputRulesPreset): InputStats => {
    const difficult = result.clearedLines === 4 || result.spin !== 'none'
        || (preset === 'tetrioS2' && result.perfectClear);
    const b2bChain = result.clearedLines === 0 ? stats.b2bChain : difficult ? stats.b2bChain + 1 : 0;
    return {
        b2bChain,
        renChain: result.clearedLines === 0 ? 0 : stats.renChain + 1,
        pieces: stats.pieces + 1,
        lines: stats.lines + result.clearedLines,
        perfectClears: stats.perfectClears + (result.perfectClear ? 1 : 0),
        lastAction: result,
    };
};

export const computeInputStats = (
    pages: Page[], currentIndex: number, options: InputStatsOptions | InputStatsOptions['rotationSystem'],
): InputStats => {
    const rotationSystem = typeof options === 'string' ? options : options.rotationSystem;
    const initial: InputStats = { b2bChain: 0, renChain: 0, pieces: 0, lines: 0, perfectClears: 0 };
    const resolvedIndex = Math.min(Math.max(0, currentIndex), Math.max(0, pages.length - 1));
    const currentComment = pages.length === 0 ? '' : resolvePageCommentText(pages, resolvedIndex);
    const sevenBagGray = pages[resolvedIndex]?.internal?.sevenBagGrayProgress
        ?? parseSevenBagGrayProgress(currentComment);
    if (sevenBagGray !== undefined) {
        const seed = parseQueueStateComment(currentComment);
        return {
            ...initial,
            b2bChain: seed?.b2b ? 1 : 0,
            renChain: fromCommentCombo(seed?.combo ?? 0),
            pieces: sevenBagGray.pieces,
            lines: sevenBagGray.lines,
            perfectClears: sevenBagGray.perfectClears,
        };
    }
    if (currentIndex <= 0 || pages.length === 0) return initial;
    const seed = parseQueueStateComment(resolvePageCommentText(pages, 0));
    let stats: InputStats = seed ? {
        ...initial,
        b2bChain: seed.b2b ? 1 : 0,
        renChain: fromCommentCombo(seed.combo),
    } : initial;
    const tree = typeof options === 'string' ? undefined : options.tree;
    const currentNode = tree === undefined ? undefined : findNodeByPageIndex(tree, currentIndex);
    const indices = currentNode === undefined
        ? Array.from({ length: Math.min(currentIndex, pages.length) }, (_, index) => index)
        : getPathToNode(tree!, currentNode.id)
            .map(nodeId => tree!.nodes.find(node => node.id === nodeId))
            .filter((node): node is NonNullable<typeof node> => node !== undefined && node.pageIndex >= 0)
            .map(node => node.pageIndex)
            .filter(index => index !== currentIndex);
    const pagesObject = new Pages(pages);
    const replayedFields = currentNode === undefined
        ? pagesObject.replayFields(0, Math.min(currentIndex, pages.length), PageFieldOperation.Command)
        : pagesObject.replayFieldIndices(indices, PageFieldOperation.Command);
    const preset = resolveInputRulesPreset(rotationSystem);
    for (let position = 0; position < indices.length; position += 1) {
        const index = indices[position];
        const page = pages[index];
        if (!page.flags.lock || page.piece === undefined || !isMinoPiece(page.piece.type)) continue;
        const evidence = parseInputRotationEvidence(resolvePageCommentText(pages, index));
        stats = advanceStats(stats, evaluatePlacement(replayedFields[position], page.piece, preset, evidence), preset);
    }
    return stats;
};

export const formatActionLabel = (result: PlacementResult | undefined): string => {
    if (!result) return '—';
    const line = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'][result.clearedLines];
    const spinPrefix = result.piece === Piece.T ? 'T-SPIN' : `${Piece[result.piece ?? Piece.Empty]}-SPIN`;
    if (result.spin === 'full') return [spinPrefix, line].filter(Boolean).join(' ');
    if (result.spin === 'mini') return [spinPrefix, 'MINI', line].filter(Boolean).join(' ');
    return line || '—';
};

export const displayB2b = (b2bChain: number): number => Math.max(0, b2bChain - 1);
export const displayRen = (renChain: number): number => Math.max(0, renChain - 1);
