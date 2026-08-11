import { FieldConstants, Piece } from '../../../lib/enums';
import { renderReplayBoard } from '../replay_board';

interface Fill {
    color: string;
    height: number;
    x: number;
    y: number;
    width: number;
}

describe('replay board', () => {
    test('fills the empty upper three rows with the Editor gray background without grid lines', () => {
        const fills: Fill[] = [];
        const context = {
            fillStyle: '',
            fillRect(x: number, y: number, width: number, height: number) {
                fills.push({ x, y, width, height, color: this.fillStyle });
            },
            scale: jest.fn(),
        };
        const field = Array.from({ length: FieldConstants.PlayBlocks }).map(() => Piece.Empty);

        const originalDocument = (global as any).document;
        (global as any).document = {
            createElement: () => ({
                getContext: () => context,
                height: 0,
                toDataURL: () => 'data:image/png;base64,board',
                width: 0,
            }),
        };
        try {
            renderReplayBoard(field, 10, true);
        } finally {
            (global as any).document = originalDocument;
        }

        const upperField = fills.filter(fill => fill.color === '#333333');
        expect(upperField).toEqual([{ x: 0, y: 0, width: 100, height: 30, color: '#333333' }]);
    });
});
