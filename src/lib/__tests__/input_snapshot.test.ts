import { GarbageQueueInitializeParams } from '@haelp/teto/engine';
import { Piece, Rotation } from '../enums';
import { Field } from '../fumen/field';
import { decode, encode } from '../fumen/fumen';
import { Page } from '../fumen/types';
import {
    InputReplayContext,
    InputReplayRules,
    advanceInputReplayContext,
    createDefaultInputReplayContext,
    inputGarbageView,
    withInputGarbageSegments,
} from '../input_replay';
import {
    buildInputSharePage,
    describeInputState,
    embedInputSnapshotsInPages,
    extractInputSnapshotsFromPages,
    findInputSnapshotTokens,
    isLeagueInputRules,
    parseInputSnapshotToken,
    serializeInputSnapshot,
    withInputSnapshot,
} from '../input_snapshot';
import { parseQueueStateComment } from '../cold_clear/queueParser';
import { appendTreeToComment, createTreeFromPages } from '../fumen/tree_utils';
import { resolvePageCommentText } from '../pages';

const stats = { b2bChain: 4, renChain: 3, pieces: 12, lines: 9, perfectClears: 1 };

const leagueWithGarbage = (): InputReplayContext => {
    const base = createDefaultInputReplayContext(stats, 987654);
    const context = withInputGarbageSegments(base, [{ amount: 4, column: 3 }, { amount: 2, column: null }]);
    context.garbage.last = { attack: 5, cancelled: 2, sent: 3, risen: 0 };
    return context;
};

const customRules = (context: InputReplayContext): InputReplayContext => {
    const options: GarbageQueueInitializeParams = {
        ...context.garbage.options,
        cap: { ...context.garbage.options.cap, value: 6, increase: 0.25 },
        messiness: { ...context.garbage.options.messiness, within: 0.3, change: 0.7 },
        multiplier: { ...context.garbage.options.multiplier, value: 1.5 },
    };
    const rules: InputReplayRules = {
        ...context.garbage.rules,
        garbageCap: 6, garbageCapIncrease: 0.25, multiplier: 1.5, comboTable: 'modern guideline',
    };
    return { ...context, garbage: { ...context.garbage, options, rules } };
};

const parse = (token: string, previous?: InputReplayContext) => {
    const result = parseInputSnapshotToken(token, previous);
    if (result.status !== 'ok') throw new Error(`parse failed: ${result.status}`);
    return result.snapshot;
};

const noClear = { type: Piece.O, rotation: Rotation.Spawn, coordinate: { x: 4, y: 0 } };

const withoutOptionsSeed = (context: InputReplayContext) => ({
    ...context,
    garbage: { ...context.garbage, options: { ...context.garbage.options, seed: 0 } },
});

const page = (overrides: Partial<Page> = {}): Page => ({
    index: 0,
    field: { obj: new Field({}) },
    comment: { text: '' },
    flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false },
    ...overrides,
});

const toToken = (pages: Page[], index: number): string => findInputSnapshotTokens(pages[index].comment.text!)[0];

