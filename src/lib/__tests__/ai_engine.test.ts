import { aiEngineRotationMismatch } from '../ai_engine';

describe('aiEngineRotationMismatch', () => {
    test('Cold Clear assumes SRS and only Classic is off', () => {
        expect(aiEngineRotationMismatch('coldClear', 'classic')).toBe(true);
        expect(aiEngineRotationMismatch('coldClear', 'srs')).toBe(false);
        expect(aiEngineRotationMismatch('coldClear', 'srsPlus')).toBe(false);
    });

    test('Sold Slear assumes SRS+', () => {
        expect(aiEngineRotationMismatch('soldSlear', 'classic')).toBe(true);
        expect(aiEngineRotationMismatch('soldSlear', 'srs')).toBe(true);
        expect(aiEngineRotationMismatch('soldSlear', 'srsPlus')).toBe(false);
    });
});
