"""
VRM に埋まっているサムネイル画像を、1x1 の透明 PNG に置き換えて軽くする。

サムネイルは VRM を一覧表示するソフトが使うもので、ゲーム中は一度も表示されない。
画像の要素ごと削除すると images / textures の番号がずれて他の参照が壊れるため、
番号はそのままにして中身だけを最小の画像に差し替える。

使い方:
    python scripts/strip_vrm_thumbnail.py public/models/*.vrm
"""

import json
import struct
import sys
import os

# 1x1 の透明 PNG
TINY_PNG = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0B, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
])


def read_glb(path):
    with open(path, 'rb') as f:
        data = f.read()
    magic, version, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, 'glb ではない'
    off = 12
    js = None
    bin_ = b''
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode('utf-8'))
        elif ctype == 0x004E4942:
            bin_ = chunk
        off += 8 + clen + ((4 - clen % 4) % 4)
    return js, bin_


def write_glb(path, js, bin_):
    jb = json.dumps(js, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    bb = bin_ + b'\x00' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(jb) + (8 + len(bb) if bb else 0)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A))
        f.write(jb)
        if bb:
            f.write(struct.pack('<II', len(bb), 0x004E4942))
            f.write(bb)


def strip(path):
    js, bin_ = read_glb(path)
    before = os.path.getsize(path)

    meta = js.get('extensions', {}).get('VRMC_vrm', {}).get('meta', {})
    idx = meta.get('thumbnailImage')
    if idx is None:
        print(f'{os.path.basename(path)}: サムネイルなし')
        return
    img = js['images'][idx]
    bv_index = img.get('bufferView')
    if bv_index is None:
        print(f'{os.path.basename(path)}: サムネイルが外部参照なので触らない')
        return

    views = js['bufferViews']
    old_len = views[bv_index]['byteLength']

    # bufferView を順に詰め直す。中身はそのまま写し、サムネイルだけ差し替える
    out = bytearray()
    for i, v in enumerate(views):
        src = TINY_PNG if i == bv_index else bin_[v['byteOffset']: v['byteOffset'] + v['byteLength']]
        pad = (4 - len(out) % 4) % 4
        out.extend(b'\x00' * pad)
        v['byteOffset'] = len(out)
        v['byteLength'] = len(src)
        out.extend(src)

    js['buffers'][0]['byteLength'] = len(out)
    write_glb(path, js, bytes(out))
    after = os.path.getsize(path)
    print(f'{os.path.basename(path)}: サムネイル {old_len / 1048576:.2f}MB を削除 '
          f'→ {before / 1048576:.1f}MB から {after / 1048576:.1f}MB')


for p in sys.argv[1:]:
    strip(p)
