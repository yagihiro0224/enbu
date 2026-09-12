# みんなのランキングを動かす

ゲーム本体は GitHub Pages の静的配信なので、みんなで共有するランキングには保存先が要ります。
ここに置いてある `rank-worker.js` は、Cloudflare Workers の無料枠でそのまま動く小さな JSON API です。

設定しなくてもゲームは動きます。その場合、ランキングはその端末の中だけの記録になります。

## 手順（15 分ほど）

1. https://dash.cloudflare.com でアカウントを作る（無料）
2. 左の「Workers & Pages」→「Create」→「Create Worker」。名前は `enbu-rank` など。作成後「Edit code」
3. エディタの中身を全部消して、`rank-worker.js` の中身を貼り付けて「Deploy」
4. 左の「Storage & Databases」→「KV」→「Create a namespace」。名前は `enbu-rank`
5. Worker の「Settings」→「Bindings」→「Add」→「KV namespace」。
   Variable name は `RANK` を推奨。**違う名前でも動く**（コードが結び付いた KV を自動で探す）。
   Namespace は 4 で作ったものを選んで保存
6. Worker の URL（`https://enbu-rank.<アカウント名>.workers.dev`）を控える
7. `src/game/Rank.ts` の `RANK_ENDPOINT` にその URL を入れて、コミットして push

## 動くか確かめる

```bash
curl "https://enbu-rank.<アカウント名>.workers.dev?limit=5"
# → {"entries":[]}
```

KV を結び付け忘れていると、代わりにこう返る。

```json
{"error":"KV が結び付けられていない。Settings > Bindings で KV namespace を追加すること"}
```

ゲーム側は URL を書き換えなくても `?rank=<URL>` を付ければ試せます。

```
https://hiro0224world.github.io/enbu/?rank=https://enbu-rank.<アカウント名>.workers.dev
```

## 仕様

| 種類 | 内容 |
|---|---|
| GET | `?limit=50` で上位を返す。`{ entries: [...] }` |
| POST | 記録を 1 件追加し、更新後の上位と順位を返す |

保存するのは上位 100 件。同じ名前は最高記録 3 件までに絞るので、1 人が表を埋め尽くしません。
点数と秒数はサーバー側でも範囲を確かめ、名前は 12 文字に切り詰めます。

## 気をつけること

- **点数はブラウザが計算して送るので、その気になれば偽の記録を送れます**。
  友達うちで遊ぶ前提の作りです。厳密にしたい場合は、プレイの記録そのものをサーバーで検証する必要があります
- 保存は Workers KV です。ほぼ同時に複数人が登録すると、まれに片方が上書きされることがあります。
  人数が増えて気になるようなら D1（SQLite）に移すのが素直です
- 無料枠は 1 日 10 万リクエストまで。1 プレイで 2 回程度しか呼ばないので、まず届きません
