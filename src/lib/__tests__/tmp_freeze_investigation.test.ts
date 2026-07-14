// Temporary investigation test - DO NOT COMMIT (delete after investigation)
import { decode } from '../fumen/fumen';

const rawUrl = 'https://tetristemplate.info/tetgram/?d=v115%40ngwhIewhIewhHeQ4whAeh0EeR4Aeg0RpBtywQ4glg0%3FRpAeBtwwilJeQg0DAU9zBAefi0Gehlg0HeglIegldeRpHeQ%3FpglIeQ4BeAtCeilQ4whBtBeQ4glg0QaQ4whgWgHBeR4g0yh%3FglwwglxhglwhQpwhQaglywBtQpi0JeAAPMARYcRAyv78AQ%2B%3FT7BefiHGehWgHHegWIegWceAtwhwSHeyhFeglA8Aewhg0gl%3FBeQpwhAeg0BeglAPBeAPwhBPBeglA8xwgWwhglBeQ4BehlQ%3FpwhglBeQ4AeRaQeAAPSARYcRAyv78Aw87tCFbEwCz2AAASg%3FwhHeAPwSGeRpwSgWQaEeQpwhwDgHQaBeAtAexSg0AegHwhA%3FeBtAexSgWg0AeQ4AeAPCeAAheAAPSARYcRAyv78Aw87tCFb%3FEwCTNBAAJgwhGeQpglwhFeQ4QpglwhFeBtQ4QaAeh0AtBew%3FSAtQ4AeglAegWCeA8Beg0CeAPBeB8BegHglAtQpRLGewhwD%3FySDexhQpAewSNeAAPMARYcRAyv78AQ%2B7tCGgRpAeQaFeQpA%3FewSQ4whh0AtBewDxwQ4whg0BtBexhAeQ4whAegWAPBeA8wh%3FAeg0QaglBtxwwSCeg0glAtA8R4Deg0BeQaQ4wwA8GeglxSQ%3FpFegHAeQpNeAAPyARYcRAyvL2AhyT7BFbssCTd88AQ%2BT7BF%3FbMLEyI8vBT9rSASY9tCEoo2AMNKSAwxAAAGgxSHexSAeAAQ%3FahHAPCeCAQagHBPBeDAQagHAPCeDAQaCARLQpAeFAxDBeAA%3FDewhwDQLAAGehWg0FeAAgWAAOeAAPVAT9rSASY9tCEY3JB3%3FccRA1AmLBSAAAARgg0Ieg0Heh0glBewhDeilRpwhAeAtBeA%3FAAeA8RpwhBtwwAeBAA8BewDAPwSwwHeQaQ4A8FeQaQ4wwA8%3FOeAAPSARYcRAyv78Aw87tCFbEwCTNBAARggWwhGeAtgWwhG%3FegWglQaBewhhlBegWg0QaBewhg0glBeA8DeQ4glAPQLAeB8%3FCeQ4glQpAexwFexhwSRaDexhQpRaNeAAPSARYcRAyv78Aw8%3F7tCFbEwCz2AAAHgg0IeglQaGehlwhBewhDegWgHwhBeQagW%3FglDeQ4xSQahWGewDgWFeRLAeglKeQaglxhEeRagWwhNeAAA%3FHggHIegWwhGehWQaBeQaDeglg0QaBewhglgWDewDBewhhlE%3FexSQ4glIegWFeRLdeAAARgAPQaGeBPQaGeAPAAQaBeiWDeQ%3F4BegWhHGeAAgHFexSAeglAeSLBexSCexDCeBABexDQLOeAA%3FPAA';

describe('tmp freeze investigation', () => {
    it('decodes the tetgram URL d param', async () => {
        const url = new URL(rawUrl);
        const dParam = url.searchParams.get('d') as string;
        let fumen: string;
        try {
            fumen = decodeURIComponent(dParam);
        } catch {
            fumen = dParam;
        }
        const pages = await decode(fumen);
        // tslint:disable-next-line:no-console
        console.log('decoded pages:', pages.length);
        expect(pages.length).toBeGreaterThan(0);
    }, 15000);
});
