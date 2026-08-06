# Cypress spec map

機能変更のたびに「どのspecを直す/回すべきか」を毎回 grep と記憶に頼らないための対応表。
軽微なUI変更では影響specのみを実行する（`.agents/skills/e2e/SKILL.md` 参照）ための
実行手段でもある。

更新日: 2026-08-06。CI目安時間は run `31000625172`（2026-08-05計測）の spec 別実測。
この表は手動メンテであり、実測値・src領域は変更のたびに古くなる可能性がある
（正しさそのものは機械検査できない）。

> 現状把握: 2026-08-06 時点で `cypress/integration/*.js` は実測 **29 spec**。
> 旧 `history_spec.js` は `history_piece` / `history_field` / `history_comment` の3 spec へ
> 分割済み（`docs/plans/2026_08_06_dev-workflow-e2e-critical-path.md` フェーズ1）。
> history系の目安時間は分割前 run の test 別実測から積み上げた推定値で、
> 分割後の CI 実測が出た時点で更新する。

## Spec 一覧

| spec | 対象機能・画面 | 主な src 領域 | 主要ヘルパー(operations.*) | CI目安時間 | 備考 |
|---|---|---|---|---|---|
| `append_spec.js` | Append fumen（インポートモーダル、失敗→成功、キャンセル） | `src/components/modals/append.tsx`, `src/actions/list_view.ts` | `menu.append` | 0:08 | readonly画面から起動 |
| `box_spec.js` | Hold/Nextボックス表示（Quiz有無・Reverse・Multi quiz） readonly | `src/views/reader.ts`, `src/lib/piece_queue.ts`, `src/lib/fumen/quiz.ts` | なし（`holdBox`/`nextBox`セレクタ直接） | 0:20 | 776行だが単純アサーション主体 |
| `cold_clear_spec.js` | Cold Clear AIメニュー（提案検索・top branch編集・現在ピース再spawn） | `src/actions/cold_clear.ts`, `src/lib/cold_clear/`, `src/components/modals/cold_clear_menu.tsx` | `mode.comment`, `mode.piece`, `mode.tools` | 0:11 | Worker/WASM利用。`window.Worker`スタブでは制御不可（e2e skill参照） |
| `color_spec.js` | ガイドライン色・Classic配色・回転システム切替時の配色同期 | `src/lib/classic_rotation.ts`, `src/lib/rotation_system.ts`, `src/components/field.tsx` | `menu.setRotationSystem` | 0:04 | readonly画面中心 |
| `comments_spec.js` | コメント編集（Utils起動・他ページ非適用・readonly/writable切替・Quiz/Multi quiz/不正quiz・マージ） | `src/actions/comment.ts`, `src/views/editor/editor.ts`（getComment）, `src/lib/fumen/quiz.ts` | `menu.commentReadonly/Writable`, `mode.comment/piece/tools/utils` | 1:06 | - |
| `draw_spec.js` | PAINT描画（ドラッグ補間・コンプリート補完・分割inference・sentブロック） | `src/actions/draw_block.ts`, `src/actions/field_editor.ts`, `src/lib/inference.ts` | `menu.copyToClipboard/newPage`, `mode.block/flags/tools`, `screen.readonly` | 0:36 | - |
| `drawing_tool_spec.js` | 旧Utils/Flags/Slide機能群（複製・ロックフラグ更新・削除・Undo/Redo・自動保存・Flags・Slide・クリアボタン表示） | `src/views/editor/editor_overlay.ts`（UTILS/FLAGS）, `src/views/editor/context_tray.ts`（Slide）, `src/actions/memento.ts` | `menu.firstPage/lastPage/newPage`, `mode.block/flags/piece/slide/tools/utils`, `screen.writable` | 1:11 | 558行、広範囲を横断 |
| `editor_side_panel_spec.js` | サイドパネル（List/Treeタブ、リサイズ、自動非表示、モバイル/PC切替） | `src/views/editor/side_panel.ts`, `src/components/list_view/`, `src/components/tree/` | `editorPanel.*`, `mode.comment/piece/tools` | 0:19 | 主にPC幅（`mobile:false`） |
| `editor_ui_spec.js` | rail/tray UI本体（PIECE/PAINT/SELECT切替・インスペクタ・partsスタンプ・DAS等） | `src/views/editor/editor_rail.ts`, `src/views/editor/editor_overlay.ts`, `src/views/editor/context_tray.ts` | `mode.block/fill/piece/tools` | 0:45 | 628行、最も広範囲のUI回帰源 |
| `fill_row_spec.js` | Fill row（行単位塗り→Slide→再Fill row） | `src/actions/fill_row.ts`, `src/views/editor/context_tray.ts`（PAINTトレイ） | `mode.block/fillRow/slide/tools` | 0:06 | - |
| `fill_spec.js` | Fillモード（フィールド塗り・送りライン描画） | `src/actions/fill.ts`, `src/views/editor/context_tray.ts`（PAINTトレイ） | `mode.block/fill` | 0:08 | - |
| `history_comment_spec.js` | Undo/Redo履歴のうちコメント・Quiz・Append | `src/actions/memento.ts`, `src/actions/comment.ts`, `src/lib/fumen/quiz.ts` | `menu.append/firstPage`, `mode.comment/piece/tools`, `screen.writable` | 2:41 | `play()` は `cypress/support/history_play.js` を共有 |
| `history_field_spec.js` | Undo/Redo履歴のうち盤面編集（Clear/Slide/Fill/Mirror/グレー化） | `src/actions/memento.ts`, `src/actions/fill.ts`, `src/actions/fill_row.ts`, `src/actions/convert.ts` | `mode.block/comment/fill/fillRow/slide/tools/utils`, `screen.writable` | 2:52 | 同上 |
| `history_piece_spec.js` | Undo/Redo履歴のうちピース配置・ページ操作（追加/削除/挿入） | `src/actions/memento.ts`, `src/actions/put_piece.ts`, `src/actions/pages.ts` | `menu.firstPage/lastPage`, `mode.flags/piece/tools`, `screen.writable` | 3:14 | 同上。history系では最重量 |
| `key_ref_spec.js` | `field.ref`/`comment.ref` 整合性のUndo/Redo確認 | `src/actions/memento.ts`, `src/lib/fumen/types.ts` | `menu.copyToClipboard`, `mode.block/flags/tools` | 0:27 | AGENTS.md「Data And State Invariants」に直結 |
| `language_spec.js` | 言語切替（ja/en 初期表示） | `src/locales/` | `menu.openPage` | 0:02 | - |
| `list_view_menu_spec.js` | 統合インポート/エクスポートメニュー（外部サイト連携・tetgram・クリップボード） | `src/components/modals/list_view_menu.tsx`, `src/lib/tetgram.ts`, `src/lib/clipboard_parser/`, `src/actions/list_view.ts` | `menu.importExport/open`, `mode.block` | 0:20 | Editor/Reader両画面をdescribeで反復 |
| `no_lock_spec.js` | ロックなし（接着なし）ピースのページ番号・表示 | `src/lib/fumen/action.ts`, `src/views/reader.ts` | なし | 0:11 | readonly |
| `open_spec.js` | Openモーダル（不正fumen・v110・Ghost表示・ページスライダー） | `src/components/modals/open.tsx`, `src/lib/fumen/fumen.ts`, `src/components/field.tsx` | `menu.firstPage/ghostOff/ghostOn/lastPage/openPage/pageSlider`, `mode.block/comment/piece/tools`, `screen.writable` | 2:01 | 679行 |
| `piece_queue_spec.js` | HOLD/NEXTキュー（PIECEモード限定表示・infinite 7bag・キューモーダル編集） | `src/lib/piece_queue.ts`, `src/views/editor/piece_queue_overlay.ts`, `src/components/modals/piece_queue.tsx` | `mode.comment/piece/tools` | 0:52 | `#Q=` 同期（AGENTS.md invariant）に関わる |
| `put_piece_spec.js` | ピース設置操作（キー/タッチ同時操作・DAS Cut・ハードドロップ・Reset・Inference・回転系） | `src/actions/put_piece.ts`, `src/actions/move_piece.ts`, `src/lib/piece_shortcut.ts`, `src/lib/rotation_system.ts`, `src/lib/srs.ts`, `src/lib/srs_plus.ts`, `src/lib/inference.ts` | `menu.openUserSettings/selectUserSettingsTab/setRotationSystem`, `mode.block/comment/piece/tools` | 1:22 | 557行。タイミング系（DAS Cut等）はCI環境依存でflakyになりやすい |
| `quiz_spec.js` | Quiz（`#Q=`）表示のreadonly挙動（PC・不正quiz・最終ページLockオフ） | `src/lib/fumen/quiz.ts`, `src/views/reader.ts` | なし | 1:02 | readonly |
| `right_click_spec.js` | 盤面の右クリック統合挙動（PAINT/SELECT/PIECE共通の消しゴム・SPAWNミノのキュー戻し/削除・選択やパーツのまるごと削除・COMP残骸の消去） | `src/actions/field_editor.ts`, `src/components/event/drawing_event_canvas.tsx`, `src/actions/rect_select.ts` | `mode.block.Completion/rightClick/rightDrag`, `mode.piece.spawn`, `menu.openUserSettings` | 0:23 | 右クリックは主ツールに依存しない単一ポリシー |
| `sent_spec.js` | せり上がりライン（Highlight・Reverse・v110互換） | `src/lib/fumen/field.ts`（sentLine）, `src/lib/rotation_system.ts` | `menu.setRotationSystem` | 0:15 | readonly |
| `slide_spec.js` | Slideモード（上下移動・UTILトレイを保持したままの全体ドラッグ） | `src/views/editor/context_tray.ts`（Slideトレイ）, `src/actions/convert.ts`（shiftTo系） | `mode.block/slide` | 0:03 | - |
| `tree_mode_spec.js` | Tree（グラフ表示・ノードD&D・分岐/挿入・削除Undo・スコープ選択） | `src/actions/tree_operations.ts`, `src/components/tree/`, `src/lib/fumen/tree_utils.ts`, `src/lib/fumen/tree_types.ts` | `tree.setScope`（他は合成タッチイベント直接） | 0:15 | AGENTS.md「tree root仮想ノード/DFS pre-order」invariantに直結 |
| `url_behavior_spec.js` | URL/hashパラメータの横断挙動（screen/tree/lng/mobile維持、モーダルキャンセル時のURL不変） | `src/actions.ts`, `src/memento.ts` | `menu.append/openPage/openUserSettings`, `mode.block` | 0:04 | 一部 `it.skip`（未実装のライブURL同期。e2e skill参照） |
| `user_settings_spec.js` | ユーザー設定モーダル（DAS/ARR・ソフトドロップ優先・グラデーション折りたたみ・Ghost・Loop・ライン消去後グレー） | `src/components/modals/user_settings.tsx`, `src/actions/user_settings.ts` | `menu.lastPage/loopOn/openUserSettings/selectUserSettingsTab`, `mode.block/piece/tools` | 0:22 | - |
| `utils_spec.js` | Utilsモード（Paintツールとの分離・スコープ別グルーピング・Mirror） | `src/views/editor/editor_overlay.ts` | `mode.tools/utils` | 0:04 | - |

