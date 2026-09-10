# 炎舞 -ENBU- / 引き継ぎメモ

このファイルは、別の PC で Claude Code が作業を続けるための文脈です。README.md は遊ぶ人向け、こちらは開発者と Claude 向け。

## 現状（2026-09-10 時点）

- スマホブラウザ向け 3D ボス戦アクション。Steam『炎姫』のコンセプトを真似た個人の趣味プロジェクト
- 公開: https://yagihiro0224.github.io/enbu/ （main への push で GitHub Actions が自動デプロイ）
- Three.js 0.186 + TypeScript + Vite。物理エンジンなし。弾は InstancedMesh、演出は Fx.ts、ブルームは UnrealBloom
- キャラは Figure.ts のプリミティブ製 7 頭身アニメ調フィギュア。目はキャンバス描画テクスチャ
- `public/models/player.vrm` を置くと主人公が VRM に差し替わる（VrmRig.ts。VRM での実動作は未検証）
- 実機スマホでの動作は未確認。ヘッドレス Chrome の確認のみ

## 開発コマンド

```bash
npm install
npm run dev        # http://localhost:5173 （--host で LAN のスマホから確認）
npm run build      # tsc --noEmit && vite build
```

## 動作確認の方法（ヘッドレス Chrome）

Windows で Chrome がある前提。SwiftShader で WebGL を動かしてスクリーンショットを撮る。

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader \
  --ignore-gpu-blocklist --window-size=960,440 --hide-scrollbars --virtual-time-budget=6000 \
  --screenshot="C:\path\to\out.png" "http://localhost:5173/?t=6&bot"
