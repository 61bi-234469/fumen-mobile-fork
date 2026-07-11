import { RotationSystem } from '../states';
import { Page } from './fumen/types';

/** Return the Fumen palette flag associated with a rotation system. */
export const guideLineColorFromRotationSystem = (rotationSystem: RotationSystem): boolean => {
    return rotationSystem !== 'classic';
};

export const synchronizeFirstPageColorize = (
    pages: Page[],
    colorize: boolean,
): { pages: Page[], changed: boolean } => {
    if (pages[0] === undefined || pages[0].flags.colorize === colorize) {
        return { pages, changed: false };
    }

    return {
        pages: pages.map((page, index) => index === 0
            ? {
                ...page,
                flags: {
                    ...page.flags,
                    colorize,
                },
            }
            : page),
        changed: true,
    };
};