## 逆引き: src 領域 → 見るべき spec

網羅的なグラフではなく、経験則に基づく目安。境界的なケースでは広めに実行する。

- `cypress/support/operations.js` / `cypress/support/common.js` を触った →
  **全spec影響の可能性**。フルスイートの実行を検討する。
- `src/views/editor/`（rail/tray/overlay/context_tray/side_panel） →
  `editor_ui`, `editor_side_panel`, `drawing_tool`, `put_piece`, `history_*`（3 spec）, `draw`,
  `key_ref`, `utils`, `fill`, `fill_row`, `slide`, `piece_queue`, `comments`
- `src/actions/field_editor.ts`（盤面ポインタ操作の分岐） →
  `right_click`, `draw`, `fill`, `fill_row`, `put_piece`, `editor_ui`, `history_piece`, `history_field`
- `src/actions/tree_operations.ts`, `src/components/tree/` →
  `tree_mode`, `editor_side_panel`（treeタブ）, `history_*`
- `src/actions/list_view.ts`, `src/lib/tetgram.ts`, `src/lib/clipboard_parser/` →
  `list_view_menu`, `append`, `open`, `url_behavior`
- `src/lib/fumen/`（`fumen.ts`, `field.ts`, `quiz.ts`, `action.ts`, `types.ts`） →
  ほぼ全spec（fumenコアのため影響大）。最低限 `box`, `quiz`, `sent`, `no_lock`, `key_ref`,
  `history_*`, `open`, `color`, `put_piece` は必ず確認する。
