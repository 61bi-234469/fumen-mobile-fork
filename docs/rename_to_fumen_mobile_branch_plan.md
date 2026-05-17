# Rename Implementation Plan: Fumen Mobile Fork

## Purpose

フォーク元との機能剥離と混同防止のため、アプリ表示名とrepo名を再度変更する。

- 表示名: `Fumen Mobile Fork`
- repo名: `fumen-mobile-fork`
- 新GitHub Pages URL: `https://61bi-234469.github.io/fumen-mobile-fork/`

## Confirmed Policy

- `fumen-mobile-branch` のリダイレクト専用repoは作成しない。
- `fumen-for-mobile-ts` の旧URLリダイレクトrepoは維持し、転送先を `fumen-mobile-fork` に更新する。
- `fumen` は譜面ドメイン用語なので、内部型名、状態名、テストデータ、`src/lib/fumen/**` は変更しない。
- `knewjade.github.io/fumen-for-mobile` は本家参照として扱い、一括置換しない。

## Source Changes

### Display Name

対象:

- `resources/index.html`
- `resources/manifest.json`
- `resources/help.html`

変更内容:

- `Fumen Mobile Branch` を `Fumen Mobile Fork` に変更する。

### URL and Repository Name

対象:

- `README.md`
- `resources/jump.js`
- `resources/help.html`
- `src/components/modals/clipboard.tsx`

変更内容:

- `https://61bi-234469.github.io/fumen-mobile-branch/` を `https://61bi-234469.github.io/fumen-mobile-fork/` に変更する。
- 共有リンク、TinyURL用hidden input、bookmarkletを新URLへ揃える。

### Local Serve and Cypress

対象:

- `serve.js`
- `cypress/support/common.js`
- `cypress/integration/cold_clear_spec.js`
- `cypress/integration/url_behavior_spec.js`

変更内容:

- 主配信パスを `/fumen-mobile-fork` に変更する。
- ローカル互換用に `/fumen-for-mobile` は残す。
- `/fumen-mobile-branch` の恒久互換パスは残さない。
- Cypressのvisit先を `fumen-mobile-fork` に変更する。

### Package and Cache

対象:

- `package.json`
- `webpack.config.js`

変更内容:

- package nameを `fumen-mobile-fork` に変更する。
- Workbox `cacheId` を `fumen-mobile-fork` に変更する。

## GitHub Operations

1. GitHub repo名を `fumen-mobile-branch` から `fumen-mobile-fork` に変更する。
2. local `origin` を `https://github.com/61bi-234469/fumen-mobile-fork` に更新する。
3. 変更をcommitし、承認後に `main` へpushする。
4. GitHub Pages deploy成功を確認する。
5. 旧URL用repo `61bi-234469/fumen-for-mobile-ts` の `index.html` と `404.html` を更新し、転送先を `https://61bi-234469.github.io/fumen-mobile-fork/` にする。
6. `fumen-mobile-branch` のリダイレクトrepoは作成しない。

## Verification Plan

ローカル検証:

```powershell
node_modules\.bin\webpack.cmd --mode production
```

確認URL:

- `http://localhost:8080/fumen-mobile-fork/`
- `http://localhost:8080/fumen-for-mobile/`

公開URL確認:

- `https://61bi-234469.github.io/fumen-mobile-fork/`
- `https://61bi-234469.github.io/fumen-for-mobile-ts/` が新URLへリダイレクトされること

補足:

- 旧URLで通常ブラウザのService Workerキャッシュが残る場合、シークレットモードまたはサイトデータ削除で確認する。
- `node_modules\.bin\jest.cmd` は既存Cold Clear系テストのi18nモック不足で失敗する既知状態があるため、rename検証ではwebpack buildを主確認にする。

## Risks

- `fumen-mobile-branch` URLは恒久リダイレクト対象にしないため、共有済みリンクは将来的に切れる可能性がある。
- Service Workerの旧キャッシュが残っているユーザーでは、旧URLリダイレクト反映が遅れる場合がある。
- `resources/help.html` は保存HTML由来の文字列を含むため、必要なURLとtitleだけを最小変更する。

## Implementation Result

実施日: 2026-05-17

実装状況:

- ソース内の表示名、URL、package name、Workbox `cacheId`、Cypress pathを `Fumen Mobile Fork` / `fumen-mobile-fork` に更新した。
- `serve.js` は `/fumen-mobile-fork` を主パスにし、`/fumen-for-mobile` をローカル互換パスとして残した。
- `fumen-mobile-branch` のローカル互換パスは残していない。

未実施:

- GitHub repo rename
- local `origin` 更新
- commit / push
- GitHub Pages deploy確認
- 旧URL用repo `fumen-for-mobile-ts` のリダイレクトHTML更新