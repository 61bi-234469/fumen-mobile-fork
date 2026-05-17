/* tslint:disable:no-bitwise */
import { Page } from './fumen/types';
import { Pages } from './pages';
import { decideBackgroundColor, decidePieceColor } from './colors';
import { FieldConstants, Piece } from './enums';
import { HighlightType } from '../state_types';
import {
    BLOCK_SIZE,
    THUMBNAIL_WIDTH,
    drawThumbnail,
    getPageCommentText,
    getThumbnailHeight,
} from './thumbnail';

const GIF_PADDING = 0;
const GIF_COMMENT_HEIGHT = 50;
const GIF_SCALE = 2;
const GIF_BACKGROUND = '#000000';
const GIF_COMMENT_BACKGROUND = '#ffffff';
const GIF_COMMENT_BORDER = '#000000';
const GIF_COMMENT_TEXT = '#333333';
const GIF_MAX_COMMENT_LINES = 3;

export interface GifFrameLayout {
    width: number;
    height: number;
    fieldX: number;
    fieldBottomY: number;
    maxFieldHeight: number;
    commentY: number | null;
    commentHeight: number;
    hasAnyComment: boolean;
}

export const normalizeGifFrameDelayMs = (delayMs: number): number => {
    if (!isFinite(delayMs)) {
        return 500;
    }
    return Math.max(100, Math.min(10000, Math.round(delayMs)));
};

export const calculateGifFrameLayout = (
    pages: Page[],
    trimTopBlank: boolean,
): GifFrameLayout => {
    const thumbnailHeights = pages.map((_, index) => getThumbnailHeight(pages, index, trimTopBlank));
    const maxFieldHeight = thumbnailHeights.reduce((max, height) => Math.max(max, height), BLOCK_SIZE);
    const pagesObj = new Pages(pages);
    const hasAnyComment = pages.some((_, index) => getPageCommentText(pagesObj, index).trim().length > 0);
    const commentHeight = hasAnyComment ? GIF_COMMENT_HEIGHT : 0;
    const width = THUMBNAIL_WIDTH + GIF_PADDING * 2;
    const height = GIF_PADDING * 2 + maxFieldHeight + commentHeight;
    const fieldBottomY = GIF_PADDING + maxFieldHeight;

    return {
        width,
        height,
        fieldBottomY,
        maxFieldHeight,
        hasAnyComment,
        commentHeight,
        fieldX: GIF_PADDING,
        commentY: hasAnyComment ? fieldBottomY : null,
    };
};

export function generateGifBlob(
    pages: Page[],
    guideLineColor: boolean,
    trimTopBlank: boolean,
    frameDelayMs: number,
): Blob | null {
    if (pages.length === 0) {
        return null;
    }

    const delayCentiseconds = Math.max(1, Math.round(normalizeGifFrameDelayMs(frameDelayMs) / 10));
    const layout = calculateGifFrameLayout(pages, trimTopBlank);
    const canvas = document.createElement('canvas');
    canvas.width = layout.width * GIF_SCALE;
    canvas.height = layout.height * GIF_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }

    const pagesObj = new Pages(pages);
    const encoder = new GifEncoder(layout.width * GIF_SCALE, layout.height * GIF_SCALE, delayCentiseconds);

    for (let i = 0; i < pages.length; i += 1) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(GIF_SCALE, GIF_SCALE);
        drawGifFrame(ctx, pages, pagesObj, i, guideLineColor, trimTopBlank, layout);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        encoder.addFrame(imageData.data);
    }

    return new Blob([encoder.finish()], { type: 'image/gif' });
}

const drawGifFrame = (
    ctx: CanvasRenderingContext2D,
    pages: Page[],
    pagesObj: Pages,
    pageIndex: number,
    guideLineColor: boolean,
    trimTopBlank: boolean,
    layout: GifFrameLayout,
): void => {
    ctx.fillStyle = GIF_BACKGROUND;
    ctx.fillRect(0, 0, layout.width, layout.height);

    const thumbnailHeight = getThumbnailHeight(pages, pageIndex, trimTopBlank);
    const fieldY = layout.fieldBottomY - thumbnailHeight;
    const visibleTopRow = trimTopBlank
        ? Math.max(0, Math.round(thumbnailHeight / BLOCK_SIZE) - 1)
        : undefined;

    drawThumbnail(ctx, pages, pageIndex, layout.fieldX, fieldY, guideLineColor, trimTopBlank, visibleTopRow);

    if (layout.commentY !== null) {
        drawGifComment(ctx, pagesObj, pageIndex, layout.fieldX, layout.commentY);
    }
};

