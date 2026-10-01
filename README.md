# fumen-mobile-fork

スマートフォンとPCで使える、テトリスのテト譜エディタです。

- [ユーザーマニュアル](https://61bi-234469.github.io/fumen-mobile-fork/manual/)
- [User manual in English](https://61bi-234469.github.io/fumen-mobile-fork/manual/en/)
- アプリ内では右下のメニューから **Help** を選んで開けます。

[knewjade/fumen-for-mobile](https://github.com/knewjade/fumen-for-mobile) をフォークし、次の機能を加えています。

- ページのリスト表示・ツリー（分岐）表示と、PC向けのサイドパネル
- 範囲選択とパーツスタンプ、HOLD/NEXT キュー、INPUT モード（統計・7bag グレー）
- Classic / SRS / SRS+ の回転システム切り替え
- Tetgram・GIF・画像の取り込みと書き出し
- Cold Clear による盤面分析と AI ゴーストガイド
- TETR.IO リプレイ（.ttrm）の再生、ガベージ再現、Cold Clear による手の評価

## Development

```bash
yarn install --frozen-lockfile
yarn dev          # watch build + http://localhost:8080/fumen-mobile-fork
yarn lint
yarn typecheck
yarn test
yarn webpack-prod
yarn cy-run --spec cypress/integration/<name>_spec.js
```

Contributor and agent guidelines are in [AGENTS.md](AGENTS.md).

## Third-Party Source Availability

For Cold Clear wasm artifacts included in `src/lib/cold_clear_wasm/`, corresponding
MPL-2.0 source information is provided in:

- `THIRD_PARTY_LICENSES.md`
- `third_party/cold-clear/README.md`

Licenses for other bundled third-party code (@haelp/teto, Material Icons,
Materialize, and npm dependencies) are listed in `THIRD_PARTY_LICENSES.md`.

### Memo

#### Bookmarklet Code: Load fumen from official page

```
var value = window.location.href;
if (
    value.match(/fumen.zui.jp\/\?v115@/) ||
    value.match(/fumen.zui.jp\/old\/110/) ||
    value.match(/harddrop.com\/fumen[tool]*/)
) {
    encode(1);
    value = document.getElementById('tx').value;
}

// window.location.href='https://61bi-234469.github.io/fumen-mobile-fork/#?d='+value;
window.open('https://61bi-234469.github.io/fumen-mobile-fork/#?d='+value, '_blank');
```

```
javascript:(function(){###CODE###})()
```
