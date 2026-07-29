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

    test('keeps the field stable and reserves hidden comment space in PIECE mode', () => {
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
            pieceQueueVisible: false,
            commentVisible: true,
            reserveCommentHeight: true,
        });
        const pieceLayout = getLayout({
            ...common,
            pieceQueueVisible: true,
            commentVisible: false,
            reserveCommentHeight: true,
        });

        expect(pieceLayout.field.size).toEqual(paintLayout.field.size);
        expect(pieceLayout.field.topLeft).toEqual(paintLayout.field.topLeft);
        expect(pieceLayout.comment.size.height).toBe(0);
        expect(pieceLayout.comment.reservedHeight).toBe(35);
        expect(pieceLayout.pieceQueue.ceilingOffset).toBeGreaterThan(0);
        expect(pieceLayout.pieceQueue.columns).toBe(1);
    });

    test('extends the short landscape rail without shrinking its cells or NEXT rows', () => {
        const layout = getLayout({
            topLeftY: 0,
            width: 844,
            height: 390,
            sidePanelWidth: 0,
            rightInspectorWidth: 0,
            trayInBottom: true,
            pieceQueueVisible: true,
            commentVisible: false,
            reserveCommentHeight: true,
        });

        expect(layout.pieceQueue.columns).toBe(2);
        expect(layout.pieceQueue.railCellHeight).toBeGreaterThanOrEqual(22);
        expect(layout.pieceQueue.nextMinoHeight).toBeGreaterThanOrEqual(16);
        expect(layout.pieceQueue.railExtensionHeight).toBeGreaterThan(0);
    });
});
