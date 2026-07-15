import { datatest } from './common';

const fieldPoint = (canvasElement, x, y) => {
    const rect = canvasElement.getBoundingClientRect();
    const pitch = (rect.width - 1) / 10;
    const blockSize = pitch - 1;
    // 盤面サイズは develop 時点の計算式と完全に一致（トレイ/せり上がり部は
    // 盤面下部の枠に重ねて表示するだけで、盤面自体の縦位置には影響しない）。
    const fieldHeight = pitch * 23.5 + 4.4;
    const fieldTop = (rect.height - fieldHeight) / 2;
    const yField = 22 - y;
    const blockTop = fieldTop + Math.max(0, yField - 0.5) * blockSize + yField + 1;
    return {
        x: x * pitch + 1 + blockSize / 2,
        y: blockTop + (yField === 0 ? blockSize / 4 : blockSize / 2),
    };
};
// せり上がり部(y<0)を操作する前に、下部枠がトレイ表示ならせり上がり部へ切り替える。
// せり上がり部⇔トレイは排他表示のため、トレイが出ているとせり上がり部を操作できない。
// 専用の切替ボタンは廃止されたため、選択中のモードボタンをもう一度押すトグル動作で閉じる。
const ensureSentLineVisible = () => {
    cy.get('body').then(($body) => {
        if ($body.find('[datatest="tray-context"]').length > 0) {
            cy.get('[datatest="btn-piece-mode"][aria-pressed="true"],'
                + '[datatest="btn-select-mode"][aria-pressed="true"],'
                + '[datatest="btn-paint-mode"][aria-pressed="true"]').click();
        }
    });
};
// モードボタンは「選択中に再度押すとトレイを閉じる」トグル動作になったため、事前に「既に選択中か」を
// 判定して押下をスキップする方式は使わない（インスペクタ（utils/flags）がトレイの上に被さっている場合、
// トレイの DOM 自体は残っているため誤って「表示中」と判定してしまう）。必ず一度押し、
// その結果トレイが閉じてしまっていたら（インスペクタも必ず閉じているはずなので）もう一度押して開き直す。
const ensureModeActive = (selector) => {
    cy.get(datatest(selector)).click();
    cy.get('body').then(($body) => {
        const nowActive = $body.find(`[datatest="${selector}"][aria-pressed="true"]`).length > 0
            && $body.find('[datatest="tray-context"]').length > 0;
        if (!nowActive) {
            cy.get(datatest(selector)).click();
        }
    });
};
// PAINT はスライド/コメントモードでも primaryTool:'paint' のまま aria-pressed が true になるため、
// 汎用の ensureModeActive では区別できない。PAINT のペントレイが出ているかで直接判定する。
const ensurePaintPenHome = () => {
    cy.get(datatest('btn-paint-mode')).click();
    cy.get('body').then(($body) => {
        if ($body.find('[datatest="tray-paint-pen"]').length === 0) {
            cy.get(datatest('btn-paint-mode')).click();
        }
    });
    cy.get(datatest('tray-paint-pen')).click();
};
const pressPieceShortcut = (code) => {
    cy.get('body').trigger('keydown', { code });
    cy.get('body').trigger('keyup', { code });
};
const pressPieceShortcutToEnd = (code) => {
    cy.get('body').trigger('keydown', { code });
    cy.wait(200);
    cy.get('body').trigger('keyup', { code });
};
const longPress = (selector) => {
    cy.get(datatest(selector)).trigger('pointerdown', { pointerId: 1, button: 0 });
    cy.wait(550);
    cy.get(datatest(selector)).trigger('pointerup', { pointerId: 1, button: 0 });
};
const spawnPieceForScenario = (selector) => {
    cy.get(datatest('tray-piece-harddrop')).then(dropButton => {
        if (!dropButton.prop('disabled')) {
            operations.mode.tools.nextPage();
        }
        longPress(selector);
    });
};

