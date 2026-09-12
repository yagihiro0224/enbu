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
- 敵の体力は Boss.ts の `BOSS_HP` = **800**（2026-09-12 にユーザー了承のうえ臨時値 400 から戻した）。
  短く決着させたいときは `?hp=数値` で上書きする。**コードの値を検証のために書き換えないこと**。
  一度 400 のまま放置してスコアのバランスを誤って恒久調整した前科がある
- HP ゲージは重ならないよう、敵のゲージを 42px 下げ、幅も主人公 min(32vw,240px) / 敵 min(46vw,400px) に狭めた

## ナイフの廃止（2026-09-11）

- ユーザー指示で武器を外し、**全段を素手の格闘**にした。VrmRig / Figure / AutoRig は武器を付けない（`weapon: 'none'` / `weapon: null`）
- Style.ts の kind 'knife' と TrailPart 'knife' は型に残っているが、どの段からも使っていない（将来武器を持たせるとき用）
- 軌跡の付け先に 'fistR'（右前腕）を追加。右手で打つ段はこれを使う
- Weapons.ts の createKnife / createStaff は残してある。ボスは今も杖を持つ

## 回復とキャラ別の体力（2026-09-11）

- `Items.ts`: ステージに回復アイテム 3 個（arenaR*0.64 の円周上に等間隔）。触れると +30、1 戦闘につき 1 個 1 回。
  `restart()` で `items.reset()`。緑の八面体＋ハロー＋地面のリング。**加算合成なのでブルームで飛びやすく、色は控えめの値にしてある**
- **体力はキャラごと**: Game の `charHp: Record<CharId, number>`。`setChar()` で現在値をしまって交代先を読み出す。
  控えているキャラは `REST_REGEN = 2.5`/秒で回復（プレイ中のみ）
- 交代ボタンに控えの名前と体力バーを出す（`UI.setRest`）。控えの体力を見て交代を判断させるため
- **どちらかが倒れたら負け**は変わらない（操作中のキャラの体力が 0 → `onPlayerDead` → 敗北）。控えは回復しかしないので倒れない
- 動作確認: `?lowhp=数値` で体力を減らして開始

## BGM（2026-09-11）

- `Music.ts`。音声ファイルは使わず WebAudio の合成音。イ短調 Am→F→G→Em の 4 小節ループ、126BPM。
  パッド・アルペジオ・ベース・バスドラ・スネア・ハイハット・主旋律を自前の音色で鳴らす
- **先読み方式**（40ms ごとに 0.25 秒先まで予約）なのでループの継ぎ目が出ない。`setInterval` は AudioContext の時計で補正している
- 濃さは 3 段階: 0 静か（タイトル・リザルト）/ 1 戦闘 / 2 終盤（ボス第 3 形態）。Game が場面に応じて `setIntensity`
- `Sfx.audio` で AudioContext・出力先・ノイズ音源を借りる。**AudioContext は操作がないと開けない**ので、
  タイトルでキャラを選んだ時点（`UI.onGesture`）で開けて静かな曲から始める
- 右上の ♪ ボタンで切り替え。設定は localStorage の `enbu.music` に覚える
- **検証**: `?musictest`（または `?musictest=2` で 1 段階だけ）で OfflineAudioContext に描き出し、peak と rms を console に出す。
  実測 lv0 peak 0.122 / lv1 0.360 / lv2 0.403（Sfx の master 0.5 を通る前の値）

## ボスの VRM（2026-09-11）

- `public/models/boss_001.vrm`（ユーザー自作、17.9MB / 4.9 万ポリゴン）。`vroid/model_boss_001.vroid` が元データ
- `tryLoadVrm(url, { weapon: 'staff' })` で杖を右手に持たせる。**VRM は等身大なので杖は 0.6 倍に縮め、
  Z を 180 度回して腕を下ろしたときに上を向くようにしてある**
- `Boss.setRig()` を追加。**VRM は身長を揃えるため root を縮めているので、`baseScale` を覚えて
  reset と消滅演出のスケールに掛ける**（1 に戻すと巨大化する）
- ボスの VRM は `await` せず裏で読み込む。タイトルを早く出すため。読めた時点で差し替わる
- **3 体で約 46MB**。スマホの初回読み込みが重いので、VRoid の書き出しでポリゴン削減とテクスチャ統合を
  有効にしてもらうのが next step

## 揺れ物（髪）の暴発（2026-09-11 修正）

