import { Piece } from '../../enums';
import { buildQueueComment, buildQueueStateComment, parseQueueComment, parseQueueStateComment } from '../queueParser';

describe('parseQueueComment (#Q format)', () => {
    test('parse queue without hold and current', () => {
        const result = parseQueueComment('#Q=[]()IOTLJSZ');
        expect(result).toEqual({
            hold: null,
            current: null,
            queue: [Piece.I, Piece.O, Piece.T, Piece.L, Piece.J, Piece.S, Piece.Z],
        });
    });

    test('parse queue with hold and current', () => {
        const result = parseQueueComment('#Q=[T](I)OSL');
        expect(result).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.S, Piece.L],
        });
    });

    test('parse current-only queue', () => {
        const result = parseQueueComment('#Q=[](I)');
        expect(result).toEqual({
            hold: null,
            current: Piece.I,
            queue: [],
        });
    });

    test('parse hold-only queue', () => {
        const result = parseQueueComment('#Q=[T]()');
        expect(result).toEqual({
            hold: Piece.T,
            current: null,
            queue: [],
        });
    });

    test('parse lowercase quiz queue', () => {
        const result = parseQueueComment('#Q=[t](i)os');
        expect(result).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.S],
        });
    });

    test('ignore trailing quiz sections after semicolon', () => {
        const result = parseQueueComment('#Q=[T](I)OS;JLZ');
        expect(result).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.S],
        });
    });

    test('return null for empty quiz', () => {
        expect(parseQueueComment('#Q=[]()')).toBeNull();
    });

    test('return null for invalid quiz grammar', () => {
        expect(parseQueueComment('#Q=[TT](I)OS')).toBeNull();
        expect(parseQueueComment('#Q=[T]IOS')).toBeNull();
        expect(parseQueueComment('#Q=(I)OS')).toBeNull();
        expect(parseQueueComment('#Q=[X](I)OS')).toBeNull();
    });

    test('return null for empty string', () => {
        expect(parseQueueComment('')).toBeNull();
    });

    test('return null for non-piece characters', () => {
        expect(parseQueueComment('hello')).toBeNull();
    });

    test('parse scored quiz queue', () => {
        const result = parseQueueComment('score=123.45 | #Q=[T](I)OL');
        expect(result).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.L],
        });
    });

    test('parse outside-top quiz queue', () => {
        const result = parseQueueComment('outsideTop=10000 | #Q=[T](I)OL');
        expect(result).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.L],
        });
    });

    test('return null for invalid score format', () => {
        expect(parseQueueComment('score=abc | #Q=[](I)OTL')).toBeNull();
    });

    test('return null for score-only text', () => {
        expect(parseQueueComment('score=12.34')).toBeNull();
    });

    test('return null for metadata-only queue state text', () => {
        expect(parseQueueComment('score=12.34 | b2b=1 combo=4')).toBeNull();
    });

    test('return null for invalid scored queue grammar', () => {
        expect(parseQueueComment('score=12.3 | #Q=[](I)OTL')).toBeNull();
        expect(parseQueueComment('score=12.34|#Q=[](I)OTL')).toBeNull();
        expect(parseQueueComment('Score=12.34 | #Q=[](I)OTL')).toBeNull();
    });
});