export const operations = {
    screen: {
        writable: () => {
            cy.get(datatest('btn-open-menu')).click();
            cy.get(datatest('btn-writable')).click();
            cy.wait(500);
        },
        readonly: () => {
            cy.get(datatest('btn-open-menu')).click();
            cy.get(datatest('btn-readonly')).click();
            cy.wait(500);
        },
    },
    mode: {
        block: {
            open: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.tools.home();
                }
                // home() enters the PAINT mode used by the drawing helpers.
            },
            Completion: () => {
                cy.get(datatest('btn-piece-inference')).click();
                cy.wait(100);
            },
            J: () => {
                cy.get(datatest('btn-piece-j')).click();
                cy.wait(100);
            },
            L: () => {
                cy.get(datatest('btn-piece-l')).click();
                cy.wait(100);
            },
            O: () => {
                cy.get(datatest('btn-piece-o')).click();
                cy.wait(100);
            },
            I: () => {
                cy.get(datatest('btn-piece-i')).click();
                cy.wait(100);
            },
            T: () => {
                cy.get(datatest('btn-piece-t')).click();
                cy.wait(100);
            },
            S: () => {
                cy.get(datatest('btn-piece-s')).click();
                cy.wait(100);
            },
            Z: () => {
                cy.get(datatest('btn-piece-z')).click();
                cy.wait(100);
            },
            Gray: () => {
                cy.get(datatest('btn-piece-gray')).click();
                cy.wait(100);
            },
            Empty: () => {
                cy.get(datatest('btn-piece-empty')).click();
                cy.wait(100);
            },
            click: (x, y) => {
                if (y < 0) {
                    ensureSentLineVisible();
                }
                cy.get('#canvas-container').then(canvas => {
                    const point = fieldPoint(canvas[0], x, y);
                    cy.get('#canvas-container .konvajs-content').click(point.x, point.y);
                });
            },
            drag: ({ x: fromX, y: fromY }, { x: toX, y: toY }) => {
                if (fromY < 0 || toY < 0) {
                    ensureSentLineVisible();
                }
                cy.get('#canvas-container').then(canvas => {
                    const start = fieldPoint(canvas[0], fromX, fromY);
                    const end = fieldPoint(canvas[0], toX, toY);
                    let body = cy.get('#canvas-container .konvajs-content').trigger('mousedown', start.x, start.y);
                    const maxCount = 10;
                    for (let count = 0; count <= maxCount; count++) {
                        const ratio = count / maxCount;
                        body = body.trigger('mousemove',
                            start.x + (end.x - start.x) * ratio,
                            start.y + (end.y - start.y) * ratio);
                    }
                    body.trigger('mouseup', end.x, end.y);
                });
            },
            dragToRight: ({ from, to }, y) => {
                if (y < 0) {
                    ensureSentLineVisible();
                }
                cy.get('#canvas-container').then(canvas => {
                    const start = fieldPoint(canvas[0], from, y);
                    const end = fieldPoint(canvas[0], to, y);
                    let body = cy.get('#canvas-container .konvajs-content').trigger('mousedown', start.x, start.y);
                    const maxCount = 10;
                    for (let count = 0; count <= maxCount; count++) {
                        const ratio = count / maxCount;
                        body = body.trigger('mousemove', start.x + (end.x - start.x) * ratio, start.y);
                    }
                    body.trigger('mouseup', end.x, end.y);
                });
            },
            dragToUp: (x, { from, to }) => {
                if (from < 0 || to < 0) {
                    ensureSentLineVisible();
                }
                cy.get('#canvas-container').then(canvas => {
                    const start = fieldPoint(canvas[0], x, from);
                    const end = fieldPoint(canvas[0], x, to);
                    let body = cy.get('#canvas-container .konvajs-content').trigger('mousedown', start.x, start.y);
                    const maxCount = 10;
                    for (let count = 0; count <= maxCount; count++) {
                        const ratio = count / maxCount;
                        body = body.trigger('mousemove', start.x, start.y + (end.y - start.y) * ratio);
                    }
                    body.trigger('mouseup', end.x, end.y);
                });
            },
            // 高速ポインタの再現: 開始セルと終了セルのイベントだけを発火する。
            // 中間セルはアプリ側のストローク補間で埋まることを検証する用途。
            dragSparse: ({ from, to }, y) => {
                if (y < 0) {
                    ensureSentLineVisible();
                }
                cy.get('#canvas-container').then(canvas => {
                    const start = fieldPoint(canvas[0], from, y);
                    const end = fieldPoint(canvas[0], to, y);
                    let body = cy.get('#canvas-container .konvajs-content').trigger('mousedown', start.x, start.y);
                    body = body.trigger('mousemove', end.x, end.y);
                    body.trigger('mouseup', end.x, end.y);
                });
            },
        },
        fill: {
            open: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.tools.home();
                }
                cy.get(datatest('tray-paint-fill')).click();
            },
            J: () => {
                cy.get(datatest('btn-piece-j')).click();
                cy.wait(100);
            },
            L: () => {
                cy.get(datatest('btn-piece-l')).click();
                cy.wait(100);
            },
            O: () => {
                cy.get(datatest('btn-piece-o')).click();
                cy.wait(100);
            },
            I: () => {
                cy.get(datatest('btn-piece-i')).click();
                cy.wait(100);
            },
            T: () => {
                cy.get(datatest('btn-piece-t')).click();
                cy.wait(100);
            },
            S: () => {
                cy.get(datatest('btn-piece-s')).click();
                cy.wait(100);
            },
            Z: () => {
                cy.get(datatest('btn-piece-z')).click();
                cy.wait(100);
            },
            Gray: () => {
                cy.get(datatest('btn-piece-gray')).click();
                cy.wait(100);
            },
            Empty: () => {
                cy.get(datatest('btn-piece-empty')).click();
                cy.wait(100);
            },
            click: (x, y) => {
                operations.mode.block.click(x, y);
            },
            dragToRight: ({ from, to }, y) => {
                operations.mode.block.dragToRight({ from, to }, y);
            },
            dragToUp: (x, { from, to }) => {
                operations.mode.block.dragToUp(x, { from, to });
            },
        },
        utils: {
            open: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.tools.home();
                }
                cy.get(datatest('btn-utils-mode')).click();
                cy.get(datatest('overlay-utils')).should('be.visible');
            },
            close: () => {
                cy.get(datatest('overlay-utils')).find(datatest('btn-inspector-close')).click();
                cy.get(datatest('overlay-utils')).should('not.exist');
            },
        },
        flags: {
            open: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.tools.home();
                }
                cy.get(datatest('btn-flags-mode')).click();
                cy.get(datatest('overlay-flags')).should('be.visible');
            },
            close: () => {
                cy.get(datatest('overlay-flags')).find(datatest('btn-inspector-close')).click();
                cy.get(datatest('overlay-flags')).should('not.exist');
            },
            lockToOn: () => {
                cy.get(datatest('btn-lock-flag-off')).click();
            },
            lockToOff: () => {
                cy.get(datatest('btn-lock-flag-on')).click();
            },
            riseToOn: () => {
                cy.get(datatest('btn-rise-flag-off')).click();
            },
            riseToOff: () => {
                cy.get(datatest('btn-rise-flag-on')).click();
            },
            mirrorToOn: () => {
                cy.get(datatest('btn-mirror-flag-off')).click();
            },
            mirrorToOff: () => {
                cy.get(datatest('btn-mirror-flag-on')).click();
            },
        },
        piece: {
            open: () => {
                ensureModeActive('btn-piece-mode');
            },
            resetPiece: () => {
                cy.get(datatest('btn-piece-gray')).click();
            },
            move: () => {
                cy.get(datatest('tray-piece-move-left')).should('be.visible');
            },
            draw: () => {
                cy.get(datatest('btn-piece-t')).click();
            },
            rotateToRight: () => {
                cy.get(datatest('tray-piece-rotate-right')).click();
            },
            rotateToLeft: () => {
                cy.get(datatest('tray-piece-rotate-left')).click();
            },
            rotateTo180: () => {
                pressPieceShortcut('KeyA');
            },
            moveToRight: () => {
                pressPieceShortcut('ArrowRight');
            },
            moveToRightEnd: () => {
                pressPieceShortcutToEnd('ArrowRight');
            },
            moveToLeft: () => {
                pressPieceShortcut('ArrowLeft');
            },
            moveToLeftEnd: () => {
                pressPieceShortcutToEnd('ArrowLeft');
            },
            moveToRightEndByTrayLongPress: () => {
                longPress('tray-piece-move-right');
            },
            moveToLeftEndByTrayLongPress: () => {
                longPress('tray-piece-move-left');
            },
            harddrop: () => {
                cy.get(datatest('tray-piece-harddrop')).click();
            },
            lockToOn: () => {
                operations.mode.flags.open({ home: false });
                cy.get(datatest('btn-lock-flag-off')).click();
                operations.mode.flags.close();
            },
            lockToOff: () => {
                operations.mode.flags.open({ home: false });
                cy.get(datatest('btn-lock-flag-on')).click();
                operations.mode.flags.close();
            },
            spawn: {
                T: () => {
                    spawnPieceForScenario('btn-piece-t');
                },
                S: () => {
                    spawnPieceForScenario('btn-piece-s');
                },
                Z: () => {
                    spawnPieceForScenario('btn-piece-z');
                },
                O: () => {
                    spawnPieceForScenario('btn-piece-o');
                },
                I: () => {
                    spawnPieceForScenario('btn-piece-i');
                },
                L: () => {
                    spawnPieceForScenario('btn-piece-l');
                },
                J: () => {
                    spawnPieceForScenario('btn-piece-j');
                },
            },
        },
        tools: {
            open: () => {
                ensurePaintPenHome();
            },
            duplicatePage: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.tools.home()
                }
                cy.get(datatest('btn-insert-page')).click();
            },
            removePage: () => {
                operations.mode.tools.home();
                cy.get(datatest('btn-cut-page')).click();
            },
            addNewPage: () => {
                cy.get(datatest('btn-insert-new-page')).click();
            },
            convertToGray: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.utils.open();
                }
                cy.get(datatest('btn-convert-to-gray')).click();
            },
            clearField: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.utils.open();
                }
                cy.get(datatest('btn-clear-field')).click();
            },
            mirror: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.utils.open();
                }
                cy.get(datatest('btn-mirror')).click();
            },
            undo: () => {
                cy.get(datatest('btn-undo')).click();
            },
            redo: () => {
                cy.get(datatest('btn-redo')).click();
            },
            home: () => {
                ensurePaintPenHome();
            },
            nextPage: () => {
                // 新UXではページ送りボタン(btn-next-page)は末尾で新規ページを作らず、
                // ページ追加は別の「+」ボタン(btn-insert-page)に分離された。
                // 旧来の nextPageOrNewPage と同じ「末尾なら新規ページ作成、途中なら移動」を再現する。
                // リーダーには btn-insert-page が無いので、その場合は従来通り移動のみ。
                cy.get('body').then(($body) => {
                    const canInsert = $body.find('[datatest="btn-insert-page"]').length > 0;
                    if (!canInsert) {
                        cy.get(datatest('btn-next-page')).click();
                        return;
                    }
                    cy.get(datatest('text-pages')).invoke('text').then((text) => {
                        const [current, max] = text.split('/').map(value => parseInt(value.trim(), 10));
                        if (current >= max) {
                            cy.get(datatest('btn-insert-page')).click();
                        } else {
                            cy.get(datatest('btn-next-page')).click();
                        }
                    });
                });
            },
            backPage: () => {
                cy.get(datatest('btn-back-page')).click();
            },
            toRef: () => {
                // 新UXでは key/ref トグルが FLAGS モードに移動した。
                operations.mode.flags.open();
                cy.get(datatest('btn-key-page-on')).click();
            },
            toKey: () => {
                // 新UXでは key/ref トグルが FLAGS モードに移動した。
                operations.mode.flags.open();
                cy.get(datatest('btn-key-page-off')).click();
            },
            inheritComment: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.utils.open();
                    cy.get(datatest('btn-comment-mode')).click();
                }
                cy.get(datatest('btn-comment-inherit')).click();
            },
            blankComment: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.utils.open();
                    cy.get(datatest('btn-comment-mode')).click();
                }
                cy.get(datatest('btn-comment-blank')).click();
            },
        },
        slide: {
            open: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.utils.open();
                }
                cy.get(datatest('btn-slide-mode')).click();
            },
            right: () => {
                cy.get(datatest('btn-slide-to-right')).click();
            },
            left: () => {
                cy.get(datatest('btn-slide-to-left')).click();
            },
            up: () => {
                cy.get(datatest('btn-slide-to-up')).click();
            },
            down: () => {
                cy.get(datatest('btn-slide-to-down')).click();
            },
        },
        fillRow: {
            open: ({ home = true } = {}) => {
                if (home) {
                    operations.mode.tools.home();
                }
                cy.get(datatest('tray-paint-fill-row')).click();
                cy.get(datatest('btn-piece-gray')).click();
            },
            J: () => {
                cy.get(datatest('btn-piece-j')).click();
                cy.wait(100);
            },
            L: () => {
                cy.get(datatest('btn-piece-l')).click();
                cy.wait(100);
            },
            O: () => {
                cy.get(datatest('btn-piece-o')).click();
                cy.wait(100);
            },
            I: () => {
                cy.get(datatest('btn-piece-i')).click();
                cy.wait(100);
            },
            T: () => {
                cy.get(datatest('btn-piece-t')).click();
                cy.wait(100);
            },
            S: () => {
                cy.get(datatest('btn-piece-s')).click();
                cy.wait(100);
            },
            Z: () => {
                cy.get(datatest('btn-piece-z')).click();
                cy.wait(100);
            },
            Gray: () => {
                cy.get(datatest('btn-piece-gray')).click();
                cy.wait(100);
            },
            Empty: () => {
                cy.get(datatest('btn-piece-empty')).click();
                cy.wait(100);
            },
        },
    },
    menu: {
        open: () => {
            cy.get(datatest('btn-open-menu')).click();
        },
        openPage: () => {
            operations.menu.open();
            cy.get(datatest('btn-open-fumen')).click();
        },
        newPage: () => {
            operations.menu.open();
            cy.get(datatest('btn-new-fumen')).click();
        },
        append: () => {
            operations.menu.open();
            cy.get(datatest('btn-append-fumen')).click();
        },
        importExport: () => {
            operations.menu.open();
            cy.get(datatest('btn-list-menu')).click();
        },
        copyToClipboard: () => {
            operations.menu.open();
            cy.get(datatest('btn-copy-fumen')).click();
            // Clicking btn-raw-fumen waits for the clipboard modal to render and finish animating
            // (Cypress actionability), so no fixed wait is needed beforehand.
            cy.get(datatest('btn-raw-fumen')).click();
            cy.wait(10);

            {
                let body = cy.get('body');
                const from = 10;
                const to = 350;
                const y = 640;
                body = body.trigger('mousedown', from, y);

                const maxCount = 10;
                const dx = (to - from) / maxCount;
                for (let count = 0; count <= maxCount; count++) {
                    body = body.trigger('mousemove', dx * count + from, y);
                }

                body.trigger('mouseup', to, y);
            }

            cy.get(datatest('btn-clipboard-cancel')).click();
        },
        firstPage: () => {
            operations.menu.open();
            cy.get(datatest('btn-first-page')).click();
            cy.wait(100);
        },
        lastPage: () => {
            operations.menu.open();
            cy.get(datatest('btn-last-page')).click();
            cy.wait(100);
        },
        commentReadonly: () => {
            operations.menu.open();
            cy.get(datatest('btn-comment-readonly')).click();
            cy.wait(100);
        },
        commentWritable: () => {
            operations.menu.open();
            cy.get(datatest('btn-comment-writable')).click();
            cy.wait(100);
        },
        clearToEnd: () => {
            operations.menu.open();
            cy.get(datatest('btn-clear-to-end')).click();
            cy.wait(100);
        },
        clearPast: () => {
            operations.menu.open();
            cy.get(datatest('btn-clear-past')).click();
            cy.wait(100);
        },
        pageSlider: () => {
            operations.menu.open();
            cy.get(datatest('btn-page-slider')).click();
        },
        openUserSettings: () => {
            operations.menu.open();
            cy.get(datatest('btn-user-settings')).click();
        },
        // ユーザー設定モーダル内のタブを選択する
        selectUserSettingsTab: (tab) => {
            cy.get(datatest(`tab-user-settings-${tab}`)).click();
        },
        ghostOn: () => {
            operations.menu.openUserSettings();
            operations.menu.selectUserSettingsTab('field');
            cy.get(datatest('switch-ghost-visible')).check({ force: true });
            cy.get(datatest('btn-save')).click();
        },
        ghostOff: () => {
            operations.menu.openUserSettings();
            operations.menu.selectUserSettingsTab('field');
            cy.get(datatest('switch-ghost-visible')).uncheck({ force: true });
            cy.get(datatest('btn-save')).click();
        },
        loopOn: () => {
            operations.menu.openUserSettings();
            operations.menu.selectUserSettingsTab('misc');
            cy.get(datatest('switch-loop')).check({ force: true });
            cy.get(datatest('btn-save')).click();
        },
        setRotationSystem: (value) => {
            operations.menu.openUserSettings();
            operations.menu.selectUserSettingsTab('field');
            cy.get(datatest(`radio-rotation-system-${value}`)).check({ force: true });
            cy.get(datatest('btn-save')).click();
        },
    },
    tree: {
        setScope: (scope) => {
            cy.get(datatest('btn-tree-scope-chip')).click();
            cy.get(datatest(`tree-scope-option-${scope}`)).click();
        },
    },
    editorPanel: {
        // ユーザー設定 View タブでサイドパネル(PC)の表示を切り替える
        enable: () => {
            operations.menu.openUserSettings();
            operations.menu.selectUserSettingsTab('view');
            cy.get(datatest('switch-editor-side-panel')).check({ force: true });
            cy.get(datatest('btn-save')).click();
        },
        disable: () => {
            operations.menu.openUserSettings();
            operations.menu.selectUserSettingsTab('view');
            cy.get(datatest('switch-editor-side-panel')).uncheck({ force: true });
            cy.get(datatest('btn-save')).click();
        },
        // パネル内のタブ切替 ('list' | 'tree')
        selectTab: (tab) => {
            cy.get(datatest(`editor-panel-tab-${tab}`)).click();
        },
    },
};
