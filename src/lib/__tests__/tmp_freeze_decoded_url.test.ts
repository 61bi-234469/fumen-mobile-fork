// Temporary investigation test - DO NOT COMMIT (delete after investigation)
import { decode } from '../fumen/fumen';

const rawUrl = 'https://tetristemplate.info/tetgram/?d=v115%40ngwhIewhIewhHeQ4whAeh0EeR4Aeg0RpBtywQ4glg0%3FRpAeBtwwilJeQg0DAU9zBAefi0Gehlg0HeglIegldeRpHeQ%3FpglIeQ4BeAtCeilQ4whBtBeQ4glg0QaQ4whgWgHBeR4g0yh%3FglwwglxhglwhQpwhQaglywBtQpi0JeAAPMARYcRAyv78AQ%2B%3FT7BefiHGehWgHHegWIegWceAtwhwSHeyhFeglA8Aewhg0gl%3FBeQpwhAeg0BeglAPBeAPwhBPBeglA8xwgWwhglBeQ4BehlQ%3FpwhglBeQ4AeRaQeAAPSARYcRAyv78Aw87tCFbEwCz2AAASg%3FwhHeAPwSGeRpwSgWQaEeQpwhwDgHQaBeAtAexSg0AegHwhA%3FeBtAexSgWg0AeQ4AeAPCeAAheAAPSARYcRAyv78Aw87tCFb%3FEwCTNBAAJgwhGeQpglwhFeQ4QpglwhFeBtQ4QaAeh0AtBew%3FSAtQ4AeglAegWCeA8Beg0CeAPBeB8BegHglAtQpRLGewhwD%3FySDexhQpAewSNeAAPMARYcRAyv78AQ%2B7tCGgRpAeQaFeQpA%3FewSQ4whh0AtBewDxwQ4whg0BtBexhAeQ4whAegWAPBeA8wh%3FAeg0QaglBtxwwSCeg0glAtA8R4Deg0BeQaQ4wwA8GeglxSQ%3FpFegHAeQpNeAAPyARYcRAyvL2AhyT7BFbssCTd88AQ%2BT7BF%3FbMLEyI8vBT9rSASY9tCEoo2AMNKSAwxAAAGgxSHexSAeAAQ%3FahHAPCeCAQagHBPBeDAQagHAPCeDAQaCARLQpAeFAxDBeAA%3FDewhwDQLAAGehWg0FeAAgWAAOeAAPVAT9rSASY9tCEY3JB3%3FccRA1AmLBSAAAARgg0Ieg0Heh0glBewhDeilRpwhAeAtBeA%3FAAeA8RpwhBtwwAeBAA8BewDAPwSwwHeQaQ4A8FeQaQ4wwA8%3FOeAAPSARYcRAyv78Aw87tCFbEwCTNBAARggWwhGeAtgWwhG%3FegWglQaBewhhlBegWg0QaBewhg0glBeA8DeQ4glAPQLAeB8%3FCeQ4glQpAexwFexhwSRaDexhQpRaNeAAPSARYcRAyv78Aw8%3F7tCFbEwCz2AAAHgg0IeglQaGehlwhBewhDegWgHwhBeQagW%3FglDeQ4xSQahWGewDgWFeRLAeglKeQaglxhEeRagWwhNeAAA%3FHggHIegWwhGehWQaBeQaDeglg0QaBewhglgWDewDBewhhlE%3FexSQ4glIegWFeRLdeAAARgAPQaGeBPQaGeAPAAQaBeiWDeQ%3F4BegWhHGeAAgHFexSAeglAeSLBexSCexDCeBABexDQLOeAA%3FPAA';

// The clipboard variant where the URL was already percent-decoded once
// (e.g. copied from a browser address bar that displays the decoded form)
const decodedUrl = decodeURIComponent(rawUrl);

// Mirror of parseClipboardInput in src/actions/list_view.ts
const parseLikeApp = (value: string): string | null => {
    const trimmed = value.trim();
    try {
        const url = new URL(trimmed);
        const hash = url.hash.startsWith('#?') ? url.hash.slice(2) : url.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hash);
        const searchParams = url.searchParams;
        const dParam = hashParams.get('d') ?? searchParams.get('d');
        if (dParam) {
            try {
                return decodeURIComponent(dParam);
            } catch {
                return dParam;
            }
        }
    } catch {
        // not a URL
    }
    return null;
};

describe('tmp decoded-url clipboard variant', () => {
    it('shows what the app extracts from the decoded URL', () => {
        const fumen = parseLikeApp(decodedUrl) as string;
        // tslint:disable-next-line:no-console
        console.log('extracted head:', JSON.stringify(fumen.slice(0, 80)));
        // tslint:disable-next-line:no-console
        console.log(
            'contains space:',
            fumen.includes(' '),
            '| contains +:',
            fumen.includes('+'),
            '| length:',
            fumen.length,
        );
    });

    it('decodes the extracted fumen (10s timeout)', async () => {
        const fumen = parseLikeApp(decodedUrl) as string;
        const timer = new Promise<string>(resolve => setTimeout(() => resolve('TIMEOUT'), 10000));
        const work = decode(fumen).then(
            pages => `OK pages=${pages.length}`,
            (err: any) => `ERROR ${err}`,
        );
        const result = await Promise.race([work, timer]);
        // tslint:disable-next-line:no-console
        console.log('decode result:', result);
    }, 15000);
});
