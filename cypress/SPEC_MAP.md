# Cypress spec map

機能変更のたびに「どのspecを直す/回すべきか」を毎回 grep と記憶に頼らないための対応表。
軽微なUI変更では影響specのみを実行する（`.agents/skills/e2e/SKILL.md` 参照）ための
実行手段でもある。

更新日: 2026-07-21。CI目安時間は特記なき限り run `29652557446`（2026-07-18計測、
`docs/plans/2026_07_19_ci-dev-workflow-speedup.md` §8 記載）の実測。この表は手動メンテであり、
実測値・src領域は変更のたびに古くなる可能性がある（正しさそのものは機械検査できない）。

> 現状把握: 2026-07-21 時点で `cypress/integration/*.js` は実測 **26 spec**。
> `docs/plans/2026_07_21_e2e-simplification-efficiency.md` §2 の前提記載「27 spec」とは
> 1件差がある（記載時点からのspec統廃合、または実測誤差と推測されるが未確認）。
> 本表は実際にリポジトリに存在する26specを列挙する。

## Spec 一覧

| spec | 対象機能・画面 | 主な src 領域 | 主要ヘルパー(operations.*) | CI目安時間 | 備考 |
|---|---|---|---|---|---|
| `append_spec.js` | Append fumen（インポートモーダル、失敗→成功、キャンセル） | `src/components/modals/append.tsx`, `src/actions/list_view.ts` | `menu.append` | <30秒 | readonly画面から起動 |
| `box_spec.js` | Hold/Nextボックス表示（Quiz有無・Reverse・Multi quiz） readonly | `src/views/reader.ts`, `src/lib/piece_queue.ts`, `src/lib/fumen/quiz.ts` | なし（`holdBox`/`nextBox`セレクタ直接） | <30秒 | 776行だが単純アサーション主体 |
| `cold_clear_spec.js` | Cold Clear AIメニュー（提案検索・top branch編集・現在ピース再spawn） | `src/actions/cold_clear.ts`, `src/lib/cold_clear/`, `src/components/modals/cold_clear_menu.tsx` | `mode.comment`, `mode.piece`, `mode.tools` | <30秒 | Worker/WASM利用。`window.Worker`スタブでは制御不可（e2e skill参照） |
| `color_spec.js` | ガイドライン色・Classic配色・回転システム切替時の配色同期 | `src/lib/classic_rotation.ts`, `src/lib/rotation_system.ts`, `src/components/field.tsx` | `menu.setRotationSystem` | <30秒 | readonly画面中心 |
| `comments_spec.js` | コメント編集（Utils起動・他ページ非適用・readonly/writable切替・Quiz/Multi quiz/不正quiz・マージ） | `src/actions/comment.ts`, `src/views/editor/comment_mode.ts`, `src/lib/fumen/quiz.ts` | `menu.commentReadonly/Writable`, `mode.comment/piece/tools/utils` | 1:00 | - |
| `draw_spec.js` | PAINT描画（ドラッグ補間・コンプリート補完・分割inference・sentブロック） | `src/actions/draw_block.ts`, `src/actions/field_editor.ts`, `src/lib/inference.ts` | `menu.copyToClipboard/newPage`, `mode.block/flags/tools`, `screen.readonly` | 0:44 | - |
| `drawing_tool_spec.js` | 旧Utils/Flags/Slide機能群（複製・ロックフラグ更新・削除・Undo/Redo・自動保存・Flags・Slide・クリアボタン表示） | `src/views/editor/utils_mode.ts`, `src/views/editor/flags_mode.ts`, `src/views/editor/slide_mode.ts`, `src/actions/memento.ts` | `menu.firstPage/lastPage/newPage`, `mode.block/flags/piece/slide/tools/utils`, `screen.writable` | 1:18 | 558行、広範囲を横断 |
| `editor_side_panel_spec.js` | サイドパネル（List/Treeタブ、リサイズ、自動非表示、モバイル/PC切替） | `src/views/editor/side_panel.ts`, `src/components/list_view/`, `src/components/tree/` | `editorPanel.*`, `mode.comment/piece/tools` | <30秒 | 主にPC幅（`mobile:false`） |
| `editor_ui_spec.js` | rail/tray UI本体（PIECE/PAINT/SELECT切替・インスペクタ・partsスタンプ・DAS等） | `src/views/editor/editor_rail.ts`, `src/views/editor/editor_overlay.ts`, `src/views/editor/context_tray.ts` | `mode.block/fill/piece/tools` | 0:40 | 628行、最も広範囲のUI回帰源 |
| `fill_row_spec.js` | Fill row（行単位塗り→Slide→再Fill row） | `src/actions/fill_row.ts`, `src/views/editor/fill_row_mode.ts` | `mode.block/fillRow/slide/tools` | <30秒 | - |
| `fill_spec.js` | Fillモード（フィールド塗り・送りライン描画） | `src/actions/fill.ts`, `src/views/editor/fill_mode.ts` | `mode.block/fill` | <30秒 | - |
| `history_spec.js` | Undo/Redo履歴（ほぼ全機能を横断する統合テスト） | `src/actions/memento.ts` + 各機能アクション全般 | `menu.append/firstPage/lastPage`, `mode.block/comment/fill/fillRow/flags/piece/slide/tools/utils`, `screen.writable` | 8:10（3 shard中の単独shard。リトライ込み） | 単独最重量。フェーズ4は対象外（`visit()`以外のwaitには触れない） |
| `key_ref_spec.js` | `field.ref`/`comment.ref` 整合性のUndo/Redo確認 | `src/actions/memento.ts`, `src/lib/fumen/types.ts` | `menu.copyToClipboard`, `mode.block/flags/tools` | <30秒 | AGENTS.md「Data And State Invariants」に直結 |
| `language_spec.js` | 言語切替（ja/en 初期表示） | `src/locales/` | `menu.openPage` | <30秒 | - |
| `list_view_menu_spec.js` | 統合インポート/エクスポートメニュー（外部サイト連携・tetgram・クリップボード） | `src/components/modals/list_view_menu.tsx`, `src/lib/tetgram.ts`, `src/lib/clipboard_parser/`, `src/actions/list_view.ts` | `menu.importExport/open`, `mode.block` | <30秒 | Editor/Reader両画面をdescribeで反復 |
| `no_lock_spec.js` | ロックなし（接着なし）ピースのページ番号・表示 | `src/lib/fumen/action.ts`, `src/views/reader.ts` | なし | <30秒 | readonly |
| `open_spec.js` | Openモーダル（不正fumen・v110・Ghost表示・ページスライダー） | `src/components/modals/open.tsx`, `src/lib/fumen/fumen.ts`, `src/components/field.tsx` | `menu.firstPage/ghostOff/ghostOn/lastPage/openPage/pageSlider`, `mode.block/comment/piece/tools`, `screen.writable` | 2:14 | 679行 |
| `piece_queue_spec.js` | HOLD/NEXTキュー（PIECEモード限定表示・infinite 7bag・キューモーダル編集） | `src/lib/piece_queue.ts`, `src/views/editor/piece_queue_overlay.ts`, `src/components/modals/piece_queue.tsx` | `mode.comment/piece/tools` | <30秒 | `#Q=` 同期（AGENTS.md invariant）に関わる |
| `put_piece_spec.js` | ピース設置操作（キー/タッチ同時操作・DAS Cut・ハードドロップ・Reset・Inference・回転系） | `src/actions/put_piece.ts`, `src/actions/move_piece.ts`, `src/lib/piece_shortcut.ts`, `src/lib/rotation_system.ts`, `src/lib/srs.ts`, `src/lib/srs_plus.ts`, `src/lib/inference.ts` | `menu.openUserSettings/selectUserSettingsTab/setRotationSystem`, `mode.block/comment/piece/tools` | 0:48 | 557行。タイミング系（DAS Cut等）はCI環境依存でflakyになりやすい |
| `quiz_spec.js` | Quiz（`#Q=`）表示のreadonly挙動（PC・不正quiz・最終ページLockオフ） | `src/lib/fumen/quiz.ts`, `src/views/reader.ts` | なし | 1:12 | readonly |
| `sent_spec.js` | せり上がりライン（Highlight・Reverse・v110互換） | `src/lib/fumen/field.ts`（sentLine）, `src/lib/rotation_system.ts` | `menu.setRotationSystem` | <30秒 | readonly |
| `slide_spec.js` | Slideモード（上下移動・UTILトレイを保持したままの全体ドラッグ） | `src/views/editor/slide_mode.ts` | `mode.block/slide` | <30秒 | - |
| `tree_mode_spec.js` | Tree（グラフ表示・ノードD&D・分岐/挿入・削除Undo・スコープ選択） | `src/actions/tree_operations.ts`, `src/components/tree/`, `src/lib/fumen/tree_utils.ts`, `src/lib/fumen/tree_types.ts` | `tree.setScope`（他は合成タッチイベント直接） | <30秒 | AGENTS.md「tree root仮想ノード/DFS pre-order」invariantに直結 |
| `url_behavior_spec.js` | URL/hashパラメータの横断挙動（screen/tree/lng/mobile維持、モーダルキャンセル時のURL不変） | `src/actions.ts`, `src/memento.ts` | `menu.append/openPage/openUserSettings`, `mode.block` | <30秒 | 一部 `it.skip`（未実装のライブURL同期。e2e skill参照） |
| `user_settings_spec.js` | ユーザー設定モーダル（DAS/ARR・グラデーション折りたたみ・Ghost・Loop・ライン消去後グレー） | `src/components/modals/user_settings.tsx`, `src/actions/user_settings.ts` | `menu.lastPage/loopOn/openUserSettings/selectUserSettingsTab`, `mode.block/piece/tools` | <30秒 | - |
| `utils_spec.js` | Utilsモード（Paintツールとの分離・スコープ別グルーピング・Mirror） | `src/views/editor/utils_mode.ts`, `src/views/editor/editor_overlay.ts` | `mode.tools/utils` | <30秒 | - |