- 症状: ボスが瞬間移動すると後ろ髪が引き伸ばされて消えたように見える
- 原因: VRM のスプリングボーンは前フレームの位置から計算するため、位置が一気に飛ぶと発散する。
  さらに Boss.update は `rig.update(dt)`（揺れ物の計算）の**後**に `group.position` を入れていたので 1 フレーム遅れていた
- 対処:
  1. 位置と向きを `rig.update(dt)` より**前**に確定させる
  2. 前フレームから 2m 以上飛んだら `group.updateMatrixWorld(true)` → `rig.resetSprings?.()` で今の姿勢から組み直す
  3. `Rig.resetSprings?()` を追加（VrmRig は `vrm.springBoneManager?.reset()`）。Boss / Player の reset と setRig でも呼ぶ
- 検証: `?tp` でボスを (7,0,-7) へ瞬間的に飛ばす。`?tpf=コマ数` で観察するフレームを変えられる

## BGM を緊迫感のある曲に作り直し（2026-09-11）

- テンポ 126 → **152**
- コードを Am→F→G→Em から **Am→G→F→E（アンダルシア終止）** に。最後の E は長三和音（G#）で強い緊張を作る
- 主旋律は和声的短音階の 8 分音符で押す。音色を三角波からのこぎり波＋ローパスに変えて 鋭く
- ベースは 8 分の刻み＋裏で 1 オクターブ跳ね。フィルタの共鳴を上げて攻撃的に
- 低い持続音（drone）、裏拍の刺し（stab）、4 小節終わりの立ち上がりノイズ（sweep）を追加
- 実測 lv1 peak 0.387 / rms 0.0320、lv2 peak 0.438 / rms 0.0407

## 攻撃音の作り直し（2026-09-11）

- Sfx に**残響（ConvolverNode + 自前の減衰ノイズ IR、0.42 秒）**と**歪み（WaveShaper、tanh）**の段を追加。
  `send(node, amount)` で残響へ送り、`drive()` で潰す
- 打撃は 1 音ではなく重ねて作る: 立ち上がりの破裂（高域ノイズ 0.02〜0.03 秒）＋ 胴鳴り（歪ませた三角波の下降）
  ＋ 低い芯（サイン波の下降）＋ 余韻（ローパスしたノイズを残響へ）
- **ちさとの着弾は金属音をやめた**（2026-09-11 ユーザー指摘「ちさとの攻撃音、変だよ」）。素手の打撃なので鐘のような倍音は合わない。
  `sharpHit()` = 高域の破裂 0.014 秒 ＋ 1900→620Hz へ落とす帯域ノイズ（歪ませる）＋ 240→84Hz の短い芯。`ping()` は廃止
- **低音を速く大きく下げると「ボヨン」と跳ねて聞こえる**（同「ぴょんぴょん過ぎる」）。thud / heavyHit は下げ幅を詰めて
  （190→62 を 150→96、96→34 を 72→46）長さを伸ばした。敵の発射音も上昇する正弦波をやめ、200→68Hz の下降＋空気のノイズにした
- 風切りは帯域通過の中心周波数を弧を描くように動かす。**Q を上げるとエネルギーが落ちて聞こえなくなる**ので 0.9〜1.3 に留める
- `Sfx.bindTo(ctx, dest)` で OfflineAudioContext に繋げる。**検証は `?sfxtest`**（`?sfxtest=ping` のように名前で絞れる）。
  実測 whooshHeavy 0.148 / thud 0.501 / heavyHit 0.177 / whooshSharp 0.182 / sharpHit 0.291 / sharpHitHeavy 0.439 / bossShoot 0.107（master 0.5 の前）
- 音を変えたら必ず `?sfxtest` で測る。耳で確認できないので数値が唯一の裏づけ

## 音声ファイルの BGM（2026-09-11）

- `public/audio/` に mp3 を置くと `Bgm.ts` がそれを鳴らし、合成 BGM（Music.ts）は使われなくなる。
  `bgm.mp3` が無ければ従来どおり合成 BGM のまま（`findBgmFiles()` が null を返す）
- 探す名前は `Bgm.ts` の `FILES`（候補の配列。先に見つかったものを使う）。
  戦闘は `boss_battle_bgm_001.MP3`（ユーザー提供、2026-09-11）→ `bgm.mp3` の順。静か `bgm_calm.mp3`、終盤 `bgm_hard.mp3` は任意で、
  無ければ戦闘曲を音量違いで使う。**大文字小文字も一致させること**