describe('parseQueueComment (legacy format, read-only compatibility)', () => {
    test('parse legacy queue without hold', () => {
        const result = parseQueueComment('IOTLJSZ');
        expect(result).toEqual({
            hold: null,
            current: null,
            queue: [Piece.I, Piece.O, Piece.T, Piece.L, Piece.J, Piece.S, Piece.Z],
        });
    });

    test('parse legacy queue with hold', () => {
        const result = parseQueueComment('T:IOSL');
        expect(result).toEqual({
            hold: Piece.T,
            current: null,
            queue: [Piece.I, Piece.O, Piece.S, Piece.L],
        });
    });

    test('parse legacy mixed case queue', () => {
        const result = parseQueueComment('IoTl');
        expect(result).toEqual({
            hold: null,
            current: null,
            queue: [Piece.I, Piece.O, Piece.T, Piece.L],
        });
    });

    test('parse legacy hold with empty queue (colon at end)', () => {
        expect(parseQueueComment('T:')).toEqual({
            hold: Piece.T,
            current: null,
            queue: [],
        });
    });

    test('parse legacy scored queue with hold', () => {
        const result = parseQueueComment('score=-8.30 | T:IOL');
        expect(result).toEqual({
            hold: Piece.T,
            current: null,
            queue: [Piece.I, Piece.O, Piece.L],
        });
    });

    test('return null for multiple colons', () => {
        expect(parseQueueComment('T:I:O')).toBeNull();
    });

    test('return null for colon only', () => {
        expect(parseQueueComment(':')).toBeNull();
    });

    test('return null for leading space', () => {
        expect(parseQueueComment(' IOTL')).toBeNull();
    });

    test('return null for trailing space', () => {
        expect(parseQueueComment('IOTL ')).toBeNull();
    });
});

describe('buildQueueComment', () => {
    test('build with hold, current and queue', () => {
        expect(buildQueueComment(Piece.T, Piece.I, [Piece.O, Piece.S])).toBe('#Q=[T](I)OS');
    });

    test('build without hold', () => {
        expect(buildQueueComment(null, Piece.I, [Piece.O, Piece.T])).toBe('#Q=[](I)OT');
    });

    test('build without current', () => {
        expect(buildQueueComment(Piece.T, null, [Piece.I, Piece.O])).toBe('#Q=[T]()IO');
    });

    test('build hold-only queue', () => {
        expect(buildQueueComment(Piece.T, null, [])).toBe('#Q=[T]()');
    });

    test('build current-only queue', () => {
        expect(buildQueueComment(null, Piece.Z, [])).toBe('#Q=[](Z)');
    });

    test('return empty string when everything is empty', () => {
        expect(buildQueueComment(null, null, [])).toBe('');
    });

    test('round-trip through parseQueueComment', () => {
        const built = buildQueueComment(Piece.T, Piece.I, [Piece.O, Piece.S, Piece.L]);
        expect(parseQueueComment(built)).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.S, Piece.L],
        });
    });

    test('round-trip empty current with next pieces', () => {
        const built = buildQueueComment(null, null, [Piece.S, Piece.Z]);
        expect(built).toBe('#Q=[]()SZ');
        expect(parseQueueComment(built)).toEqual({
            hold: null,
            current: null,
            queue: [Piece.S, Piece.Z],
        });
    });
});

