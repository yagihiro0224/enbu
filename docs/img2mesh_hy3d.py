"""Hunyuan3D 2.1（ComfyUI 標準ノード）で画像 1 枚から GLB（形状のみ）を作る。

  venv/Scripts/python.exe tools/img2mesh_hy3d.py --image assassin_front_rgba.png [--seed N] [--steps 30] [--res 384] [--prefix mesh/assassin]

--image は ComfyUI/input からの相対名。出力は ComfyUI/output/<prefix>_*.glb
"""
import argparse
import json
import sys
import time
import urllib.request

API = "http://127.0.0.1:8188"


def build(image: str, seed: int, steps: int, cfg: float, octree: int, prefix: str, chunks: int = 8000, threshold: float = 0.6):
    return {
        "1": {"class_type": "ImageOnlyCheckpointLoader", "inputs": {"ckpt_name": "hunyuan_3d_v2.1.safetensors"}},
        "2": {"class_type": "LoadImage", "inputs": {"image": image}},
        "13": {"class_type": "CLIPVisionEncode", "inputs": {"clip_vision": ["1", 1], "image": ["2", 0], "crop": "center"}},
        "6": {"class_type": "Hunyuan3Dv2Conditioning", "inputs": {"clip_vision_output": ["13", 0]}},
        "4": {"class_type": "EmptyLatentHunyuan3Dv2", "inputs": {"resolution": 4096, "batch_size": 1}},
        "3": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 1.0}},
        "7": {"class_type": "KSampler", "inputs": {
            "model": ["3", 0], "positive": ["6", 0], "negative": ["6", 1], "latent_image": ["4", 0],
            "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0}},
        "8": {"class_type": "VAEDecodeHunyuan3D", "inputs": {"samples": ["7", 0], "vae": ["1", 2], "num_chunks": chunks, "octree_resolution": octree}},
        "9": {"class_type": "VoxelToMesh", "inputs": {"voxel": ["8", 0], "algorithm": "surface net", "threshold": threshold}},
        "10": {"class_type": "SaveGLB", "inputs": {"mesh": ["9", 0], "filename_prefix": prefix}},
    }


def post(graph):
    req = urllib.request.Request(f"{API}/prompt", data=json.dumps({"prompt": graph}).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        res = json.load(r)
    if "prompt_id" not in res:
        raise RuntimeError(json.dumps(res, ensure_ascii=False)[:1000])
    return res["prompt_id"]


def wait(pid: str, timeout: float = 1800):
    t0 = time.time()
    while time.time() - t0 < timeout:
        with urllib.request.urlopen(f"{API}/history/{pid}") as r:
            h = json.load(r)
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st, ensure_ascii=False)[:1500])
            files = []
            for node in h[pid].get("outputs", {}).values():
                for key, items in node.items():
                    if isinstance(items, list):
                        for it in items:
                            if isinstance(it, dict) and "filename" in it:
                                files.append(f"{it.get('subfolder', '')}/{it['filename']}")
            return files
        time.sleep(3)
    raise TimeoutError(pid)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--seed", type=int, default=20260910)
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--cfg", type=float, default=5.0)
    ap.add_argument("--res", type=int, default=256, help="octree 解像度。256 が既定、384 で細部が増えるが遅い")
    ap.add_argument("--prefix", default="mesh/assassin")
    ap.add_argument("--threshold", type=float, default=0.6, help="VoxelToMesh の閾値。下げると薄い部分（髪）が太る")
    a = ap.parse_args()
    t0 = time.time()
    pid = post(build(a.image, a.seed, a.steps, a.cfg, a.res, a.prefix, threshold=a.threshold))
    print("queued", pid, flush=True)
    files = wait(pid)
    print(f"done in {time.time() - t0:.0f}s -> {files}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