describe('input snapshot token', () => {
    test('round-trips a league context as a flag, dropping the last action label', () => {
        const context = leagueWithGarbage();
        context.stats = { ...context.stats, lastAction: { clearedLines: 2, spin: 'none', perfectClear: false } };
        const token = serializeInputSnapshot(context, { rotationSystem: 'srsPlus', openInput: true });
        expect(token.startsWith('isnap=1.')).toBe(true);
        const json = JSON.parse(Buffer.from(token.slice('isnap=1.'.length), 'base64').toString());
        expect(json.g.r).toBe('league');

        const restored = parse(token);
        expect(restored.openInput).toBe(true);
        expect(restored.rotationSystem).toBe('srsPlus');
        expect(restored.context.stats).toEqual({ ...stats, lastAction: undefined });
        expect(restored.context.garbage.last).toEqual({ attack: 5, cancelled: 2, sent: 3, risen: 0 });
        expect(restored.context.garbage.columns).toEqual(context.garbage.columns);
        expect(withoutOptionsSeed(restored.context))
            .toEqual(withoutOptionsSeed({ ...context, stats: { ...context.stats, lastAction: undefined } }));
        expect(describeInputState(restored.context)).toMatchObject({
            total: 6, rules: 'league', segments: [{ amount: 4, column: 3 }, { amount: 2, column: null }],
        });
    });

    test('round-trips custom rules in full and as a "^" reference to the previous token', () => {
        const context = customRules(leagueWithGarbage());
        expect(isLeagueInputRules(context)).toBe(false);
        const full = serializeInputSnapshot(context, { rotationSystem: 'srs' });
        const restored = parse(full);
        expect(restored.openInput).toBe(false);
        expect(restored.context.garbage.options).toEqual(context.garbage.options);
        expect(restored.context.garbage.rules).toEqual(context.garbage.rules);
        expect(describeInputState(restored.context).rules).toBe('replay');

        const reference = serializeInputSnapshot(context, { rotationSystem: 'srs', previous: context });
        expect(reference.length).toBeLessThan(full.length);
        expect(parse(reference, restored.context).context.garbage.rules).toEqual(context.garbage.rules);
        expect(parseInputSnapshotToken(reference).status).toBe('invalid');
        expect(escape(withInputSnapshot('#Q=[T](I)OLJSZIOLJSZ', full)).length).toBeLessThan(4095);
    });

    test('continues the garbage RNG exactly as the original context', () => {
        const context = customRules(leagueWithGarbage());
        context.garbage.columns = undefined;
        let original = context;
        let restored = parse(serializeInputSnapshot(context, { rotationSystem: 'srsPlus' })).context;
        for (let step = 0; step < 4; step += 1) {
            expect(inputGarbageView(restored)).toEqual(inputGarbageView(original));
            const a = advanceInputReplayContext(original, new Field({}), noClear);
            const b = advanceInputReplayContext(restored, new Field({}), noClear);
            expect(b.tankRows).toEqual(a.tankRows);
            original = a.context;
            restored = parse(serializeInputSnapshot(b.context, { rotationSystem: 'srsPlus' })).context;
        }
    });

    test('rejects malformed, inconsistent and oversized payloads', () => {
        const encode64 = (value: unknown) => `isnap=1.${Buffer.from(JSON.stringify(value)).toString('base64')
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
        const valid = JSON.parse(Buffer.from(
            serializeInputSnapshot(customRules(leagueWithGarbage()), { rotationSystem: 'srs' }).slice(8), 'base64',
        ).toString());
        const mutate = (change: (payload: any) => void) => {
            const payload = JSON.parse(JSON.stringify(valid));
            change(payload);
            return parseInputSnapshotToken(encode64(payload)).status;
        };
        expect(mutate(() => undefined)).toBe('ok');
        expect(parseInputSnapshotToken('isnap=2.e30').status).toBe('unsupported');
        expect(mutate((p) => { p.v = 2; })).toBe('unsupported');
        expect(parseInputSnapshotToken('isnap=1.@@@').status).toBe('invalid');
        expect(parseInputSnapshotToken('isnap=1.bm90IGpzb24').status).toBe('invalid');
        expect(mutate((p) => { p.rs = 'tgm'; })).toBe('invalid');
        expect(mutate((p) => { p.s[0] = -1; })).toBe('invalid');
        expect(mutate((p) => { p.s = [1, 2, 3]; })).toBe('invalid');
        expect(mutate((p) => { p.g.q[0][1] = 0; })).toBe('invalid');
        expect(mutate((p) => { p.g.q[1][2] = p.g.q[0][2]; })).toBe('invalid');
        expect(mutate((p) => { p.g.q[0][3] = 2; })).toBe('invalid');
        expect(mutate((p) => { p.g.q = Array.from({ length: 201 }, (_, cid) => [0, 1, cid + 1, 1]); }))
            .toBe('invalid');
        expect(mutate((p) => { p.g.c = { 999: 3 }; })).toBe('invalid');
        expect(mutate((p) => { p.g.c = { [String(p.g.q[0][2])]: 10 }; })).toBe('invalid');
        expect(mutate((p) => { p.g.n[2] = 12; })).toBe('invalid');
        expect(mutate((p) => { delete p.g.r.u.comboTable; })).toBe('invalid');
        expect(mutate((p) => { p.g.r.u.garbageSpeed = 99; })).toBe('invalid');
        expect(mutate((p) => { p.g.r.o.extra = 1; })).toBe('invalid');
        expect(mutate((p) => { p.g.r = '^'; })).toBe('invalid');
        expect(mutate((p) => { p.g.l = [1, 2]; })).toBe('invalid');
        // A garbage editor segment added at frame 0 becomes ready at frame - speed, which is negative.
        expect(mutate((p) => { p.g.q[0][0] = -20; })).toBe('ok');
        expect(mutate((p) => { p.g.r.u.multiplier = 1.5; p.g.r.o.multiplier.value = 1.5; })).toBe('ok');
    });
});

describe('input snapshot comments', () => {
    test('adds, replaces and removes only the token, and the queue parser ignores it', () => {
        const text = withInputSnapshot('b2b=2 combo=1 | #Q=[T](I)OL', 'isnap=1.abc');
        expect(text).toBe('isnap=1.abc | b2b=2 combo=1 | #Q=[T](I)OL');
        expect(withInputSnapshot(text, 'isnap=1.def')).toBe('isnap=1.def | b2b=2 combo=1 | #Q=[T](I)OL');
        expect(withInputSnapshot(text, undefined)).toBe('b2b=2 combo=1 | #Q=[T](I)OL');
        expect(parseQueueStateComment(text)).toMatchObject({
            hold: Piece.T, current: Piece.I, queue: [Piece.O, Piece.L], b2bLevel: 2, combo: 1,
        });
    });
});

describe('input snapshot pages', () => {
    const quizPages = (): Page[] => [
        page({
            comment: { text: '#Q=[](T)IOLJ' },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: true },
            piece: { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 1, y: 0 } },
        }),
        page({
            index: 1,
            field: { ref: 0 },
            comment: { ref: 0 },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: true },
            piece: { type: Piece.I, rotation: Rotation.Spawn, coordinate: { x: 5, y: 0 } },
            internal: { inputReplayContext: leagueWithGarbage() },
        }),
        page({
            index: 2,
            field: { ref: 0 },
            comment: { ref: 0 },
            flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: true },
            piece: { type: Piece.O, rotation: Rotation.Spawn, coordinate: { x: 1, y: 1 } },
        }),
        page({
            index: 3,
            field: { ref: 0 },
            comment: { text: 'note' },
            internal: { inputReplayContext: customRules(leagueWithGarbage()) },
        }),
        page({
            index: 4,
            field: { ref: 0 },
            comment: { ref: 3 },
            internal: { inputReplayContext: customRules(leagueWithGarbage()) },
        }),
    ];

    test('keeps every page comment, queue and quiz flag through embed, encode, decode and extract', async () => {
        const pages = quizPages();
        const embedded = embedInputSnapshotsInPages(pages, { rotationSystem: 'srsPlus' });
        expect(embedded.skipped).toEqual([]);
        // The fourth page's rules equal the third written token's, so it only refers to them.
        expect(JSON.parse(Buffer.from(toToken(embedded.pages, 4).slice(8), 'base64').toString()).g.r).toBe('^');

        const decoded = await decode(`v115@${await encode(embedded.pages)}`);
        const { pages: restored, snapshots } = extractInputSnapshotsFromPages(decoded);
        for (let index = 0; index < pages.length; index += 1) {
            expect(resolvePageCommentText(restored, index)).toBe(resolvePageCommentText(pages, index));
            expect(parseQueueStateComment(resolvePageCommentText(restored, index)))
                .toEqual(parseQueueStateComment(resolvePageCommentText(pages, index)));
            expect(restored[index].flags.quiz).toBe(pages[index].flags.quiz);
            expect(restored[index].internal?.inputReplayContext !== undefined)
                .toBe(pages[index].internal?.inputReplayContext !== undefined);
            expect(restored[index].comment.text ?? '').not.toContain('isnap=');
        }
        expect(snapshots[3]?.context.garbage.rules).toEqual(pages[3].internal!.inputReplayContext!.garbage.rules);
        expect(snapshots[4]?.context.garbage.rules).toEqual(pages[4].internal!.inputReplayContext!.garbage.rules);
    });

    test('leaves pages without tokens untouched', () => {
        const pages = [page({ comment: { text: '#Q=[](T)IO' } }), page({ index: 1, comment: { ref: 0 } })];
        expect(extractInputSnapshotsFromPages(pages).pages).toBe(pages);
        const plain = [page({ comment: { text: 'hello' } })];
        expect(embedInputSnapshotsInPages(plain, { rotationSystem: 'srs' }).pages).toBe(plain);
    });

    test('skips a page whose comment would exceed the limit and writes the next rules in full', () => {
        const pages = quizPages();
        pages[3] = { ...pages[3], comment: { text: 'x'.repeat(4000) } };
        pages[4] = { ...pages[4], comment: { text: 'short' } };
        const embedded = embedInputSnapshotsInPages(pages, { rotationSystem: 'srsPlus' });
        expect(embedded.skipped).toEqual([3]);
        expect(embedded.pages[3]).toBe(pages[3]);
        expect(JSON.parse(Buffer.from(toToken(embedded.pages, 4).slice(8), 'base64').toString()).g.r)
            .toEqual(expect.objectContaining({ o: expect.any(Object), u: expect.any(Object) }));
    });

    test('reserves room for #TREE= on a first page with its own context; the tree wins', () => {
        const pages = quizPages();
        pages[0] = { ...pages[0], internal: { inputReplayContext: leagueWithGarbage() } };
        const tree = createTreeFromPages(pages);
        const withRoom = embedInputSnapshotsInPages(pages, { tree, rotationSystem: 'srsPlus' });
        expect(withRoom.skipped).toEqual([]);
        expect(escape(appendTreeToComment(withRoom.pages[0].comment.text!, tree)).length).toBeLessThanOrEqual(4095);

        const token = serializeInputSnapshot(leagueWithGarbage(), { rotationSystem: 'srsPlus' });
        const treeLength = escape(appendTreeToComment('', tree)).length + 1;
        // Fits without the tree, not with it.
        const base = escape(withInputSnapshot('x | #Q=[](T)IOLJ', token)).length - 1;
        const filler = 'x'.repeat(4095 - Math.floor(treeLength / 2) - base);
        pages[0] = { ...pages[0], comment: { text: `${filler} | #Q=[](T)IOLJ` } };
        pages[1] = { ...pages[1], comment: { text: '#Q=[](I)OLJ' } };
        expect(embedInputSnapshotsInPages(pages, { rotationSystem: 'srsPlus' }).skipped).toEqual([]);
        expect(embedInputSnapshotsInPages(pages, { tree, rotationSystem: 'srsPlus' }).skipped).toEqual([0]);
    });

    test('skips a context the loader would reject instead of saving a dead token', () => {
        const pages = quizPages();
        const broken = customRules(leagueWithGarbage());
        broken.garbage.rules = { ...broken.garbage.rules, spinBonuses: 'not<valid>' };
        pages[3] = { ...pages[3], internal: { inputReplayContext: broken } };
        const embedded = embedInputSnapshotsInPages(pages, { rotationSystem: 'srsPlus' });
        expect(embedded.skipped).toEqual([3]);
        expect(parseInputSnapshotToken(toToken(embedded.pages, 4)).status).toBe('ok');
    });

    test('drops the context of a page with two tokens or an unknown version', () => {
        const token = serializeInputSnapshot(leagueWithGarbage(), { rotationSystem: 'srs' });
        const result = extractInputSnapshotsFromPages([
            page({ comment: { text: `${token} ${token} | #Q=[](T)` } }),
            page({ index: 1, comment: { text: 'isnap=9.abc | #Q=[](I)' } }),
        ]);
        expect(result.pages[0].internal?.inputReplayContext).toBeUndefined();
        expect(result.pages[0].comment.text).toBe('#Q=[](T)');
        expect(result.pages[0].flags.quiz).toBe(true);
        expect(result.pages[1].comment.text).toBe('#Q=[](I)');
        expect(result.unsupported).toBe(true);
    });
});

