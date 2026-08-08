import { Page } from '../fumen/types';
import { irFieldToField } from './board_converter';
import { IRField } from './types';

// FR-50: one IR point -> one standalone key page. No refs, no comment
// (#Q= / #TREE= are out of scope until P4), colorize set explicitly because
// the generated page always becomes the first page of a new fumen.
export const irPointToPage = (cells: IRField): Page => {
    return {
        index: 0,
        field: { obj: irFieldToField(cells) },
        comment: { text: '' },
        flags: {
            lock: true,
            colorize: true,
            mirror: false,
            quiz: false,
            rise: false,
        },
    };
};
