---
name: plan
description: Write an implementation design document (実装設計書 / 実装計画書) for this repo and save it under docs/plans/. Use when the user asks for a 設計書, 実装計画, implementation plan, or design doc before coding a feature or fix.
---

# Implementation design document (docs/plans/)

Produce a design document BEFORE implementation. The document is the contract between
design, review, and implementation — which may each be done by different AI models.

## 1. Investigate before writing

1. Read `AGENTS.md` in full. Pay particular attention to:
   - "Data And State Invariants" — every invariant the change touches must be
     addressed explicitly in the document.
   - "Feature Locations" — use it as a starting map, then read the actual source.
2. Read the related code AND its existing tests:
   - Jest: `src/**/__tests__/` near the touched modules.
   - Cypress: `cypress/integration/` specs and `cypress/support/operations.js`
     (note which `datatest` attributes the change adds/moves/renames).
3. Check `docs/plans/` and `docs/notes/` for prior documents on the same area and
   link to them instead of restating.

Do not write the document from the Feature Locations map alone — verify against the
current code and report discrepancies per AGENTS.md.

## 2. File location and naming

- Save to `docs/plans/yyyy_mm_dd_<lowercase-kebab-case>.md`
  (e.g. `docs/plans/2026_07_19_piece-queue-hold-swap.md`).
- Date prefix = the document's creation date, underscores; slug = lowercase kebab-case.
- Write the document body in Japanese, matching the existing documents in `docs/plans/`.

## 3. Required structure

Use this template. Keep every section; write 「なし」 with a one-line reason rather
than deleting a section that seems empty.

```markdown
# <タイトル>

作成日: yyyy-mm-dd
状態: <ドラフト / レビュー待ち / 実装待ち / 実装中 / 完了>
対象ブランチ: `develop`
設計作成者: <AIモデル名>
レビュー者: <AIモデル名（複数なら連名） / 未実施>
実装者: <AIモデル名（複数なら連名） / 未定>

## 1. 目的

<何を、なぜ変えるのか。依頼の背景。>

## 2. 対象範囲

### 対象
### 対象外
### 前提

<対象外と前提は必ず明記する。「やらないこと」を先に固定する。>

## 3. 現状と変更後の差分

<現状の挙動・構造と、変更後にどうなるかを対比で整理する。>

## 4. 影響ファイルとデータフロー

<変更・参照するファイルを列挙し、状態やデータがどこからどこへ流れるかを示す。
actions → state → view → lib の経路、localStorage / URL / fumen文字列 /
undo-redo など横断的な流れを含める。>

## 5. 不変条件の確認

<AGENTS.md「Data And State Invariants」の各項目について、この変更が
触れるか・どう維持するかを1項目ずつ確認する。触れないものは触れないと書く。>

## 6. テスト計画

### Jest
<追加・更新するテストファイルと検証内容。>

### Cypress
<追加・更新するspecと操作手順。datatest属性の追加・変更があれば
cypress/support/operations.js の更新も明記する。>

## 7. 未確定事項・リスク

<実装時に判断が必要な点、依頼者への確認事項、退行の懸念。>

## 8. 進捗・結果・課題

<必要に応じて実装中・実装後に追記する。実装完了時は結果（テスト結果、
コミット等）と残課題をここに残す。>
```

## 4. Model attribution rules

- Record the actual model names (e.g. `Claude Fable 5`, `Claude Opus 4.8`,
  `GPT-5`), not vague labels like "AI" or "Claude".
- When multiple models share a role, list them jointly
  (e.g. `設計作成者: Claude Fable 5, GPT-5`).
- On creation, fill in 設計作成者 with your own model name; set レビュー者 to
  `未実施` and 実装者 to `未定` unless already known.
- Whoever later reviews or implements must update these fields and the 状態 line.
- Commit trailer: per AGENTS.md, when an implementation plan records model names,
  the `Model:` trailer of the implementation commits uses the names recorded in
  the plan (joint names if multiple) in preference to the committing model's own name.

## 5. Lifecycle

- Design only — do NOT start implementing as part of this skill unless the user
  asked for design + implementation in one request.
- After saving, present the user a short summary plus the open questions from
  section 7 (未確定事項・リスク).
- During/after implementation, keep section 8 (進捗・結果・課題) up to date instead
  of creating a new document; create a `-followup` document only for a genuinely
  new scope (see existing examples in `docs/plans/`).
- `docs/` is gitignored local material — the document is not committed.