const drawGifComment = (
    ctx: CanvasRenderingContext2D,
    pagesObj: Pages,
    pageIndex: number,
    x: number,
    y: number,
): void => {
    ctx.fillStyle = GIF_COMMENT_BACKGROUND;
    ctx.fillRect(x, y, THUMBNAIL_WIDTH, GIF_COMMENT_HEIGHT);
    ctx.strokeStyle = GIF_COMMENT_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, THUMBNAIL_WIDTH, GIF_COMMENT_HEIGHT);

    const commentText = getPageCommentText(pagesObj, pageIndex);
    if (commentText.trim().length === 0) {
        return;
    }

    ctx.fillStyle = GIF_COMMENT_TEXT;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = wrapText(ctx, commentText, THUMBNAIL_WIDTH - 8);
    for (let i = 0; i < Math.min(lines.length, GIF_MAX_COMMENT_LINES); i += 1) {
        ctx.fillText(lines[i], x + 4, y + 6 + i * 13);
    }
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        let currentLine = '';
        for (const char of paragraph) {
            const testLine = currentLine + char;
            if (ctx.measureText(testLine).width > maxWidth && currentLine) {
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
};

class GifEncoder {
    private bytes: number[] = [];
    private finished = false;

    constructor(
        private width: number,
        private height: number,
        private delayCentiseconds: number,
    ) {
        this.writeAscii('GIF89a');
        this.writeShort(width);
        this.writeShort(height);
        this.writeByte(0xf7);
        this.writeByte(0);
        this.writeByte(0);
        this.writePalette();
        this.writeLoopExtension();
    }

    addFrame(rgba: Uint8ClampedArray): void {
        if (this.finished) {
            return;
        }
        const indices = quantizeToGifPalette(rgba);
        this.writeGraphicControlExtension();
        this.writeByte(0x2c);
        this.writeShort(0);
        this.writeShort(0);
        this.writeShort(this.width);
        this.writeShort(this.height);
        this.writeByte(0);
        this.writeByte(8);
        this.writeSubBlocks(lzwEncode(indices, 8));
    }

    finish(): Uint8Array {
        if (!this.finished) {
            this.writeByte(0x3b);
            this.finished = true;
        }
        return new Uint8Array(this.bytes);
    }

    private writeLoopExtension(): void {
        this.writeByte(0x21);
        this.writeByte(0xff);
        this.writeByte(11);
        this.writeAscii('NETSCAPE2.0');
        this.writeByte(3);
        this.writeByte(1);
        this.writeShort(0);
        this.writeByte(0);
    }

    private writeGraphicControlExtension(): void {
        this.writeByte(0x21);
        this.writeByte(0xf9);
        this.writeByte(4);
        this.writeByte(0);
        this.writeShort(this.delayCentiseconds);
        this.writeByte(0);
        this.writeByte(0);
    }

    private writePalette(): void {
        for (const color of GIF_PALETTE) {
            this.writeByte(color.r);
            this.writeByte(color.g);
            this.writeByte(color.b);
        }
    }

    private writeSubBlocks(data: number[]): void {
        for (let offset = 0; offset < data.length; offset += 255) {
            const size = Math.min(255, data.length - offset);
            this.writeByte(size);
            for (let i = 0; i < size; i += 1) {
                this.writeByte(data[offset + i]);
            }
        }
        this.writeByte(0);
    }

    private writeAscii(value: string): void {
        for (let i = 0; i < value.length; i += 1) {
            this.writeByte(value.charCodeAt(i));
        }
    }

    private writeShort(value: number): void {
        this.writeByte(value & 0xff);
        this.writeByte((value >> 8) & 0xff);
    }

    private writeByte(value: number): void {
        this.bytes.push(value & 0xff);
    }
}

interface RgbColor {
    r: number;
    g: number;
    b: number;
}

const parseHexColor = (color: string): RgbColor => {
    const hex = color.replace('#', '');
    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
    };
};

