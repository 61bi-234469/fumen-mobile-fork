import { button, div, span } from '@hyperapp/html';
import { Piece } from '../../lib/enums';
import { State } from '../../states';
import { Actions } from '../../actions';
import { decidePieceColor } from '../../lib/colors';
import { i18n } from '../../locales/keys';

let menuDrag: { dx: number, dy: number } | null = null;
let suppressPartClickUntil = 0;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const actionButton = (key: string, label: string, onclick: () => void, disabled = false) => button({
    key, disabled, onclick, datatest: key,
    style: {
        minWidth: '36px', height: '32px', border: '1px solid #777', borderRadius: '6px',
        background: disabled ? '#ddd' : '#fff', color: '#333', padding: '0 7px', flex: '0 0 auto',
    },
}, label);

export const FloatingMenu = ({ state, actions, layout }: {
    state: State;
    actions: Actions;
    layout: { field: { topLeft: { x: number, y: number }, blockSize: number } };
}) => {
    if (!state.floatingMenu.enabled) return undefined as any;
    const hasSelection = state.rectSelect.phase === 'selected' || state.rectSelect.phase === 'floating';
    const position = state.floatingMenu.position;
    const rowStyle = {
        display: 'flex', gap: '4px', overflowX: 'auto', padding: '4px', alignItems: 'center',
    };
    const minos = [Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S];
    const colors = [...minos, Piece.Gray, Piece.Empty];
    const getHost = () => document.getElementById('field-top');
    const clampPosition = (element: HTMLElement, candidate: { x: number, y: number }) => {
        const host = getHost();
        if (!host) return candidate;
        const hostBounds = host.getBoundingClientRect();
        const menuBounds = element.getBoundingClientRect();
        const scale = state.floatingMenu.scale || 1;
        return {
            x: clamp(candidate.x, 0, Math.max(0, (hostBounds.width - menuBounds.width) / scale)),
            y: clamp(candidate.y, 0, Math.max(0, (hostBounds.height - menuBounds.height) / scale)),
        };
    };
    const normalizePosition = (element: HTMLElement) => {
        if (!position) return;
        const normalized = clampPosition(element, position);
        if (normalized.x !== position.x || normalized.y !== position.y) {
            actions.setFloatingMenuPosition({ position: normalized });
        }
    };
    const startMenuDrag = (event: PointerEvent) => {
        const menu = (event.currentTarget as HTMLElement).parentElement!;
        const host = getHost();
        if (!host) return;
        const bounds = menu.getBoundingClientRect();
        const hostBounds = host.getBoundingClientRect();
        menuDrag = { dx: event.clientX - bounds.left, dy: event.clientY - bounds.top };
        const move = (moveEvent: PointerEvent) => {
            if (!menuDrag) return;
            const next = clampPosition(menu, {
                x: moveEvent.clientX - hostBounds.left - menuDrag.dx,
                y: moveEvent.clientY - hostBounds.top - menuDrag.dy,
            });
            actions.setFloatingMenuPosition({
                position: next,
                persist: false,
            });
        };
        const end = (upEvent: PointerEvent) => {
            move(upEvent);
            const current = menuDrag;
            menuDrag = null;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            if (current) {
                const next = clampPosition(menu, {
                    x: upEvent.clientX - hostBounds.left - current.dx,
                    y: upEvent.clientY - hostBounds.top - current.dy,
                });
                actions.setFloatingMenuPosition({ position: next });
            }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        event.preventDefault();
    };
    const startPartDrag = (event: PointerEvent, partId: string, width: number, height: number) => {
        const start = { x: event.clientX, y: event.clientY };
        let dragging = false;
        const position = (pointer: PointerEvent) => {
            const canvas = document.getElementById('canvas-container');
            if (!canvas) return null;
            const bounds = canvas.getBoundingClientRect();
            const cell = layout.field.blockSize + 1;
            const x = Math.floor((pointer.clientX - bounds.left - layout.field.topLeft.x) / cell);
            const screenY = Math.floor((pointer.clientY - bounds.top - layout.field.topLeft.y) / cell);
            const y = 22 - screenY;
            if (x < 0 || 10 <= x || y < 0 || 23 <= y) return null;
            return { x: x - Math.floor(width / 2), y: y - Math.floor(height / 2) };
        };
        const move = (moveEvent: PointerEvent) => {
            if (!dragging && Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < 8) return;
            dragging = true;
            const target = position(moveEvent);
            if (target) actions.stampPartAt({ partId, ...target });
        };
        const end = (upEvent: PointerEvent) => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            if (!dragging) return;
            suppressPartClickUntil = Date.now() + 300;
            const target = position(upEvent);
            if (target) actions.stampPartAt({ partId, ...target });
            else actions.cancelRectSelect();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
    };
    return div({
        key: 'rect-floating-menu', datatest: 'rect-floating-menu',
        style: {
            position: 'absolute', zIndex: 20, width: 'min(440px, calc(100vw - 110px))',
            left: position ? `${position.x}px` : undefined,
            top: position ? `${position.y}px` : undefined,
            right: position ? undefined : '90px', bottom: position ? undefined : '86px',
            transform: `scale(${state.floatingMenu.scale})`, transformOrigin: 'top left',
            background: 'rgba(40,40,40,.96)', border: '1px solid #777', borderRadius: '9px',
            boxShadow: '0 3px 12px rgba(0,0,0,.45)', color: '#fff', touchAction: 'none',
        },
        oncreate: normalizePosition,
        onupdate: normalizePosition,
    }, [
        div({
            style: { ...rowStyle, justifyContent: 'space-between', cursor: 'move' },
            onpointerdown: startMenuDrag,
        }, [
            span({}, i18n.RectSelect.Title()),
            div({}, [
                actionButton('btn-rect-scale-down', 'A−', () => actions.setFloatingMenuScale({
                    scale: state.floatingMenu.scale - 0.25,
                })),
                actionButton('btn-rect-scale-up', 'A+', () => actions.setFloatingMenuScale({
                    scale: state.floatingMenu.scale + 0.25,
                })),
                actionButton('btn-rect-menu-close', '×', () => actions.setFloatingMenuEnabled({ enabled: false })),
            ]),
        ]),
        div({ style: rowStyle }, [
            actionButton('btn-rect-select-action', i18n.RectSelect.Select(), actions.startRectSelectMode),
            actionButton('btn-part-paste', i18n.RectSelect.Paste(), actions.pastePart, state.parts.items.length === 0),
            actionButton('btn-part-copy', i18n.RectSelect.Copy(), actions.copySelectionToParts, !hasSelection),
            actionButton('btn-part-cut', i18n.RectSelect.Cut(), actions.cutSelectionToParts, !hasSelection),
            actionButton('btn-part-delete-selection', i18n.RectSelect.Delete(), actions.deleteSelection, !hasSelection),
            actionButton('btn-part-mirror', i18n.RectSelect.Mirror(), actions.mirrorSelection, !hasSelection),
            actionButton(
                'btn-black-transparent',
                `${state.mode.blackTransparentPaste ? '●' : '○'} ${i18n.RectSelect.BlackTransparent()}`,
                actions.toggleBlackTransparentPaste,
            ),
        ]),
        div({ style: rowStyle }, colors.map(piece => button({
            key: `rect-color-${piece}`, datatest: `rect-color-${piece}`,
            title: Piece[piece],
            onclick: () => {
                actions.changeToDrawingToolMode();
                actions.selectPieceColor({ piece });
            },
            style: {
                width: '30px', height: '30px', flex: '0 0 auto', borderRadius: '50%',
                border: '2px solid #fff',
                background: piece === Piece.Empty ? '#222' : decidePieceColor(piece, undefined, true),
            },
        }, '')).concat([button({
            key: 'rect-color-comp', datatest: 'rect-color-comp',
            title: 'COMP',
            onclick: () => {
                actions.changeToDrawingToolMode();
                actions.selectInferencePieceColor();
            },
            style: {
                width: '30px', height: '30px', flex: '0 0 auto', borderRadius: '50%',
                border: '2px solid #fff', background: '#555', color: '#fff', padding: 0,
            },
        }, 'C')])),
        div({ style: rowStyle }, minos.map(piece => actionButton(
            `rect-mino-${piece}`, Piece[piece], () => {
                if (state.floatingMenu.spawnAsParts) {
                    actions.placePieceAsPart({ piece });
                } else {
                    actions.spawnPiece({ piece, srs: state.mode.rotationSystem !== 'classic' });
                    actions.changeToMovePieceMode();
                }
            },
        )).concat([
            actionButton(
                'btn-spawn-as-part', state.floatingMenu.spawnAsParts ? 'Parts ✓' : 'Parts',
                actions.toggleSpawnAsParts,
            ),
        ])),
        div({ style: rowStyle }, state.parts.items.length === 0
            ? [span({ style: { opacity: '.7', padding: '6px' } }, i18n.RectSelect.NoParts())]
            : state.parts.items.map(part => div({
                key: part.id,
                style: {
                    display: 'flex', flex: '0 0 auto', alignItems: 'center', borderRadius: '5px',
                    border: state.parts.selectedId === part.id ? '2px solid #fff' : '1px solid #777',
                    background: '#222', padding: '2px',
                },
            }, [
                button({
                    datatest: `part-${part.id}`, title: i18n.RectSelect.Stamp(),
                    onpointerdown: (event: PointerEvent) => startPartDrag(event, part.id, part.width, part.height),
                    onclick: () => {
                        if (Date.now() >= suppressPartClickUntil) actions.selectPart({ partId: part.id });
                    },
                    style: {
                        display: 'grid', gridTemplateColumns: `repeat(${part.width}, 8px)`,
                        padding: '2px', border: 0, background: '#111',
                    },
                }, part.cells.map((piece, index) => span({
                    key: `${part.id}-${index}`,
                    style: {
                        width: '8px', height: '8px',
                        background: piece === Piece.Empty
                            ? '#222' : decidePieceColor(piece, undefined, true),
                    },
                }, ''))),
                button({
                    onclick: () => actions.togglePartPin({ partId: part.id }),
                    title: i18n.RectSelect.Pin(),
                }, part.pinned ? '★' : '☆'),
                button({
                    onclick: () => actions.removePart({ partId: part.id }),
                    title: i18n.RectSelect.Delete(),
                }, '×'),
            ]))),
    ]);
};
