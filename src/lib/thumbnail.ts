import { Page } from './fumen/types';
import { Pages, PageFieldOperation, isTextCommentResult } from './pages';
import { decideBackgroundColor, decidePieceColor } from './colors';
import { HighlightType } from '../state_types';
import { FieldConstants, Piece, Rotation } from './enums';
import { getBlocks } from './piece';

export const THUMBNAIL_WIDTH = 100;
export const THUMBNAIL_HEIGHT = 230;
export const BLOCK_SIZE = THUMBNAIL_WIDTH / FieldConstants.Width;
const MAX_THUMBNAIL_RENDER_SCALE = 2;

const thumbnailCache = new WeakMap<Page[], Map<string, string>>();

export function clearThumbnailCache(pages: Page[]): void {
    thumbnailCache.delete(pages);
}

const normalizeThumbnailRenderScale = (renderScale: number | undefined): number => {
    if (renderScale === undefined || !isFinite(renderScale)) {
        return 1;
    }
    return Math.max(1, Math.min(MAX_THUMBNAIL_RENDER_SCALE, Math.ceil(renderScale * 4) / 4));
};

export function generateThumbnail(
    pages: Page[],
    pageIndex: number,
    guideLineColor: boolean,
    trimTopBlank: boolean = false,
    renderScale?: number,
): string {
    const normalizedRenderScale = normalizeThumbnailRenderScale(renderScale);
    const cacheKey = [
        pageIndex,
        guideLineColor ? '1' : '0',
        trimTopBlank ? '1' : '0',
        normalizedRenderScale,
    ].join(':');
    let cache = thumbnailCache.get(pages);
    if (!cache) {
        cache = new Map<string, string>();
        thumbnailCache.set(pages, cache);
    }
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(THUMBNAIL_WIDTH * normalizedRenderScale);

    const pagesObj = new Pages(pages);
    const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);
    const page = pages[pageIndex];

    const fieldArray = buildFieldArray(field, page);
    const topFilledRow = trimTopBlank ? findTopFilledRow(fieldArray) : null;
    const visibleTopRow = trimTopBlank
        ? (topFilledRow === null ? 0 : Math.min(FieldConstants.Height - 1, topFilledRow + 1))
        : FieldConstants.Height - 1;
    const visibleRows = visibleTopRow + 1;

    canvas.height = Math.ceil(visibleRows * BLOCK_SIZE * normalizedRenderScale);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }
    ctx.scale(normalizedRenderScale, normalizedRenderScale);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, THUMBNAIL_WIDTH, visibleRows * BLOCK_SIZE);
    if (visibleTopRow >= 20) {
        const upperFieldRows = visibleTopRow - 20 + 1;
        ctx.fillStyle = decideBackgroundColor(20);
        ctx.fillRect(0, 0, THUMBNAIL_WIDTH, upperFieldRows * BLOCK_SIZE);
    }

    // Detect filled lines
    const filledLines = new Set<number>();
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        let filled = true;
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = fieldArray[x + y * FieldConstants.Width];
            if (piece === undefined || piece === 0) { // 0 = Piece.Empty
                filled = false;
                break;
            }
        }
        if (filled) {
            filledLines.add(y);
        }
    }

    // Draw field blocks
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        const isFilledLine = filledLines.has(y);
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = field.get(x, y);
            const highlight = isFilledLine ? HighlightType.Highlight1 : HighlightType.Normal;
            if (piece === Piece.Empty && y >= 20) {
                continue;
            }
            const color = piece === Piece.Empty
                ? decideBackgroundColor(y)
                : decidePieceColor(piece, highlight, guideLineColor);

            ctx.fillStyle = color;
            if (y <= visibleTopRow) {
                ctx.fillRect(
                    x * BLOCK_SIZE,
                    (visibleTopRow - y) * BLOCK_SIZE,
                    BLOCK_SIZE - 0.5,
                    BLOCK_SIZE - 0.5,
                );
            }
        }
    }

    // Draw current piece
    if (page && page.piece) {
        const { type, rotation, coordinate } = page.piece;
        const positions = getPiecePositions(type, rotation);

        for (const pos of positions) {
            const px = coordinate.x + pos[0];
            const py = coordinate.y + pos[1];

            if (px >= 0 && px < FieldConstants.Width && py >= 0 && py < FieldConstants.Height) {
                if (py <= visibleTopRow) {
                    ctx.fillStyle = decidePieceColor(type, HighlightType.Highlight2, guideLineColor);
                    ctx.fillRect(
                        px * BLOCK_SIZE,
                        (visibleTopRow - py) * BLOCK_SIZE,
                        BLOCK_SIZE - 0.5,
                        BLOCK_SIZE - 0.5,
                    );
                }
            }
        }
    }

    const dataUrl = canvas.toDataURL('image/png');
    cache.set(cacheKey, dataUrl);
    return dataUrl;
}