const createGifPalette = (): RgbColor[] => {
    const colors: string[] = [
        GIF_BACKGROUND,
        GIF_COMMENT_BACKGROUND,
        GIF_COMMENT_BORDER,
        GIF_COMMENT_TEXT,
        '#666666',
        '#999999',
        '#cccccc',
        decideBackgroundColor(0),
        decideBackgroundColor(FieldConstants.Height - 1),
    ];
    const pieces = [Piece.Empty, Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S, Piece.Gray];
    const highlights = [
        HighlightType.Normal,
        HighlightType.Highlight1,
        HighlightType.Highlight2,
        HighlightType.Lighter,
        HighlightType.Darker,
    ];

    for (const guideLine of [true, false]) {
        for (const piece of pieces) {
            for (const highlight of highlights) {
                colors.push(decidePieceColor(piece, highlight, guideLine));
            }
        }
    }

    for (let i = 0; i <= 255; i += 17) {
        const hex = i.toString(16).padStart(2, '0');
        colors.push(`#${hex}${hex}${hex}`);
    }

    const uniqueColors = Array.from(new Set(colors.map(color => color.toLowerCase())));
    const palette = uniqueColors.slice(0, 256).map(parseHexColor);
    while (palette.length < 256) {
        palette.push({ r: 0, g: 0, b: 0 });
    }
    return palette;
};

const GIF_PALETTE = createGifPalette();
const GIF_PALETTE_LOOKUP = new Map<string, number>(
    GIF_PALETTE.map((color, index) => [`${color.r},${color.g},${color.b}`, index] as [string, number]),
);
const nearestPaletteIndexCache = new Map<number, number>();

const findNearestPaletteIndex = (r: number, g: number, b: number): number => {
    const exact = GIF_PALETTE_LOOKUP.get(`${r},${g},${b}`);
    if (exact !== undefined) {
        return exact;
    }

    const cacheKey = (r << 16) | (g << 8) | b;
    const cached = nearestPaletteIndexCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    let bestIndex = 0;
    let bestDistance = Number.MAX_VALUE;
    for (let i = 0; i < GIF_PALETTE.length; i += 1) {
        const color = GIF_PALETTE[i];
        const dr = r - color.r;
        const dg = g - color.g;
        const db = b - color.b;
        const distance = dr * dr + dg * dg + db * db;
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = i;
        }
    }

    nearestPaletteIndexCache.set(cacheKey, bestIndex);
    return bestIndex;
};

const quantizeToGifPalette = (rgba: Uint8ClampedArray): Uint8Array => {
    const indices = new Uint8Array(rgba.length / 4);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 1) {
        indices[j] = findNearestPaletteIndex(rgba[i], rgba[i + 1], rgba[i + 2]);
    }
    return indices;
};

const lzwEncode = (indices: Uint8Array, minCodeSize: number): number[] => {
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    const codeSize = minCodeSize + 1;
    let codesSinceClear = 0;
    const writer = new BitWriter();

    writer.write(clearCode, codeSize);
    for (let i = 0; i < indices.length; i += 1) {
        if (codesSinceClear >= 240) {
            writer.write(clearCode, codeSize);
            codesSinceClear = 0;
        }
        writer.write(indices[i], codeSize);
        codesSinceClear += 1;
    }
    writer.write(endCode, codeSize);
    return writer.finish();
};

class BitWriter {
    private bytes: number[] = [];
    private current = 0;
    private bitCount = 0;

    write(code: number, size: number): void {
        this.current |= code << this.bitCount;
        this.bitCount += size;
        while (this.bitCount >= 8) {
            this.bytes.push(this.current & 0xff);
            this.current >>= 8;
            this.bitCount -= 8;
        }
    }

    finish(): number[] {
        if (this.bitCount > 0) {
            this.bytes.push(this.current & 0xff);
            this.current = 0;
            this.bitCount = 0;
        }
        return this.bytes;
    }
}