- `src/lib/rotation_system.ts`, `src/lib/srs.ts`, `src/lib/srs_plus.ts`,
  `src/lib/classic_rotation.ts` →
  `put_piece`, `color`, `sent`, `drawing_tool`（Flags）, `user_settings`（回転システム設定）
- `src/lib/piece_queue.ts`, `src/components/modals/piece_queue.tsx` →
  `piece_queue`, `box`, `history_piece`, `history_comment`（quiz）
- `src/actions/cold_clear.ts`, `src/lib/cold_clear/`, `src/lib/cold_clear_wasm/` →
  `cold_clear_spec` のみ
- `src/components/modals/user_settings.tsx`, `src/actions/user_settings.ts` →
  `user_settings`, `put_piece`（DAS/ARR設定使用）, `editor_side_panel`（表示設定）
- `src/actions.ts`, `src/memento.ts`（URL/localStorage/履歴の横断挙動） →
  `url_behavior`, `history_*`, `key_ref`, その他広範囲
- `src/locales/` → `language`。文言に直接アサーションしている他specも影響し得る
  （変更前に対象文言をgrepする）

## CI シャードと実測時間の更新手順

`dev-workflow` の e2e ジョブは `cypress/spec-timings.json` の重みを使って
`scripts/plan_cypress_shards.js` が5シャードへ自動配分する（LPT bin-packing）。