- ループは AudioBufferSourceNode の `loop`。曲が変わるときだけ 0.9 秒重ねて入れ替える
- **書き出した mp3 は前後に無音が付くのでそのままループすると継ぎ目で音が切れる**。`trimRange()` が -48dB を境に
  実音の範囲を探し、`loopStart` / `loopEnd` に入れている。boss_battle_bgm_001.MP3 は 202.84 秒のうち 0.44〜201.12 秒を使う
- mp3 が読めなかったときは `Bgm.ready()` が false を返し、Game が合成 BGM に差し替える
- **開発サーバーは存在しないパスに index.html を返す**ので、HEAD の結果は content-type も見て弾いている
- 濃さの指定は Game の `setMusicLv()` に集約した。音が開く前の指定も覚えて、BGM ができた時点で反映する
- 音量は Bgm.ts の `GAINS`（0.55 / 0.95 / 1.1）。Sfx の master 0.5 を通るので実際はこの半分。
  提供曲は max -9.4dB / mean -24.3dB なので、合成 BGM（ピーク 0.39）と釣り合うこの値にした
- **検証は `?bgmtest`**。置かれているファイル名を出す。ただし**仮想時間下では decodeAudioData が返らない**ので
  （createImageBitmap と同じ）、長さ・無音位置・音量の数値までは出ない。無音位置は ffmpeg で PCM に落として同じ走査を回して確かめた
- **Suno の無料プランは曲のダウンロードができない**（2026-09-11 に上限到達を確認）。無料プランの曲は商用利用の権利も付かない

## スマホで交代ボタンが押せなかった（2026-09-11 修正）

- 症状: PC では Q キーで交代できるのに、スマホでは交代ボタンをタップしても反応しない
- 原因: `#stick-zone`（画面の左半分を上から下まで覆う仮想スティックの領域、`#controls` の z-index 20）が
  `#hud`（z-index 10）より手前にいて、左上の交代ボタンへのタップを全部横取りしていた。
  **タイトルのキャラカードが押せなかったのと同じ原因**（あのときは操作 UI を隠して回避した）
- 対処: `#hud` を z-index 30 にして操作 UI より手前へ。HUD は `pointer-events: none` で、
  実際に押せるのは交代ボタン・♪ ボタン・オーバーレイだけなので、スティックやボタンの操作は奪わない。
  合わせて `#swap::before`（inset -10px）で当たり判定を少し広げた
- **検証は `?hittest`**。各ボタンの中心を `elementFromPoint` で調べ、手前にいる要素を出す。
  `?nobitmap&t=3&hittest` で戦闘中、`?hittest` 単体でタイトルの状態を見る。
  交代ボタンは 2 人そろっている必要があるので `?novrm` では出ない（VRM を読む形で確認すること）
- 修正前は `hittest #swap: NG 手前は #stick-zone`、修正後は `OK`。z-index を戻して再現も確認済み

## 難易度上げとゲージの配置（2026-09-11）

- 敵の弾を 2 倍に。`BULLET_DENSITY` 0.1 → **0.2**（元の弾幕の 1/5）
- 敵から受けるダメージを 1.2 倍に。Player.ts の **`ENEMY_DMG_MUL`** で一括。
  弾（Game.collide）も突進（Boss の lunge、素の値 22）もすべて `Player.takeDamage` を通るので、増やすならここだけ触る
- 敵の HP ゲージは中央寄せをやめて**右寄せ**（`#bhp-wrap` を right 指定、text-align: right）。
  左上の主人公のゲージと左の交代ボタンに被らないようにするため。上端は ♪ ボタンの下に来るよう 46px 下げてある
- ボスの体力は 2026-09-12 に 800 へ戻した。この難易度はその前提

## ランキングと名前入力（2026-09-12）

- `Rank.ts` が記録の保存と送信を持つ。**端末内（localStorage）は常に動き、共有サーバーは任意**
  - 名前 `enbu.name`、記録 `enbu.rank`（上位 100 件）。名前は `cleanName()` で制御文字を落として 12 文字に切る
  - 共有は有効。`RANK_ENDPOINT` = `https://enbu-rank.yagi-hiro-0224.workers.dev/`（2026-09-12 にユーザーの
    Cloudflare アカウントで用意。Worker 名 enbu-rank、KV 名前空間 enbu-rank を変数名 RANK で結び付け）。
    **検証は `?rank=<URL>` で書き換えずに差し替えられる**
