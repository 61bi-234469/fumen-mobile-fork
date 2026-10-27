import { default as i18next } from 'i18next';
import { resources as resourcesEn } from '../../../locales/en/translation';
import { resources as resourcesJa } from '../../../locales/ja/translation';
import { InputStats } from '../../../lib/input_stats';
import { inputChainPanel, inputStatsPanel, shownB2b, shownCombo } from '../input_stats_panel';

const stats: InputStats = { b2bChain: 0, renChain: 0, pieces: 3, lines: 2, perfectClears: 0 };

const labelsOf = (vnode: any): { [datatest: string]: string } => {
    const labels: { [datatest: string]: string } = {};
    for (const row of vnode.children) {
        const key = row.attributes && row.attributes.datatest;
        const label = row.children && row.children[0] && row.children[0].children;
        if (typeof key === 'string' && Array.isArray(label) && typeof label[0] === 'string') {
            labels[key] = label[0];
        }
    }
    return labels;
};

describe('inputStatsPanel', () => {
    beforeAll(async () => {
        await i18next.init({
            lng: 'en',
            resources: { en: { translation: resourcesEn }, ja: { translation: resourcesJa } },
        });
    });

    it.each(['en', 'ja'])('writes every row label in upper case (%s)', async (lng) => {
        await i18next.changeLanguage(lng);
        const labels = labelsOf(inputStatsPanel(stats, 'summary', { last: undefined }));
        expect(labels).toMatchObject({
            'input-stats-b2b': 'B2B',
            'input-stats-combo': 'COMBO',
            'input-garbage-damage': 'ATTACK',
        });
        Object.values(labels).forEach(label => expect(label).toBe(label.toUpperCase()));
    });

    it('counts B2B and COMBO like s2-bot-lab', () => {
        expect([0, 1, 5].map(chain => shownB2b(chain))).toEqual(['—', '0', '4']);
    });

    it('caps B2B at 1 for SRS and shows none for classic', () => {
        expect([0, 1, 5].map(chain => shownB2b(chain, 'ppt'))).toEqual(['—', '1', '1']);
        expect([0, 1, 5].map(chain => shownB2b(chain, 'none'))).toEqual(['—', '—', '—']);
        const [srsB2b] = inputChainPanel({ ...stats, b2bChain: 6 }, { preset: 'ppt', surgeChargeAt: 4 }).children
            .map((row: any) => row.attributes);
        expect(srsB2b).toMatchObject({ 'data-active': 'true' });
        expect(srsB2b['data-surge']).toBeUndefined();
        const [classicB2b] = inputChainPanel({ ...stats, b2bChain: 6 }, { preset: 'none' }).children
            .map((row: any) => row.attributes);
        expect(classicB2b).toMatchObject({ 'data-active': 'false', 'data-value': '' });
        expect([0, 1, 2, 4].map(shownCombo)).toEqual(['—', '—', '1', '3']);
    });

    it('marks active chains and a charged Surge', () => {
        const rows = (vnode: any) => vnode.children.map((row: any) => row.attributes);
        const [b2b, combo] = rows(inputChainPanel({ ...stats, b2bChain: 5, renChain: 1 }, { surgeChargeAt: 4 }));
        expect(b2b).toMatchObject({ 'data-active': 'true', 'data-surge': 'true' });
        expect(combo).toMatchObject({ 'data-active': 'false' });
        const [quiet] = rows(inputChainPanel({ ...stats, b2bChain: 4 }, { surgeChargeAt: 4 }));
        expect(quiet['data-surge']).toBeUndefined();
    });
});
