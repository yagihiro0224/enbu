"""
スコア画面の声を VOICEVOX で作る。

VOICEVOX のエンジン（vv-engine/run.exe）を起動しておき、このスクリプトを走らせると
docs/voice_lines.md の台本を読み上げた mp3 が public/audio/voice/ に並ぶ。

    python scripts/make_voices.py

VOICEVOX の規約でクレジット表記が要る。README に書いてある。
"""

import json
import os
import subprocess
import urllib.parse
import urllib.request

HOST = 'http://127.0.0.1:50021'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'voice')

# 話者。まひろは落ち着いた声、ちさとは軽い声
MAHIRO = 14   # 冥鳴ひまり ノーマル
CHISATO = 8   # 春日部つむぎ ノーマル

# (ファイル番号, 話者, セリフ, 話す速さ, 高さ)
LINES = [
    (1, CHISATO, '二人合わせて、まあ、こんなもんっすかね', 1.05, 0.0),
    (2, MAHIRO, '今の、絶対わたしの方が多く殴ってたよね', 1.0, 0.0),
    (3, CHISATO, '数えてたんすか。こわ', 1.1, 0.02),
    (4, MAHIRO, 'こういうのは、記録に残しておかないと意味ないの', 0.98, 0.0),
    (5, CHISATO, '先輩、さっき三回くらい被弾してましたけど', 1.08, 0.0),
    (6, MAHIRO, '見てないところは、なかったことになるんだよ', 0.95, -0.02),
    (7, CHISATO, '世の中の人間は、二種類に分かれるんすよ', 1.02, 0.0),
    (8, CHISATO, '点を稼ぐ人間と、言い訳を稼ぐ人間', 1.02, 0.0),
    (9, MAHIRO, 'どっちの話をしてるの、それ', 1.0, 0.0),
    (10, CHISATO, '今回もね、しっかり回収させてもらいますからね', 1.06, 0.02),
    (11, MAHIRO, 'バカにしてるでしょ', 1.0, -0.01),
    (12, CHISATO, 'まさか。尊敬っす', 1.05, 0.03),
]


def post(path, data=None, params=None):
    url = HOST + path
    if params:
        url += '?' + urllib.parse.urlencode(params)
    body = json.dumps(data).encode('utf-8') if data is not None else b''
    req = urllib.request.Request(url, data=body, method='POST',
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def synth(text, speaker, speed, pitch):
    q = json.loads(post('/audio_query', params={'text': text, 'speaker': speaker}))
    q['speedScale'] = speed
    q['pitchScale'] = pitch
    q['intonationScale'] = 1.15   # 抑揚を少し強めて棒読みを避ける
    q['prePhonemeLength'] = 0.05  # 前後の無音は詰める
    q['postPhonemeLength'] = 0.12
    return post('/synthesis', data=q, params={'speaker': speaker})


def main():
    os.makedirs(OUT, exist_ok=True)
    for num, speaker, text, speed, pitch in LINES:
        wav = os.path.join(OUT, f'_tmp{num:02d}.wav')
        mp3 = os.path.join(OUT, f'voice{num:02d}.mp3')
        with open(wav, 'wb') as f:
            f.write(synth(text, speaker, speed, pitch))
        subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-i', wav,
                        '-b:a', '96k', '-ac', '1', mp3], check=True)
        os.remove(wav)
        size = os.path.getsize(mp3)
        who = 'まひろ' if speaker == MAHIRO else 'ちさと'
        print(f'voice{num:02d}.mp3  {size / 1024:5.1f}KB  {who}  {text}')


if __name__ == '__main__':
    main()