- 新しい spec を追加しただけならワークフローの変更は不要。重みが未登録の spec は
  `defaultSeconds` で配分され、`scripts/plan_cypress_shards.js` が stderr に警告を出す
  （CI ログの「Select specs for shard」ステップに出る）。
- 実測を取り直すとき:
  1. 成功した run の ID を調べる（`gh run list --workflow dev-workflow.yaml --branch develop`）。
  2. `gh run view <run-id> --log` の Cypress 実行結果サマリ表（`✔ <spec> mm:ss ...`）から
     spec 別の秒数を読む。5シャードに分かれているため全ジョブ分を集める。
  3. `cypress/spec-timings.json` の `specs` と `source` を更新し、本表の CI目安時間も直す。
  4. `node scripts/plan_cypress_shards.js --index 0 --total 5` を index 0〜4 で実行し、
     各シャードの推定秒数が揃っていることを stderr の要約で確認する。
- 重みが古くても配分が偏るだけで失敗はしない。シャード数を変えるときは
  `.github/workflows/dev-workflow.yaml` の `matrix.shard` と `--total` を同時に直す。

## 運用規約（既存合意の明文化。新規ルールではない）

- ナビゲーション・モード遷移・メニュー操作は spec に直書きせず `operations.js` を使う。
  「ボタンの存在自体が要件」の存在アサーション（`.should('exist')`/`.should('not.exist')`）は
  直接セレクタでよい（調査ノート §9-4）。
- `datatest` を追加・改名・削除する変更は、`cypress/support/operations.js`・影響spec・
  `src/__tests__/e2e_selector_contract.test.ts` の ALLOWLIST（該当する場合）を
  同一コミットで更新する。
- spec を追加・削除したら本表も更新する。