describe('input share page', () => {
    test('builds one spawn-position page with current counters and no INPUT-only metadata', () => {
        const context = leagueWithGarbage();
        const pages: Page[] = [
            page({ flags: { lock: true, mirror: false, colorize: false, rise: false, quiz: false } }),
            page({
                index: 1,
                comment: { text: 'inputRotation=cw:2 b2b=1 score=1.00 | #Q=[S](T)IOL' },
                piece: { type: Piece.T, rotation: Rotation.Left, coordinate: { x: 1, y: 3 } },
                internal: { inputReplayContext: context },
            }),
        ];
        const result = buildInputSharePage(pages, 1, { rotationSystem: 'srsPlus', seed: 1 });
        if (result.status !== 'ok') throw new Error(result.status);
        const text = result.page.comment.text!;
        expect(text).not.toContain('inputRotation=');
        expect(withInputSnapshot(text, undefined)).toBe('b2b=4 combo=3 | score=1.00 | #Q=[S](T)IOL');
        expect(result.page.piece).toEqual({ type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 4, y: 20 } });
        expect(result.page.flags.colorize).toBe(false);
        const snapshot = parse(findInputSnapshotTokens(text)[0]);
        expect(snapshot.openInput).toBe(true);
        expect(snapshot.context.stats).toEqual({ ...stats, lastAction: undefined });
    });

    test('shares a page without its own context with league rules and no garbage', () => {
        const pages: Page[] = [page({ comment: { text: 'b2b=3 combo=2 | #Q=[](T)IO' } })];
        const result = buildInputSharePage(pages, 0, { rotationSystem: 'srsPlus', seed: 7 });
        if (result.status !== 'ok') throw new Error(result.status);
        expect(isLeagueInputRules(result.context)).toBe(true);
        expect(result.context.garbage.snapshot.queue).toEqual([]);
        expect(result.context.stats).toMatchObject({ b2bChain: 3, renChain: 2 });
    });

    test('takes 7bag gray totals as the shared totals and does not pass the bag progress', () => {
        const rowMap = Array.from({ length: 23 }, (_, i) => i.toString(36)).join('.');
        const text = `sbg=2,9,4,1 sbgd=${'0'.repeat(230)}:${rowMap} | #Q=[](T)IO`;
        const pages: Page[] = [page({ comment: { text } })];
        const result = buildInputSharePage(pages, 0, { rotationSystem: 'srsPlus', seed: 7 });
        if (result.status !== 'ok') throw new Error(result.status);
        expect(result.context.stats).toMatchObject({ pieces: 9, lines: 4, perfectClears: 1 });
        expect(withInputSnapshot(result.page.comment.text!, undefined)).toBe('#Q=[](T)IO');
    });

    test('refuses a comment that would exceed the fumen limit', () => {
        const pages: Page[] = [page({ comment: { text: `${'あ'.repeat(700)} | #Q=[](T)` } })];
        expect(buildInputSharePage(pages, 0, { rotationSystem: 'srs', seed: 1 }).status).toBe('tooLong');
    });
});
