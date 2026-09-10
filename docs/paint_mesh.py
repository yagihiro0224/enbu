"""形状だけの GLB に、設定画（正面）を投影してテクスチャを付ける。

  venv/Scripts/python.exe tools/paint_mesh.py --mesh output/mesh/assassin_00001_.glb --front input/assassin_front_rgba.png \
      --out output/mesh/assassin_painted.glb [--flip] [--decimate 60000] [--vertex-colors]

方式:
  - --flip: Hunyuan3D の出力は正面が -Z のことがあるので、X と Z を反転して +Z 正面にする（回転なので面の向きは変えない）
  - 足元を原点、身長 1 に正規化
  - 各頂点を正面画像へ正射影（XY → UV）する
  - 法線が +Z 側の頂点は正面画像、-Z 側は左右反転して暗くした画像を使う（横並びのアトラス 1 枚）
出力は UV とテクスチャ付き GLB。--vertex-colors を付けると頂点色（粗い）になる。
"""
import argparse
import sys

import numpy as np
import trimesh
from PIL import Image, ImageEnhance, ImageOps


def subject_bbox(rgba: np.ndarray):
    a = rgba[..., 3] > 0.5
    ys, xs = np.where(a)
    return xs.min(), xs.max(), ys.min(), ys.max()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mesh", required=True)
    ap.add_argument("--front", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--flip", action="store_true")
    ap.add_argument("--decimate", type=int, default=0)
    ap.add_argument("--vertex-colors", action="store_true")
    ap.add_argument("--back-darken", type=float, default=0.8)
    ap.add_argument("--head-frac", type=float, default=0.155, help="被写体の高さに対する頭（髪＋顔）の割合。後頭部の塗りつぶし範囲")
    a = ap.parse_args()

    mesh: trimesh.Trimesh = trimesh.load(a.mesh, force="mesh")
    print("faces", len(mesh.faces), "verts", len(mesh.vertices), "bounds", mesh.bounds.round(3).tolist(), "watertight", mesh.is_watertight)
    if a.decimate and len(mesh.faces) > a.decimate:
        mesh = mesh.simplify_quadric_decimation(face_count=a.decimate)
        print("decimated ->", len(mesh.faces))

    v = mesh.vertices.copy()
    if a.flip:
        v[:, 0] *= -1
        v[:, 2] *= -1
    mn = v.min(axis=0)
    mx = v.max(axis=0)
    v = v - np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])
    v /= (mx[1] - mn[1])
    mesh = trimesh.Trimesh(vertices=v, faces=mesh.faces, process=False)
    mesh.fix_normals()
    n = mesh.vertex_normals
    mn = v.min(axis=0)
    mx = v.max(axis=0)

    front_img = Image.open(a.front).convert("RGBA")
    front = np.asarray(front_img).astype(np.float32) / 255.0
    fx0, fx1, fy0, fy1 = subject_bbox(front)
    W, H = front_img.size

    # 正射影 UV（画像座標、0..1、v は上が 0）
    u_f = (v[:, 0] - mn[0]) / (mx[0] - mn[0])
    v_f = 1.0 - (v[:, 1] - mn[1]) / (mx[1] - mn[1])
    uf = (fx0 + u_f * (fx1 - fx0)) / (W - 1)
    vf = (fy0 + v_f * (fy1 - fy0)) / (H - 1)
    facing_back = n[:, 2] < 0

    if a.vertex_colors:
        x = np.clip((uf * (W - 1)).round().astype(int), 0, W - 1)
        y = np.clip((vf * (H - 1)).round().astype(int), 0, H - 1)
        xb = np.clip(((1 - uf) * (W - 1)).round().astype(int), 0, W - 1)
        col = np.where(facing_back[:, None], front[y, xb, :3] * a.back_darken, front[y, x, :3])
        rgba = np.concatenate([np.clip(col, 0, 1), np.ones((len(col), 1))], axis=1)
        mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=(rgba * 255).astype(np.uint8))
    else:
        # アトラス: 左半分 = 正面、右半分 = 左右反転して暗くした正面（背面用）
        back_img = ImageOps.mirror(front_img)
        rgb = ImageEnhance.Brightness(back_img.convert("RGB")).enhance(a.back_darken)
        back_img = Image.merge("RGBA", (*rgb.split(), back_img.split()[3]))
        # 後頭部: 顔が背面に写らないよう、頭の高さ範囲を髪の代表色で塗りつぶす（シルエットは保つ）
        head_rows = int((fy1 - fy0) * a.head_frac)
        top = front[fy0:fy0 + max(4, head_rows // 4), fx0:fx1]
        opaque = top[..., 3] > 0.5
        if opaque.sum() > 0:
            hair = (np.median(top[opaque][:, :3], axis=0) * 255 * a.back_darken).astype(np.uint8)
            arr = np.asarray(back_img).copy()
            y0, y1 = fy0, fy0 + head_rows
            alpha = arr[y0:y1, :, 3:4]
            arr[y0:y1, :, :3] = np.where(alpha > 128, hair, arr[y0:y1, :, :3])
            back_img = Image.fromarray(arr, "RGBA")
        atlas = Image.new("RGBA", (W * 2, H), (0, 0, 0, 0))
        atlas.paste(front_img, (0, 0))
        atlas.paste(back_img, (W, 0))
        # 透明部分を近傍色で埋めておく（UV が縁に掛かった時の黒ずみ防止）
        bg = Image.new("RGBA", atlas.size, (200, 200, 200, 255))
        atlas = Image.alpha_composite(bg, atlas).convert("RGB")
        # 背面は反転画像なので U も反転する
        u_atlas = np.where(facing_back, 0.5 + 0.5 * (1.0 - uf), 0.5 * uf)
        # glTF/trimesh の UV は v の原点が下
        uv = np.stack([u_atlas, 1.0 - vf], axis=1)
        mesh.visual = trimesh.visual.texture.TextureVisuals(uv=uv, image=atlas)
    mesh.export(a.out)
    print("wrote", a.out, "faces", len(mesh.faces), "mode", "vertex" if a.vertex_colors else "texture")


if __name__ == "__main__":
    sys.exit(main())
