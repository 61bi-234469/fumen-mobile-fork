import { showToast } from '../toast';

describe('showToast', () => {
    const toast = jest.fn();

    beforeEach(() => {
        toast.mockReset();
        (global as any).M = { toast };
    });

    afterAll(() => {
        delete (global as any).M;
    });

    test('escapes HTML in the message', () => {
        showToast('Failed to import: <img src=x onerror=alert(1)>', 1000);
        expect(toast).toHaveBeenCalledWith({
            classes: 'top-toast',
            displayLength: 1000,
            html: 'Failed to import: &lt;img src=x onerror=alert(1)&gt;',
        });
    });

    test('does nothing when Materialize is not loaded', () => {
        delete (global as any).M;
        expect(() => showToast('hello')).not.toThrow();
    });
});