export function getThumbnailHeight(
    pages: Page[],
    pageIndex: number,
    trimTopBlank: boolean,
): number {
    if (!trimTopBlank) {
        return THUMBNAIL_HEIGHT;
    }

    const pagesObj = new Pages(pages);
    const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);
    const page = pages[pageIndex];
    const fieldArray = buildFieldArray(field, page);

    const topFilledRow = findTopFilledRow(fieldArray);
    const visibleTopRow = topFilledRow === null
        ? 0
        : Math.min(FieldConstants.Height - 1, topFilledRow + 1);
    const visibleRows = visibleTopRow + 1;

    return visibleRows * BLOCK_SIZE;
}

const buildFieldArray = (
    field: import('./fumen/field').Field,
    page?: Page,
): (number | undefined)[] => {
    // tslint:disable-next-line:prefer-array-literal
    const fieldArray: (number | undefined)[] = Array(FieldConstants.Width * FieldConstants.Height);
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            fieldArray[x + y * FieldConstants.Width] = field.get(x, y);
        }
    }

    if (page && page.piece) {
        const { type, rotation, coordinate } = page.piece;
        const positions = getPiecePositions(type, rotation);
        for (const pos of positions) {
            const px = coordinate.x + pos[0];
            const py = coordinate.y + pos[1];
            if (px >= 0 && px < FieldConstants.Width && py >= 0 && py < FieldConstants.Height) {
                fieldArray[px + py * FieldConstants.Width] = type;
            }
        }
    }

    return fieldArray;
};

const findTopFilledRow = (fieldArray: (number | undefined)[]): number | null => {
    for (let y = FieldConstants.Height - 1; y >= 0; y -= 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = fieldArray[x + y * FieldConstants.Width];
            if (piece !== undefined && piece !== 0) {
                return y;
            }
        }
    }
    return null;
};

function getPiecePositions(piece: number, rotation: number): number[][] {
    if (piece < Piece.I || piece > Piece.S) {
        return [];
    }
    return getBlocks(piece as Piece, rotation as Rotation);
}

// List view export constants
const EXPORT_COLUMNS = 5;
const EXPORT_ITEM_WIDTH = 100;
const EXPORT_ITEM_HEIGHT = THUMBNAIL_HEIGHT;
const EXPORT_COMMENT_HEIGHT = 50;
const EXPORT_GAP = 8;
const EXPORT_PADDING = 10;
export const EXPORT_SCALE = 2; // High DPI scaling for better quality

