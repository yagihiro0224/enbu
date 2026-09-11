# 炎舞 -ENBU- / 引き継ぎメモ

このファイルは、別の PC で Claude Code が作業を続けるための文脈です。README.md は遊ぶ人向け、こちらは開発者と Claude 向け。

## 現状（2026-09-10 時点）

- スマホブラウザ向け 3D ボス戦アクション。Steam『炎姫』のコンセプトを真似た個人の趣味プロジェクト
- 公開: https://hiro0224world.github.io/enbu/ （main への push で GitHub Actions が自動デプロイ）
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
- **動きの確認は `?combo&cam=q`（または side2）で 30fps の連続コマ 56 枚を 1 枚に貼る**。静止画 1 枚では動きの良し悪しが判断できない。
  ユーザー評価「アクションがカッコよくない」（2026-09-11）の後に導入。原因は振りが小さい・打撃が速くない・踏み込みがない、だった
- 打撃のキーは 5 つ: 構え → 予備動作（0.15〜0.3）→ 伸び切り（+0.15、2〜3 コマ）→ 行き過ぎ（+0.1）→ 戻り。Animator の rate は攻撃中 50
- **腕はオイラー角を直接書かず、Anim.ts の `arms({ L: [上腕の向き, 前腕の向き], R: [...] }, spine)` で方向ベクトルから作る**
  （根元座標、+Z 前・+Y 上・+X 左）。オイラー角の手書きは合成順で直感と食い違い、「ゾンビの腕」になった前科がある
- VRM の指は VrmRig の setFist で握る（Z 回転で掌側へ）。格闘スタイルなので常に握り拳
- ヒット時は hitstop / shake / punch（画角の一瞬の絞り、Ctx.punch）を段ごとに強くする
- ユーザー決定: 素手は格闘中心、銃を拾えば銃中心、ナイフを拾えばナイフ中心（武器拾得でスタイル切替）。未実装

## 主人公 2 人制（2026-09-11）

- UI.ts の `CHARS`: mahiro = 深川まひろ（player.vrm）、chisato = 杉本ちさと（chisato.vrm）。どちらもユーザー自作の VRM
- 起動時に両方を読み込み（Promise.all）、タイトルでキャラ選択。ゲーム中は HUD 左上の「交代」（PC は Q）で入れ替え。
  交代は待機・移動中のみ、クールダウン 1.2 秒、HP は共有。Player.setRig(rig, keepOld=true) で破棄せず切り替える
- VRoid のプロジェクトファイル（.vroid）は `vroid/` に置く。public/ には入れない（公開サイトに乗るため）
- 敵の弾は Boss.ts の BULLET_DENSITY = 0.1 で 10 発に 1 発（ユーザー指示「攻撃球を 10 分の 1 に」）。fire() の累積カウンタで間引く
- 動作確認: `?char=chisato`、`?t=2&swap`（交代を実行）

## キャラ別の戦闘スタイル（2026-09-11）

- Style.ts の `STYLES`。Player.style を Game.setChar で差し替える。攻撃定義・ポーズ関数・効果色・音・重さの倍率がここに集約
- **まひろ = 重い・赤**（color 0xff3a2a）: 従来の 5 段（ジャブ→ナイフのフック→アッパー→ハイキック→ジャンプ回し蹴り）。
  太い弧、地面の衝撃波、大きい火花、低い風切りと低音の着弾（Audio: whooshHeavy / slashHeavy / thud）。hitstop・shake・punch 1.4〜1.5 倍
- **ちさと = 鋭い・紫**（color 0xa040ff）: 別モーション（刺突ジャブ→ナイフ斜め切り下ろし→切り上げ→前蹴り→地上回転切り、Anim.ts の poseAttackChisato）。
  細い斬線（Fx.line）、速く小さい火花、高い風切りと金属的な着弾（whooshSharp / slashSharp / ping）。各段が短く、hitstop・shake は 0.6〜0.7 倍
