import { Piece } from '../enums';
import {
    parsePieceHoldText,
    parsePieceQueueText,
    pieceQueuePieceToChar,
    pieceQueueToText,
} from '../piece_queue';

describe('piece queue input', () => {
    test('parses queue text in displayed order', () => {
        expect(parsePieceQueueText('tiOL')).toEqual([Piece.T, Piece.I, Piece.O, Piece.L]);
        expect(parsePieceQueueText('')).toEqual([]);
        expect(parsePieceQueueText('TX')).toBeNull();
    });

    test('parses an optional hold piece', () => {
        expect(parsePieceHoldText('s')).toBe(Piece.S);
        expect(parsePieceHoldText('')).toBeNull();
        expect(parsePieceHoldText('IO')).toBeUndefined();
        expect(parsePieceHoldText('X')).toBeUndefined();
    });

    test('serializes hold and queue pieces for the shared editors', () => {
        expect(pieceQueuePieceToChar(Piece.Z)).toBe('Z');
        expect(pieceQueueToText([Piece.J, Piece.L, Piece.S])).toBe('JLS');
    });
});