export function generateListViewExportImage(
    pages: Page[],
    guideLineColor: boolean,
    trimTopBlank: boolean = false,
): string {
    const pageCount = pages.length;
    if (pageCount === 0) {
        return '';
    }

    const rows = Math.ceil(pageCount / EXPORT_COLUMNS);
    const cols = Math.min(pageCount, EXPORT_COLUMNS);

    const thumbnailHeights = pages.map((_, index) => (trimTopBlank
        ? getThumbnailHeight(pages, index, true)
        : EXPORT_ITEM_HEIGHT));
    const itemHeights = thumbnailHeights.map(height => height + EXPORT_COMMENT_HEIGHT);

    const rowHeights: number[] = [];
    for (let row = 0; row < rows; row += 1) {
        const start = row * EXPORT_COLUMNS;
        const end = Math.min(start + EXPORT_COLUMNS, pageCount);
        let maxHeight = 0;
        for (let i = start; i < end; i += 1) {
            maxHeight = Math.max(maxHeight, itemHeights[i]);
        }
        rowHeights[row] = maxHeight;
    }

    const totalRowHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    const canvasWidth = EXPORT_PADDING * 2 + cols * EXPORT_ITEM_WIDTH + (cols - 1) * EXPORT_GAP;
    const canvasHeight = EXPORT_PADDING * 2 + totalRowHeight + Math.max(0, rows - 1) * EXPORT_GAP;

    const canvas = document.createElement('canvas');
    // Apply high DPI scaling for better quality
    canvas.width = canvasWidth * EXPORT_SCALE;
    canvas.height = canvasHeight * EXPORT_SCALE;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }

    // Scale all drawing operations
    ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

    // Background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const pagesObj = new Pages(pages);
    const rowOffsets: number[] = [];
    let offset = 0;
    for (let row = 0; row < rows; row += 1) {
        rowOffsets[row] = offset;
        offset += rowHeights[row] + EXPORT_GAP;
    }

    for (let i = 0; i < pageCount; i += 1) {
        const col = i % EXPORT_COLUMNS;
        const row = Math.floor(i / EXPORT_COLUMNS);

        const x = EXPORT_PADDING + col * (EXPORT_ITEM_WIDTH + EXPORT_GAP);
        const rowHeight = rowHeights[row];
        const itemHeight = itemHeights[i];
        const y = EXPORT_PADDING + rowOffsets[row] + (rowHeight - itemHeight);
        const thumbnailHeight = thumbnailHeights[i];
        const visibleTopRow = trimTopBlank
            ? Math.max(0, Math.round(thumbnailHeight / BLOCK_SIZE) - 1)
            : undefined;

        // Draw thumbnail
        drawThumbnail(ctx, pages, i, x, y, guideLineColor, trimTopBlank, visibleTopRow);

        // Draw page number and comment
        drawComment(ctx, pagesObj, i, x, y + thumbnailHeight);
    }

    return canvas.toDataURL('image/png');
}