- サーバーは `server/rank-worker.js`（Cloudflare Workers + KV）。手順は `server/README.md`。
  **KV は変数名が RANK でなくても動く**（`kvOf()` が get と put を持つ結び付けを探す）。結び付け忘れは 500 と説明文を返す。
  記録を全部消したいときは、ダッシュボードの KV Pairs でキー `top` を削除する
  GET は上位を返し、POST は 1 件足して更新後の上位と順位を返す。同じ名前は最高記録 3 件までに絞っている
- **点数はブラウザが計算して送るので偽装できる**。友達うちで遊ぶ前提の作り。README にもそう書いた
- 画面: タイトルに名前入力（`#pname`）と「ランキング」（`#rankbtn`）、リザルトに上位 5 件（`#res-rankbox`）と「結果を共有」。
  ランキング画面は `#rankboard` / `#rank-panel`。**`#res-panel` と id を分けること**（最初に同じ id を 2 つ置いてしまった）
- 記録するのは**勝ったときだけ**。負けは載せない
- 共有は `navigator.share` があればそれ、無ければクリップボードへ写して「コピーしました」と出す
- **検証は `?rankdemo`**（見本の表を出す。保存はしない）と `?hittest`（名前欄とランキングのボタンも見る）
- ついでに直した: **タイトル中に ♪ ボタンが押せなかった**。オーバーレイが上に乗っていたので `#music` に z-index 5 を付けた

## 進化の強化と見た目（2026-09-12）

- **ちさとの打撃音はまひろと同じ**にした（ユーザー指示）。鋭さは色と軌跡で出す。`whooshSharp` / `sharpHit` は未使用で残してある
- **まひろの 5 段目（ジャンプ回し蹴り）は `lunge: 0`**。前へ出ると敵を通り過ぎて当たらないという指摘への対応。
  間合いが遠いときの `lungeBoost` は残してあるので、届かない位置からは踏み込む
- **進化ごとに攻撃の数と威力が 1.3 倍**。Boss.ts の `powerMul`（1 → 1.3 → 1.69）を
  `fireAcc` の増分と弾の `damage`、突進のダメージに掛ける
- **進化すると電気をまとう。当たり判定はない見た目だけの効果**。`Fx.spark()` は折れ線を数本置き、
  3 フレームごとに形を作り直して瞬かせる。進化の瞬間に大きく 1 回、その後は 0.16〜0.26 秒ごとに小さく出す。
  位置は `sparkOrigin`（浮いている高さを足した胴の位置）。足元に出ると体から離れて見える
- **服の色は第二形態で赤、最終形態で金**。`Rig.setClothTint?()` → VrmRig が実装。
  名前に CLOTH を含むマテリアルだけを対象にする（VRoid の命名は `N00_010_01_Onepiece_00_CLOTH_01`）。ボスは 18 個が該当
  - **生地が黒いので色を掛けるだけでは染まらない**。`amount` が 1 を超えたぶんは「掛ける明るさ」として扱い、
    黒い生地を持ち上げてから色を乗せている。赤 2.2、金 5.5。金は黒地だと茶色に沈むので特に強くしている
  - 発光も少し足す。**`setFlash` が毎フレーム emissive を base へ戻すので、その base 自体を書き換える**こと
- 検証: `?bphase=2|3`（進化させる。`&bf=コマ数` で観察する時点をずらす。**進化直後は閃光で真っ白になるので 150 コマほど進める**）、
  `?clothdbg`（服として掴めたマテリアルを数える）

## モデルの軽量化（2026-09-12）

- 初回の通信量を実測: 合計 31.4MB（VRM 3 体 25.7MB、BGM 4.9MB、残り 0.8MB）。
  GitHub Pages の目安は月 100GB なので、まっさらな読み込み **月およそ 3,400 回**が上限。2 回目以降はほぼ通信しない
- Cloudflare の無料枠で効くのは**書き込み 1 日 1,000 回**（KV）。クリア 1 回につき 1 回なので余裕がある
- **VRM に埋まっているサムネイル（1.1〜1.7MB）はゲームでは使わない**。`scripts/strip_vrm_thumbnail.py` で
  1x1 の透明 PNG に差し替えて 3 体で約 4MB 減らした（31.4MB → 27.4MB）。**見た目は一切変わらない**
  - 画像の要素ごと消すと images / textures の番号がずれて他の参照が壊れる。**中身だけ差し替えて番号は残すこと**
  - bufferView を順に詰め直して byteOffset / byteLength を振り直す。4 バイト境界に揃える
