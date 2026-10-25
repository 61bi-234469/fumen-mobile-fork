import { default as i18next } from 'i18next';
import { resources as resourcesEn } from '../../../locales/en/translation';
import { resources as resourcesJa } from '../../../locales/ja/translation';
import { InputStats } from '../../../lib/input_stats';
import { inputStatsPanel } from '../input_stats_panel';

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
        const labels = labelsOf(inputStatsPanel(stats, 'full', { last: undefined }));
        expect(labels).toMatchObject({
            'input-stats-b2b': 'B2B',
            'input-stats-combo': 'COMBO',
            'input-garbage-damage': 'ATTACK',
            'input-stats-total-pieces': 'PIECES',
            'input-stats-total-lines': 'LINES',
            'input-stats-total-pc': 'PC',
        });
        Object.values(labels).forEach(label => expect(label).toBe(label.toUpperCase()));
    });
});