export function drawThumbnail(
    ctx: CanvasRenderingContext2D,
    pages: Page[],
    pageIndex: number,
    x: number,
    y: number,
    guideLineColor: boolean,
    trimTopBlank: boolean,
    visibleTopRowOverride?: number,
): void {
    const pagesObj = new Pages(pages);
    const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);
    const page = pages[pageIndex];

    const fieldArray = buildFieldArray(field, page);
    const computedTopFilledRow = trimTopBlank && visibleTopRowOverride === undefined
        ? findTopFilledRow(fieldArray)
        : null;
    const resolvedVisibleTopRow = trimTopBlank
        ? (visibleTopRowOverride !== undefined
            ? Math.max(0, Math.min(FieldConstants.Height - 1, visibleTopRowOverride))
            : (computedTopFilledRow === null
                ? 0
                : Math.min(FieldConstants.Height - 1, computedTopFilledRow + 1)))
        : FieldConstants.Height - 1;
    const visibleRows = resolvedVisibleTopRow + 1;
    const thumbnailHeight = visibleRows * BLOCK_SIZE;

    // Black background for thumbnail
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, EXPORT_ITEM_WIDTH, thumbnailHeight);
    if (resolvedVisibleTopRow >= 20) {
        const upperFieldRows = resolvedVisibleTopRow - 20 + 1;
        ctx.fillStyle = decideBackgroundColor(20);
        ctx.fillRect(x, y, EXPORT_ITEM_WIDTH, upperFieldRows * BLOCK_SIZE);
    }

    // Detect filled lines
    const filledLines = new Set<number>();
    for (let fieldY = 0; fieldY < FieldConstants.Height; fieldY += 1) {
        let filled = true;
        for (let fieldX = 0; fieldX < FieldConstants.Width; fieldX += 1) {
            const piece = fieldArray[fieldX + fieldY * FieldConstants.Width];
            if (piece === undefined || piece === 0) { // 0 = Piece.Empty
                filled = false;
                break;
            }
        }
        if (filled) {
            filledLines.add(fieldY);
        }
    }

    // Draw field blocks
    for (let fieldY = 0; fieldY < FieldConstants.Height; fieldY += 1) {
        const isFilledLine = filledLines.has(fieldY);
        for (let fieldX = 0; fieldX < FieldConstants.Width; fieldX += 1) {
            const piece = field.get(fieldX, fieldY);
            const highlight = isFilledLine ? HighlightType.Highlight1 : HighlightType.Normal;
            if (piece === Piece.Empty && fieldY >= 20) {
                continue;
            }
            const color = piece === Piece.Empty
                ? decideBackgroundColor(fieldY)
                : decidePieceColor(piece, highlight, guideLineColor);

            ctx.fillStyle = color;
            if (fieldY <= resolvedVisibleTopRow) {
                ctx.fillRect(
                    x + fieldX * BLOCK_SIZE,
                    y + (resolvedVisibleTopRow - fieldY) * BLOCK_SIZE,
                    BLOCK_SIZE - 0.5,
                    BLOCK_SIZE - 0.5,
                );
            }
        }
    }

    // Draw current piece
    if (page && page.piece) {
        const { type, rotation, coordinate } = page.piece;
        const positions = getPiecePositions(type, rotation);

        for (const pos of positions) {
            const px = coordinate.x + pos[0];
            const py = coordinate.y + pos[1];

            if (px >= 0 && px < FieldConstants.Width && py >= 0 && py < FieldConstants.Height
                && py <= resolvedVisibleTopRow) {
                ctx.fillStyle = decidePieceColor(type, HighlightType.Highlight2, guideLineColor);
                ctx.fillRect(
                    x + px * BLOCK_SIZE,
                    y + (resolvedVisibleTopRow - py) * BLOCK_SIZE,
                    BLOCK_SIZE - 0.5,
                    BLOCK_SIZE - 0.5,
                );
            }
        }
    }
}

export function getPageCommentText(pagesObj: Pages, pageIndex: number): string {
    const commentResult = pagesObj.getComment(pageIndex);
    if (isTextCommentResult(commentResult)) {
        return commentResult.text;
    }
    return commentResult.quiz;
}

function drawComment(
    ctx: CanvasRenderingContext2D,
    pagesObj: Pages,
    pageIndex: number,
    x: number,
    y: number,
): void {
    // White background for comment area
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, EXPORT_ITEM_WIDTH, EXPORT_COMMENT_HEIGHT);

    // Border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, EXPORT_ITEM_WIDTH, EXPORT_COMMENT_HEIGHT);

    // Page number
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`#${pageIndex + 1}`, x + 4, y + 12);

    // Comment text
    const commentText = getPageCommentText(pagesObj, pageIndex);

    if (commentText) {
        ctx.fillStyle = '#333333';
        ctx.font = '9px sans-serif';

        // Word wrap
        const maxWidth = EXPORT_ITEM_WIDTH - 8;
        const lineHeight = 11;
        const lines = wrapText(ctx, commentText, maxWidth);
        const maxLines = 3;

        for (let i = 0; i < Math.min(lines.length, maxLines); i += 1) {
            ctx.fillText(lines[i], x + 4, y + 24 + i * lineHeight);
        }
    }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        let currentLine = '';

        for (const char of paragraph) {
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }
    }

    return lines;
}

export function downloadImage(dataURL: string, filename: string): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function downloadBlob(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
