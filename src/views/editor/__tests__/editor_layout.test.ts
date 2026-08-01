import { shouldUseCompactEditorRail } from '../responsive_layout';
import { getLayout } from '../editor';

jest.mock('../../../env', () => ({
    PageEnv: {
        Version: 'test',
        Debug: false,
    },
}));

jest.mock('../../../actions', () => ({}));

jest.mock('../../../actions/cold_clear', () => ({
    resolveCurrentColdClearMenuQueueState: () => null,
}));

jest.mock('konva', () => ({}));

jest.mock('../../../states', () => ({
    resources: {
        konva: {
            stage: {},
        },
    },
}));

describe('editor layout', () => {
    test('keeps text labels on a normal-height single-column rail', () => {
        expect(shouldUseCompactEditorRail(725, 1)).toBe(false);
        expect(shouldUseCompactEditorRail(559, 1)).toBe(true);
        expect(shouldUseCompactEditorRail(725, 2)).toBe(true);
    });

    const pieceCommon = (width: number, height: number, topLeftY: number) => ({
        topLeftY,
        width,
        height,
        sidePanelWidth: 0,
        rightInspectorWidth: 0,
        trayInBottom: true,
        commentVisible: false,
        reserveCommentHeight: true,
    });

    test('keeps the select layout field identical to PAINT and reserves hidden comment space', () => {
        const common = {
            topLeftY: 30,
            width: 674,
            height: 802,
            sidePanelWidth: 0,
            rightInspectorWidth: 0,
            trayInBottom: true,
        };
        const paintLayout = getLayout({
            ...common,
            pieceModeVisible: false,
            commentVisible: true,
            reserveCommentHeight: true,
        });
        const selectLayout = getLayout({
            ...common,
            pieceModeVisible: true,
            pieceLayout: 'select',
            commentVisible: false,
            reserveCommentHeight: true,
        });

        expect(selectLayout.field.size).toEqual(paintLayout.field.size);
        expect(selectLayout.field.topLeft).toEqual(paintLayout.field.topLeft);
        expect(selectLayout.buttons.size.width).toBe(paintLayout.buttons.size.width);
        expect(selectLayout.pieceQueue.visible).toBe(false);
        expect(selectLayout.pieceQueue.ceilingOffset).toBe(0);
        expect(selectLayout.comment.size.height).toBe(0);
        expect(selectLayout.comment.reservedHeight).toBe(35);
        // PIECE通常はSELECT/PAINTを各1行にするため、PAINTより1行ぶん低い
        expect(selectLayout.buttons.cellHeight).toBe(30);
        expect(paintLayout.buttons.cellHeight).toBe(31);
    });

    test('widens the play layout queues to the reference proportion without shrinking the board', () => {
        const paintLayout = getLayout({
            ...pieceCommon(674, 802, 30),
            pieceModeVisible: false,
            commentVisible: true,
        });
        const playLayout = getLayout({ ...pieceCommon(674, 802, 30), pieceModeVisible: true, pieceLayout: 'play' });

        // PCは高さ律速のため、キューを広げても盤面は縮まない
        expect(playLayout.field.size.width).toBeCloseTo(paintLayout.field.size.width, 6);
        expect(playLayout.pieceQueue.width).toBe(97);
        expect(playLayout.pieceQueue.width / playLayout.field.size.width).toBeGreaterThan(0.30);
        expect(playLayout.pieceQueue.width / playLayout.field.size.width).toBeLessThan(0.36);
        // 依頼の「キューが狭い」への回帰ガード（従来は26px）
        expect(playLayout.pieceQueue.nextMinoHeight).toBeGreaterThanOrEqual(50);
        expect(playLayout.pieceQueue.ceilingOffset).toBeGreaterThan(0);
        expect(playLayout.buttons.columns).toBe(1);
    });

    test('keeps a desktop play layout inside the queue width cap', () => {
        const layout = getLayout({ ...pieceCommon(1920, 1080, 30), pieceModeVisible: true, pieceLayout: 'play' });

        expect(layout.pieceQueue.width).toBe(132);
        expect(layout.pieceQueue.nextMinoHeight).toBe(96);
    });

    test.each([
        [320, 568, 0],
        [375, 667, 0],
        [844, 390, 0],
        [674, 802, 30],
    ])('fits the play layout columns into %ix%i', (width, height, topLeftY) => {
        const layout = getLayout({ ...pieceCommon(width, height, topLeftY), pieceModeVisible: true,
            pieceLayout: 'play' });

        expect(layout.field.size.width + layout.pieceQueue.width * 2 + layout.pieceQueue.gap + 10)
            .toBeLessThanOrEqual(width);
        expect(layout.pieceQueue.width).toBeGreaterThanOrEqual(66);
        expect(layout.buttons.cellHeight).toBeGreaterThanOrEqual(22);
        expect(layout.pieceQueue.nextMinoHeight).toBeGreaterThanOrEqual(20);
    });

    test('no longer needs the rail extension on a short landscape display', () => {
        const layout = getLayout({ ...pieceCommon(844, 390, 0), pieceModeVisible: true, pieceLayout: 'play' });

        expect(layout.buttons.columns).toBe(1);
        expect(layout.pieceQueue.railExtensionHeight).toBe(0);
        expect(layout.pieceQueue.nextMinoHeight).toBeGreaterThan(16);
    });
});