- 軌跡の付け先は AttackCfg.trail（fist / knife / leg）。軌跡の色は Trail.setColor で切替
- 動作確認: `?char=chisato&combo&cam=side2` など

## 別の PC で始める手順

1. `git clone https://github.com/hiro0224world/enbu.git && cd enbu && npm install`
2. Claude Code をリポジトリ直下で起動し、「CLAUDE.md を読んで続きをやって」と伝える
3. 設定画や VRM/GLB ができたら `public/models/` に置くか、チャットに貼る

## タイトルの操作（2026-09-11 修正）

- **Input の操作 UI（#controls、z-index 20）は左半分全体がスティック領域なので、タイトル中に出ているとカードのタップを横取りする**。
  Input.setVisible(false) でタイトルとリザルトでは隠す。beginPlay で表示。過去に「まひろを選んでも反応しない」バグの原因になった
- タイトルはカードで選択（背景のキャラも即差し替え）→「ゲーム開始」ボタンで開始。UI.selected が選択中のキャラ

## クリア後のスコア（2026-09-11）

- Score.ts が集計。配点はユーザー指定: 打撃ヒット 30万/回、打撃（突進）パリィ 50万/回、弾パリィ 10万/回、
  ノーダメージ 1000万、タイム 1分以内 100万 / 2分以内 50万 / 3分以内 20万
- 称号: 神人間 1億 / 鬼人間 5000万 / 上級者人間 1000万 / 一般人人間 500万 / 下手人間 それ未満（2026-09-11 ユーザー確定）
- **コンボ倍率**: 上のボーナス合計に `1 + min(最大コンボ, 80) / 40`（1.0〜3.0）を掛ける。**敵の体力 800 が前提**。
  ボスの体力から打撃は 70 発前後が上限でボーナス合計は 3700 万ほどにしかならず、上位 2 つに届かないため追加した。
  ユーザーは「現実感のある条件に任せる」と一任。ボス HP や打撃の威力を変えたらここも見直すこと
- 明細は「各ボーナス → 小計 → コンボ倍率 → TOTAL」の順に出す
- **明細の行に animation-delay を付けない**。ヘッドレス（--virtual-time-budget）だと遅延つきアニメの要素が描画されず、
  後ろの行が消えたように写る。まとめて 1 回フェードさせている
- 称号は level 0〜4 で演出が変わる（.rk-lv4 が超派手＝虹色グラデ＋光条＋拍動、lv0 は小さい灰色）
- カウンタは Player の meleeHits / meleeParries / bulletParries / damaged。reset() で必ず 0 に戻す
- 勝利演出: Game.setupVictory()。勝者は Player の 'win' 状態（poseVictory、style.sharp で型が変わる）、
  もう一人は this.partner として scene に直接足して poseClap。カメラは正面 3.3m、注視点を右へずらして被写体を画面左に寄せる
- リザルトの立ち絵は `public/images/<mahiro|chisato>_cap.png`。無ければ枠ごと非表示（img の error で .noimg）
- 動作確認: `?t=1&win=42&sec=52&mp=3&bp=7`（勝ちリザルト）、`&lose` で負け、`&dmg` で被弾あり、`&char=chisato` で勝者を変更。
  注意: この debug 経路は同期ループのため、ヘッドレスだと overlay のフェード途中で撮れて全体が半透明に写ることがある（実機では問題ない）

- **開始時に requestFullscreen は呼ばない**（2026-09-11 ユーザー指示「急に全画面になるのはやめたい」）。画面の向きのロックも同時に廃止した。
  なお `public/manifest.webmanifest` の `display: fullscreen` はホーム画面に追加して起動したときだけ効くもので、プレイ中の切り替えとは別物。

- 立ち絵 `public/images/*_cap.png` はユーザー提供の「バストアップ｜全身（銃）」2 コマ並び（515x390）。
  `#res-cap` は aspect-ratio 0.64 + object-position 2% で左のバストアップだけを切り出している。絵を差し替えるならここを合わせ直す。

## 2026-09-11 の追加（打撃エフェクト・立ち絵の光・勝利の踊り）