```

URL クエリ（Game.ts の init を参照）:

- `?autostart` タイトルを飛ばして開始
- `?t=秒` 開始から指定秒ぶん同期的に早送り（タイトルも即消す）
- `?bot` プレイヤーを乱数で自動操作
- `?slash=1|2|3&f=フレーム数` 早送り後に指定段の斬撃を強制し、f フレーム進めて止める（無敵付き）
- `?cam=front|boss` 主人公またはボスの正面アップ
- `?nobloom` ブルームを切る

注意: `--virtual-time-budget` は同期ループ中に消費されるので、CSS のフェードが途中の状態で撮れることがある（バグではない）。ヘッドレスは最小幅 500px 程度なので縦画面の UI は正確に検証できない。

## コードの規約

- Rig（Rig.ts）: root は足元原点、+Z が正面、T ポーズ基準。左腕は +X、右腕は -X に伸びる。ポーズは Anim.ts に集約
  - 腕を下ろす: 左 z 負、右 z 正。腕を前へ: 左 y 負、右 y 正。脚を前へ: x 負
- 入力→世界座標: 前 = (sin yaw, 0, cos yaw)、右 = (-cos yaw, 0, sin yaw)。過去に符号を間違えて左右が逆になった
- ボスの行動は Boss.ts のジェネレータ関数。`yield 秒` で待つ。パターン追加は `pick()` の表に足す
- 当たり判定は Game.ts の collide()。キャラの高さは rig.height から出す（固定値を書かない）
- 発光させたいものは `toneMapped: false` で 1.0 超の色を使う（ブルームの閾値 0.82）
- 日本語コメント、絵文字なし

## GitHub 操作

- gh CLI は未導入（winget が途中で止まった）。Git Credential Manager のトークンを API に使える:
  `printf "protocol=https\nhost=github.com\n\n" | git credential fill` の password を `Authorization: token` に
- Pages は build_type=workflow で有効化済み。デプロイ確認は Actions の runs API をポーリング

## 決定の経緯

- アプリ（Unity）ではなくブラウザ（Three.js）: Windows 環境で iOS 配布が面倒、審査なし、URL 配布、AI との相性
- 最初はちび体型だったが「もっとリアルに、今時の日本のゲーム風に」の要望で 7 頭身に置き換え
- 演出は「派手に」が好み。ヒットストップ、閃光、光の柱、ブルームを積んだ
- VRoid Studio は API がなく、MCP は Linux の GUI 自動化しかない（Windows 不可）。VRM は人が作って渡す前提
- AI 3D 生成の経路: Meshy（公式 MCP あり、有料）、Tripo（API）、ローカル Hunyuan3D + UniRig（ComfyUI）

## 次の企画（着手前。ユーザーの要件待ち）

現実社会が舞台の、依頼を受けてターゲットを殺す女の子の殺し屋アクション。格闘・銃・ナイフ。

- 主人公の見た目（ユーザー提供の参照画像から要素のみ引き継ぐ。実在の人物の顔と商品は複製しない）:
  金髪ショートボブ、眠そうな半眼、無表情。青×赤×白の切り替えトラックジャケット、グレーのロゴ T シャツ、
  グレーのワイドカーゴパンツ、黒の編み上げブーツ、サプレッサー付き拳銃
- 操作案: 炎舞の「斬・避・受・射」を「格闘・回避・パリィ・射撃」に置き換え。ナイフは格闘コンボの締め
- 弾幕の代わりに敵の銃撃をカバーと回避でさばく。舞台は裏路地、駐車場、雑居ビルなど
- 炎舞は完成品として残し、新プロジェクトで始める案を提案中
- 未決定: 敵・ターゲット、舞台、格闘中心か銃中心か、3D 化のエンジン
- 設定画の生成プロンプト（ComfyUI 用。この PC ではなく生成できる PC で）:

```
masterpiece, anime style, full body, front view, A-pose, standing straight, plain white background, flat lighting, no shadow,
1girl, short blonde bob hair, sleepy half-closed eyes, expressionless, small mouth,
color-block track jacket (navy blue, red, white panels), oversized grey logo t-shirt underneath,
baggy grey cargo pants, black lace-up boots, holding a suppressed handgun at her side,
clean lineart, simple cel shading, game character reference sheet
negative: background, scenery, multiple views, extra limbs, weapon raised, dynamic pose, text, watermark, blurry, realistic photo
```

## AI でキャラを作るパイプライン（2026-09-10 に確立。ComfyUI は C:\Users\yagih\ComfyUI、RTX 5090）

スクリプトの写しは `docs/` にある（実体は ComfyUI/tools/）。

1. 設定画: `tools/charsheet_wan.py --views front --quality` — Wan 2.2 14B T2V を 1 フレームで静止画化。
   20 ステップでも 20 秒。背面ビューは出ない（正面が出る）。武器は持たせない（スリングの銃になる）
2. 背景の切り抜き: 外側から連結した白を透明にする（docs/ の手順は paint_mesh.py 冒頭参照、input/assassin_front_rgba.png）
3. 画像→3D: `tools/img2mesh_hy3d.py --image assassin_front_rgba.png --res 384 --threshold 0.5` —
   ComfyUI 標準の Hunyuan3D 2.1 ノード（hunyuan_3d_v2.1.safetensors、7.37GB、DL 済み）。30 秒。形状のみ、テクスチャなし。
   出力の正面は +Z（トゥで判定したら逆だった。ジッパーの見える側が正面）
4. 色付け: `tools/paint_mesh.py --decimate 60000` — 正面画像を正射影した UV とアトラス（左=正面、右=左右反転して暗くした背面、
   後頭部は髪色で塗りつぶし）。60k 面で 2MB
5. ゲームに入れる: `public/models/<名前>.glb` に置き、`?model=<名前>` で起動すると AutoRig.ts が比率ベースで骨とウェイトを付けて
   主人公に差し替える（Mixamo 不要）。A ポーズ前提。ヘッドレス確認は `?model=assassin&nobitmap&t=1.6&cam=front`
   （仮想時間下では createImageBitmap が返らないので nobitmap が要る）
6. 現在 `public/models/assassin.glb` が殺し屋の女の子の AI 生成モデル（ユーザー評価は「形が変」。単画像 3D の限界）
7. **VRM 経路は 2026-09-11 に実動作を確認済み**。VRoid Studio 2.3.0 を winget（pixivInc.VRoidStudio、ユーザー単位）で導入。
   `public/models/player.vrm` を置くと起動時に読み込み、手続きアニメがそのまま乗る（VRM 1.0、3.5 万ポリゴンで確認）。
   player.vrm はユーザー自作（2026-09-11 確認）なのでリポジトリに入れて公開している。
   ヘッドレス確認は `?nobitmap&t=1.6&cam=front`（VRM の読み込みは早送りより先に await する構造）
   注意: VRoidStudio フォルダには unins000.exe（アンインストーラ）が同居している。起動は必ず VRoidStudio.exe をフルパスで

## 2026-09-11 の変更（殺し屋ゲームへの移行を炎舞のコード上で開始）

- 主人公名「深川まひろ」。ボタン「斬」→「打」。連打で 5 段格闘コンボ（Player.ts の ATTACK と Anim.ts の poseAttack）:
  1 ジャブ、2 ナイフのフック、3 アッパー、4 ハイキック、5 ジャンプ回し蹴り（hipsYaw で腰を一回転）
- 刀は廃止。Weapons.ts の createKnife（逆手持ち。刃は肘側 +X、前腕の少し下）
- ポーズは poseSeq([[進行度, Pose], ...], p) のキーフレーム補間で作る。構えは GUARD 定数
- 動作確認: `?slash=1..5&f=フレーム&cam=side2`（side2 = キャラの右側から。蹴り脚が見える）。`?novrm` でプリミティブ体型
- ユーザー決定: 素手は格闘中心、銃を拾えば銃中心、ナイフを拾えばナイフ中心（武器拾得でスタイル切替）。未実装

## 別の PC で始める手順

1. `git clone https://github.com/yagihiro0224/enbu.git && cd enbu && npm install`
2. Claude Code をリポジトリ直下で起動し、「CLAUDE.md を読んで続きをやって」と伝える
3. 設定画や VRM/GLB ができたら `public/models/` に置くか、チャットに貼る
