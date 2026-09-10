# 炎舞 -ENBU-

スマホのブラウザで遊べる、アニメ調の 3D ボス戦アクション。
妖魔の少女・紫苑が放つ立体弾幕を、回避と受け流し（パリィ）でさばきながらコンボを叩き込む。

Steam の『炎姫』（Crimson Dusk）のコンセプトを参考に、個人の趣味で作ったオマージュ作品です。

## 遊び方

- **移動**: 画面左半分をドラッグ（仮想スティック）
- **斬**: 3 段コンボ。斬撃は弾も消せる。3 段目は炎の斬撃波を飛ばす
- **避**: 無敵つきダッシュ。弾幕を突っ切れる
- **受**: 弾に触れる直前に押すと弾き返して反撃。ボスの突進もパリィできる
- **射**: 遠距離の火弾。削り用
- ボスの「体勢」を削り切ると崩し状態になり、大ダメージが入る
- PC では WASD 移動、J 斬、K/Space 避、L 受、I 射

## 技術

- Three.js + TypeScript + Vite
- 物理エンジンなし。円・カプセル判定を自前実装
- 弾幕は `InstancedMesh` で数百発を一括描画
- キャラクターはプリミティブで組んだトゥーン調ちびキャラ。輪郭線は裏面押し出し
- 効果音は WebAudio の合成音（音声ファイルなし）
- PWA 対応（ホーム画面に追加するとフルスクリーンで遊べる）

## VRoid で作ったキャラに差し替える

`public/models/player.vrm` に VRM ファイルを置くだけで、主人公が差し替わります（[@pixiv/three-vrm](https://github.com/pixiv/three-vrm) を使用）。
VRoid Studio の書き出し時に「ポリゴン削減」「テクスチャ統合」を有効にすると、スマホでも軽く動きます。

## 開発

```bash
npm install
npm run dev      # http://localhost:5173  （--host で LAN 内のスマホから確認可）
npm run build    # dist/ に出力
```

動作確認用のクエリ:

- `?autostart` タイトルを飛ばして即開始
- `?t=30` 開始から 30 秒ぶん早送りした状態にする
- `?bot` プレイヤーを自動操作する

## デプロイ

`main` に push すると GitHub Actions が GitHub Pages に自動デプロイします。

## 構成

```
src/
  main.ts            エントリ
  game/
    Game.ts          ループ、カメラ、当たり判定、勝敗
    Player.ts        操作、コンボ、回避、パリィ、射撃
    Boss.ts          弾幕パターン（ジェネレータ）、フェーズ、崩し
    Bullets.ts       弾プール（InstancedMesh）
    Particles.ts     火花などのパーティクル
    Chibi.ts         プリミティブ製ちびキャラ
    VrmRig.ts        VRM 読み込み
    Anim.ts          手続きアニメーション（ポーズ定義）
    Arena.ts         ステージ（床、鳥居、灯籠、空、火の粉）
    Input.ts         仮想スティックとボタン、キーボード
    UI.ts            HP バー、コンボ、タイトル、リザルト
    Audio.ts         合成効果音
    Toon.ts          トゥーン素材、輪郭線
```

## ライセンス

MIT