- **打撃は Fx.impact（放射状のトゲのスプライト）**。刃物（AttackCfg.trail === 'knife'）だけ crescent / line の斬撃表現を使う。
  ユーザー指摘「打撃時のエフェクトが剣のような感じ」への対応。トゲの絵は Face.ts の impactTexture(トゲ数)
- 立ち絵の枠は `capglow` / `capaura` でゆっくり明滅する（無限アニメなのでヘッドレスでも描画される）
- **勝利ポーズは踊り**（Anim.ts の poseVictory）。4.4 秒で 1 周: 両手を上げて弾む → 片手を上げて 1 回転（hipsYaw）→ 手を振る。
  sharp（ちさと）は振幅 0.78 倍で控えめ。もう一人は poseClap で拍手し続ける
- 動作確認: `?win=42&vt=秒` で勝利後の経過時間を指定して撮る（finish の hitstop 2.2 秒が 0.3 倍速なので、
  実時間 vt に対しゲーム内時間はおよそ `0.3*min(vt,2.2) + max(0, vt-2.2)`）。`?dance` で連続コマも撮れる

- キャラ選択のカードにも立ち絵を入れた（`.cc-img`、リザルトと同じ左バストアップの切り出し）。未選択は彩度と明度を落とし、選択中はキャラ色で光る。
- 戦闘用 HUD（HP バー・交代・コンボ・操作説明）は `#hud.playing` のときだけ出す。タイトルとリザルトでは隠れる。

## 背景のリアル化（2026-09-11）

- 床は `MeshStandardMaterial` + キャンバス生成の石畳テクスチャ + 高さマップから作った法線マップ。UV を広げて 1 タイル ≒ 3.5m で繰り返す
- 魔法陣は床とは別メッシュ（加算合成）で重ねる
- **影を有効化**: `renderer.shadowMap` + Arena の `sun.castShadow`。キャラは Game の `castShadows()` で設定（輪郭線メッシュは除外）。
  低フレームレート時はブルームと一緒に自動で切る
- 舞台が浮いて見えないよう半径 120 の外周地面（土のテクスチャ）を敷いた
- 遠景は尾根 3 層 + 樹林。`mergeGeometries` で 1 メッシュにまとめて描画回数を抑えている
- 地表の靄（円筒 3 枚）をゆっくり流す。星と月のハローを追加

- 山は `mountainGeo()` で円錐の稜線を角度ノイズで崩し、頂上ほど明るい頂点色を付ける（`flatShading` で面が出る）。
- 木は `coniferGeos()` / `broadleafGeos()`。幹＋段になった葉で、群れ単位に置いてばらけさせる。
- 鳥居は明神鳥居。柱は内側に傾けて先細り、笠木と島木は頂点を持ち上げて反りを付ける。貫は柱の外へ出し、額束を入れる。
  木目は `woodTexture()` のキャンバス生成。輪郭線は使わず光と質感で見せる。
- 動作確認用カメラ `?cam=torii` を追加。

## 2026-09-11 の追加（弾の見た目・HP ゲージ・敵の体力）

- 丸い弾（kind 0）は板をカメラに正対させ、`orbTexture()` の模様（芯・二重の輪・光条・外周の粒）を描く ShaderMaterial。
  `instanceMatrix` から中心と大きさを取り出して頂点シェーダーで板を広げる。模様は uTime でゆっくり回す。
  球のままだと塗りつぶした円に見えたのが理由。針（kind 1）は先端が明るくなるグラデーションを貼った
- 敵の体力は Boss.ts の `BOSS_HP`。**いまの 400 は検証用の臨時値**で、本来は `BOSS_HP_NORMAL` = 800。
  検証が終わったら 800 に戻す。`?hp=数値` でも上書きできる。
  **臨時値を前提にスコアやバランスを恒久調整しないこと**（一度やって戻した）
- HP ゲージは重ならないよう、敵のゲージを 42px 下げ、幅も主人公 min(32vw,240px) / 敵 min(46vw,400px) に狭めた
