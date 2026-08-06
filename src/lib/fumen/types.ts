import { Piece, Rotation } from '../enums';
import { Field } from './field';

export interface Action {
    piece: {
        type: Piece;
        rotation: Rotation;
        coordinate: {
            x: number,
            y: number,
        };
    };
    rise: boolean;
    mirror: boolean;
    colorize: boolean;
    comment: boolean;
    lock: boolean;
}

export interface Move {
    type: Piece;
    rotation: Rotation;
    coordinate: {
        x: number;
        y: number;
    };
}

export interface Page {
    index: number;
    field: {
        obj?: Field;
        ref?: number;
    };
    piece?: Move;
    comment: {
        text?: string;
        ref?: number;
    };
    commands?: {
        pre: {
            [key in string]: PreCommand;
        };
    };
    flags: {
        lock: boolean;
        mirror: boolean;
        colorize: boolean;
        rise: boolean;
        quiz: boolean;
    };
    /** Editor-only working data. Fumen encoding intentionally ignores this object. */
    internal?: {
        sevenBagGrayProgress?: {
            bag: number;
            pieces: number;
            lines: number;
            perfectClears: number;
        };
        sevenBagGrayDisplay?: {
            pieces: number[];
            rowMap: number[];
        };
        /** A detached INPUT workspace created to protect later pages/branches. */
        sevenBagGrayWorkspace?: boolean;
    };
}

export type PreCommand = BlockAction;

export interface BlockAction {
    type: 'block' | 'sentBlock';
    x: number;
    y: number;
    piece: Piece;
}
