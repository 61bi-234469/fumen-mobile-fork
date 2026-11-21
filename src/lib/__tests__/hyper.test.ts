import { HyperStage } from '../hyper';

// hyper.ts only needs the shared layers from states.ts; loading the real module would build Konva objects.
jest.mock('../../states', () => ({ resources: { konva: { layers: {} } } }));

describe('HyperStage.removeStage', () => {
    const createStage = () => {
        const calls: string[] = [];
        const stage = {
            removeChildren: jest.fn(() => calls.push('removeChildren')),
            destroy: jest.fn(() => calls.push('destroy')),
        };
        return { stage, calls };
    };

    test('detaches the shared layers before destroying the stage', () => {
        const { stage, calls } = createStage();
        const hyperStage = new HyperStage();
        hyperStage.addStage(stage as any);

        hyperStage.removeStage();

        // destroy() also destroys whatever is still attached, and the layers are reused by the next stage.
        expect(calls).toEqual(['removeChildren', 'destroy']);
        expect(hyperStage.isReady).toBe(false);
    });

    test('destroys each stage only once', () => {
        const { stage } = createStage();
        const hyperStage = new HyperStage();
        hyperStage.addStage(stage as any);

        hyperStage.removeStage();
        hyperStage.removeStage();

        expect(stage.destroy).toHaveBeenCalledTimes(1);
    });

    test('does nothing without a stage', () => {
        expect(() => new HyperStage().removeStage()).not.toThrow();
    });
});