## 逆引き: src 領域 → 見るべき spec

網羅的なグラフではなく、経験則に基づく目安。境界的なケースでは広めに実行する。

- `cypress/support/operations.js` / `cypress/support/common.js` を触った →
  **全spec影響の可能性**。フルスイートの実行を検討する。
- `src/views/editor/`（rail/tray/overlay/context_tray/side_panel/各mode） →
  `editor_ui`, `editor_side_panel`, `drawing_tool`, `put_piece`, `history`, `draw`,
  `key_ref`, `utils`, `fill`, `fill_row`, `slide`, `piece_queue`, `comments`
- `src/actions/tree_operations.ts`, `src/components/tree/` →
  `tree_mode`, `editor_side_panel`（treeタブ）, `history`
- `src/actions/list_view.ts`, `src/lib/tetgram.ts`, `src/lib/clipboard_parser/` →
  `list_view_menu`, `append`, `open`, `url_behavior`
- `src/lib/fumen/`（`fumen.ts`, `field.ts`, `quiz.ts`, `action.ts`, `types.ts`） →
  ほぼ全spec（fumenコアのため影響大）。最低限 `box`, `quiz`, `sent`, `no_lock`, `key_ref`,
  `history`, `open`, `color`, `put_piece` は必ず確認する。
- `src/lib/rotation_system.ts`, `src/lib/srs.ts`, `src/lib/srs_plus.ts`,
  `src/lib/classic_rotation.ts` →
  `put_piece`, `color`, `sent`, `drawing_tool`（Flags）, `user_settings`（回転システム設定）