describe('parseQueueStateComment', () => {
    test('round-trips quiz suffixes while editing the queue state', () => {
        const text = '#Q=[O](L)J;#Q=[S](Z)T;hello';
        const result = parseQueueStateComment(text);

        expect(result?.suffix).toBe(';#Q=[S](Z)T;hello');
        expect(buildQueueStateComment(
            result!.hold,
            result!.current,
            result!.queue,
            result!.b2b,
            result!.combo,
            result!.suffix,
        )).toBe(text);
    });

    test('parse queue state defaults to b2b=false and combo=0', () => {
        const result = parseQueueStateComment('#Q=[T](I)OSL');
        expect(result).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.S, Piece.L],
            b2b: false,
            combo: 0,
        });
    });

    test('parse queue state with b2b and combo metadata', () => {
        const result = parseQueueStateComment('b2b=1 | combo=3 | #Q=[T](I)OSL');
        expect(result).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.S, Piece.L],
            b2b: true,
            combo: 3,
        });
    });

    test('parse queue state when b2b and combo are in one metadata segment', () => {
        const result = parseQueueStateComment('b2b=1 combo=3 | #Q=[T](I)OSL');
        expect(result).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.S, Piece.L],
            b2b: true,
            combo: 3,
        });
    });

    test('parse queue state with score, outsideTop, b2b and combo metadata', () => {
        const result = parseQueueStateComment('score=12.30 | outsideTop=10000 | b2b=false | combo=-1 | #Q=[](I)OT');
        expect(result).toEqual({
            hold: null,
            current: Piece.I,
            queue: [Piece.O, Piece.T],
            b2b: false,
            combo: 0,
        });
    });

    test('parse legacy queue state', () => {
        const result = parseQueueStateComment('b2b=1 combo=3 | T:IOSL');
        expect(result).toEqual({
            hold: Piece.T,
            current: null,
            queue: [Piece.I, Piece.O, Piece.S, Piece.L],
            b2b: true,
            combo: 3,
        });
    });

    test('return null when metadata grammar is invalid', () => {
        expect(parseQueueStateComment('b2b=yes | combo=2 | #Q=[](I)OT')).toBeNull();
        expect(parseQueueStateComment('b2b=1  combo=2 | #Q=[](I)OT')).toBeNull();
    });

    test('parse metadata-only queue state (no queue segment)', () => {
        const result = parseQueueStateComment('score=12.30 | b2b=1 combo=2');
        expect(result).toEqual({
            hold: null,
            current: null,
            queue: [],
            b2b: true,
            combo: 2,
        });
    });

    test('parse hold-only queue state', () => {
        const result = parseQueueStateComment('b2b=1 combo=3 | #Q=[T]()');
        expect(result).toEqual({
            hold: Piece.T,
            current: null,
            queue: [],
            b2b: true,
            combo: 3,
        });
    });
});

describe('buildQueueStateComment', () => {
    test('omit default b2b/combo', () => {
        expect(buildQueueStateComment(Piece.T, Piece.I, [Piece.O], false, 0)).toBe('#Q=[T](I)O');
    });

    test('emit b2b/combo when non-default', () => {
        expect(buildQueueStateComment(Piece.T, Piece.I, [], true, 3)).toBe('b2b=1 combo=3 | #Q=[T](I)');
    });

    test('emit metadata-only when queue is empty', () => {
        expect(buildQueueStateComment(null, null, [], true, 2)).toBe('b2b=1 combo=2');
    });

    test('round-trip through parseQueueStateComment', () => {
        const built = buildQueueStateComment(Piece.T, Piece.I, [Piece.O, Piece.S], true, 2);
        expect(parseQueueStateComment(built)).toEqual({
            hold: Piece.T,
            current: Piece.I,
            queue: [Piece.O, Piece.S],
            b2b: true,
            combo: 2,
        });
    });
});

describe('hold swap logic', () => {
    test('no hold used: current is placed, next front becomes current', () => {
        // Input: #Q=[T](I)OSL, place I (no hold)
        const parsed = parseQueueComment('#Q=[T](I)OSL')!;
        const newCurrent = parsed.queue[0]; // O
        const newQueue = parsed.queue.slice(1); // [S, L]
        expect(buildQueueComment(parsed.hold, newCurrent, newQueue)).toBe('#Q=[T](O)SL');
    });

    test('hold used: swap hold and current', () => {
        // Input: #Q=[T](I)OSL, place T (hold used), I goes to hold
        const parsed = parseQueueComment('#Q=[T](I)OSL')!;
        const newHold = parsed.current; // I
        const newCurrent = parsed.queue[0]; // O
        const newQueue = parsed.queue.slice(1); // [S, L]
        expect(buildQueueComment(newHold, newCurrent, newQueue)).toBe('#Q=[I](O)SL');
    });

    test('no hold, hold used: current becomes hold, next front is placed', () => {
        // Input: #Q=[](I)OTLJSZ, hold empty, hold is used -> I goes to hold, O is placed
        const parsed = parseQueueComment('#Q=[](I)OTLJSZ')!;
        const newHold = parsed.current; // I
        const newCurrent = parsed.queue[1]; // T
        const newQueue = parsed.queue.slice(2); // [L, J, S, Z]
        expect(buildQueueComment(newHold, newCurrent, newQueue)).toBe('#Q=[I](T)LJSZ');
    });
});