- さらに減らすなら VRoid の書き出しでテクスチャ統合とポリゴン削減。ただし
  **テクスチャ統合はマテリアルをまとめるので、ボスの服を染める `setClothTint`（名前に CLOTH を含むものだけ対象）が壊れる**。
  やるならこちらも作り直しが要る

## ランキングの安全弁と規模（2026-09-12）

- **検証用の起動は本番のランキングに書き込まない**。`Rank.ts` の `isDebugRun()` が
  `?win ?lose ?bot ?hp ?lowhp ?t ?rankdemo ?sharetest` と localhost を弾く。
  これを入れる前に、ヘッドレスの `?win` 検証で「ななし 39,990,000」が 2 件本番に入った（KV Pairs の `top` を消して掃除する）
- **共有は「Xに投稿」と「コピー」の 2 つのボタン**。`navigator.share` は使わない。
  端末の共有画面はリンクだけを渡す先が多く、点数が消えるため（X の投稿欄にリンクしか入らないとユーザーから指摘）。
  さらに「コピーだけでは投稿できない」と再度の指摘があり、X の投稿画面を直接開く形にした
  - X は `https://x.com/intent/post?text=...&url=...`。新しいタブが開けなかったときはコピーに落とす
  - 文面は `shareText()`。検証は `?win=42&sec=52&sharetest`（文面と組み立てた URL を出す）
- **Worker は上位 100 位に入らない記録では KV に書き込まない**。無料枠の書き込みは 1 日 1,000 回までで、
  大人数が遊ぶとここが先に詰まる。低い点を 200 回送っても書き込みが増えないことを手元で確認済み
- 規模の目安: 初回読み込み 26MB。GitHub Pages の月 100GB なら**まっさらな読み込み 月およそ 4,100 回**。
  800 人が 1 日で遊んでも 20.8GB で、通信量は問題にならない

## 音声ファイルの効果音と難易度（2026-09-12）

- **効果音も音声ファイルを使えるようにした**。`public/audio/sfx/` に置き、`Audio.ts` の `SAMPLES` で名前と対応づける。
  読めなければ従来の合成音に落ちる。`unlock()` の直後に裏で読み込む
  - `playSample(name, { gain, rate, gap, cut })`。**gap** はその秒数の間は鳴らし直さない（弾幕で音が潰れるのを防ぐ）、
    **cut** は尾を切る長さ。素材は 1.4〜2.1 秒と長いので、射は 0.85 秒、敵の発射は 0.7 秒に切っている
  - 現在の素材（ユーザー提供）: `shoot.mp3`（射）、`boss_shot1.mp3` / `boss_shot2.mp3`（敵の発射。交互に鳴らす）
  - **敵の「ためる音」（`bossCharge`）も同じ音源**を rate 0.62 で低く遅くして鳴らす。
    合成音のままだと攻撃のたびに別の音が混ざる（2026-09-12 にユーザーから「ぽんぽんって音が残っている」と指摘）
  - **下降する正弦波は「ぽん」と跳ねて聞こえる**。`bossShoot` の代役（音源が間に合わないとき）はノイズだけにしてある
  - 素材のピークは 0dB 近いので gain は 0.4〜0.55 に抑えてある
  - **仮想時間下では decodeAudioData が返らない**ので、ヘッドレスでは常に合成音になる。音の確認は実機で
- **射の演出を作り直した**。銃口の閃光を大きくし、火花を前へ飛ばし、足元に反動の輪を出し、後ろへ少し下がる。
  弾はスタイルの色で速く（24 → 34）
  - 軌跡は `Fx.beam()`。**板ではなく筒で描く**。板だと横から見たとき厚みがゼロになって消える（最初これで見えなかった）。
    太さは半径 0.14、中に白い芯。検証は `?shot&sf=コマ数&cam=side2`
- 難易度（ユーザー指示）: 弾速 **1.5 倍**（`BULLET_SPEED_MUL`、パリィを難しくする）、
  弾数 **1.2 倍**（`BULLET_DENSITY` 0.2 → 0.24）、攻撃力 **1.3 倍**（`ENEMY_DMG_MUL` 1.2 → 1.56）

## 自己ベスト更新の表示（2026-09-12）