- `src/lib/piece_queue.ts`, `src/components/modals/piece_queue.tsx` →
  `piece_queue`, `box`, `history`
- `src/actions/cold_clear.ts`, `src/lib/cold_clear/`, `src/lib/cold_clear_wasm/` →
  `cold_clear_spec` のみ
- `src/components/modals/user_settings.tsx`, `src/actions/user_settings.ts` →
  `user_settings`, `put_piece`（DAS/ARR設定使用）, `editor_side_panel`（表示設定）
- `src/actions.ts`, `src/memento.ts`（URL/localStorage/履歴の横断挙動） →
  `url_behavior`, `history`, `key_ref`, その他広範囲
- `src/locales/` → `language`。文言に直接アサーションしている他specも影響し得る
  （変更前に対象文言をgrepする）

## 運用規約（既存合意の明文化。新規ルールではない）

- ナビゲーション・モード遷移・メニュー操作は spec に直書きせず `operations.js` を使う。
  「ボタンの存在自体が要件」の存在アサーション（`.should('exist')`/`.should('not.exist')`）は
  直接セレクタでよい（調査ノート §9-4）。
- `datatest` を追加・改名・削除する変更は、`cypress/support/operations.js`・影響spec・
  `src/__tests__/e2e_selector_contract.test.ts` の ALLOWLIST（該当する場合）を
  同一コミットで更新する。
- spec を追加・削除したら本表も更新する。