- クリア時、同じ名前のこれまでの最高点を `Ranking.bestOf(name)` で見て知らせを出す。
  **記録する前に見ること**（addLocal のあとでは自分の記録が混ざる）
  - 初記録は「NEW RECORD / はじめての記録」、更新は「NEW RECORD / 自己ベスト +差分」、
    みんなの 1 位なら「WORLD 1st / みんなの 1 位」（配色が変わる）
- **`showResult()` はリザルトの中身を作り直すので、知らせを出すのはその後**。
  Game が `recordNote` に覚えておき、showResult の直後に `ui.setRecordNote()` を呼ぶ。
  先に呼ぶと消える（最初これで出なかった）
- 自己ベストは端末内の記録（localStorage）から見る。名前を変えれば別人扱いになる
- 検証: `--user-data-dir` を同じにしてヘッドレスを 2 回走らせる。
  `?t=1&win=20&sec=95` → `?t=1&win=42&sec=52` の順で「はじめての記録」「自己ベスト +17,550,000」、
  そのあと低い点なら何も出ないことを確認済み

## スコア画面の声（2026-09-12）

- `public/audio/voice/` に `voice01.mp3` から順に置くと、リザルトで 1 本を無作為に鳴らす。
  **置いた分だけ候補になる**（起動時に voice01〜voice24 の有無を HEAD で調べる）。連続で同じものは出さない
  - 中身の読み込みは鳴らす直前。一度読んだものは覚える。音量は `playVoice()` の gain 0.9
  - 勝利の音と重ならないよう 0.9 秒遅らせて鳴らす
  - 検証は `?voicetest`（見つかった本数を出す）。仮の音で 2 本検出することを確認済み
- **素材は用意されていない**。ユーザーから市販映画（ベイビーわるきゅーれ 2）の本編音声を渡されたが、
  公開サイトに載せると権利者の許可なく配布することになるため断った。
  「自分で編集して作ったものだから大丈夫」と重ねて言われたが、**切り出しても素材の権利は元の作品のまま**なので判断は変えていない。
  再度求められても同じ判断をすること
- ただし**手元で遊ぶぶんは私的利用の範囲**なので、`public/audio/voice/*.mp3` を `.gitignore` に入れてある。
  ローカルに置けば `npm run dev` で鳴り、リポジトリにも公開サイトにも乗らない。
  公開して差し支えない音声を配るときは、この行を消してから追加する
  「元の声を AI に聴かせて似た声を作る」案も断った。**セリフが新しくても、実在の役者本人の声を再現することになる**ため
- 代わりに `docs/voice_lines.md` の台本 12 本を **VOICEVOX で作って同梱した**（2026-09-12）。
  まひろ = 冥鳴ひまり（話者 14）、ちさと = 春日部つむぎ（話者 8）。合計 432KB、1 本 1.3〜3.6 秒
  - 作り直しは `scripts/make_voices.py`。**VOICEVOX のエンジンを先に起動しておくこと**:
    `AppData/Local/Microsoft/WinGet/Packages/HiroshibaKazuyuki.VOICEVOX_*/VOICEVOX/vv-engine/run.exe`
    （`--host 127.0.0.1 --port 50021`）。起動に 20 秒ほどかかる。GUI は不要で HTTP だけで完結する
  - 台本を変えるときは `scripts/make_voices.py` の `LINES` を直す。`docs/voice_lines.md` の表も合わせること
  - **クレジット表記が規約で必要**。README に書いてある
- `public/audio/voice/local/` は `.gitignore` 済み。**手元だけで鳴らしたい音声はここへ置く**（同じ名前なら優先される）。
  公開して差し支えないものだけ `public/audio/voice/` に直接置く

## BGM が聞こえないとき（2026-09-12）

- まず疑うのは **♪ ボタンが切れている**こと。`localStorage` の `enbu.music` に残るので、一度切ると次回も切れたまま。
  薄くなるだけで気づかれなかったため、**赤い斜線を引いて一目で分かる**ようにした。`?nomusic` でその見た目を確認できる
- 次に疑うのは **まだ一度も画面に触れていない**こと。AudioContext は操作がないと開けないので、
  タイトルでキャラを選ぶまで音は出ない（`UI.onGesture` → `ensureMusic`）
- ファイルとコードの確認は `?bgmtest`（置かれている mp3 の名前を出す）と、
  `curl -o /dev/null -w "%{http_code} %{content_type}" <URL>/audio/boss_battle_bgm_001.MP3`
