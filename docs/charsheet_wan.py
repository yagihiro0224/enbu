"""Wan 2.2 14B T2V を 1 フレームで回して、キャラ設定画（正面／側面／背面）を作る。

  venv/Scripts/python.exe tools/charsheet_wan.py [--seed N] [--views front,side,back] [--tag NAME]

lightx2v 4 ステップ LoRA 使用。CFG 1.0。832x1216。1 枚あたり数十秒。
出力: output/charsheet/<tag>_<view>_<seed>_*.png
"""
import argparse
import json
import sys
import time
import urllib.request

API = "http://127.0.0.1:8188"

CHARACTER = (
    "A young Japanese woman, about 20 years old, anime illustration style with clean lineart and simple cel shading. "
    "Short blonde bob haircut with straight bangs, open narrow eyes with a bored deadpan look, brown eyes, calm expressionless face, small closed mouth. "
    "She wears a color-block track jacket with navy blue, red and white panels, zipped halfway, "
    "an oversized light grey t-shirt with a small logo underneath, baggy grey cargo pants, and black lace-up boots. "
    "Empty hands, no weapon, no bag, no strap. "
)

VIEWS = {
    "front": "Full body, standing straight facing the camera, A-pose: both arms hang straight down slightly away from the body with open relaxed hands, not in pockets, feet together. ",
    "side": "Full body, standing straight in a perfect left side profile view, A-pose with arms slightly apart from the body. ",
    "back": "Rear view. The camera is directly behind her, so we see the back of her blonde bob haircut, the back of the jacket and the heels of the boots. Her face is not visible at all. Full body, standing straight, A-pose with arms slightly apart from the body. ",
}

COMMON = (
    "Character reference sheet for a video game, plain flat white background, no scenery, even flat lighting, no cast shadow, "
    "whole body visible from head to boots, centered, static pose, no motion."
)

NEGATIVE = (
    "background, scenery, city, room, multiple people, multiple views, extra limbs, extra fingers, deformed hands, "
    "gun, rifle, weapon, strap, bag, closed eyes, sleeping, dynamic pose, running, text, watermark, logo text, signature, blurry, low quality, "
    "photorealistic, 3d render, realistic photo, dark, shadow on floor, cropped, out of frame"
)


def build(prompt: str, negative: str, seed: int, prefix: str, w: int = 832, h: int = 1216, quality: bool = False):
    # quality=True: lightx2v LoRA なし、20 ステップ、CFG 3.5、shift 8（generation-log の本番設定）。線の毛羽立ちが減る
    steps = 20 if quality else 4
    mid = 10 if quality else 2
    cfg = 3.5 if quality else 1.0
    shift = 8.0 if quality else 5.0
    lora_high = 0.0 if quality else 1.0
    lora_low = 0.0 if quality else 1.0
    return {
        "37": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}},
        "56": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}},
        "38": {"class_type": "CLIPLoader", "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}},
        "39": {"class_type": "VAELoader", "inputs": {"vae_name": "wan_2.1_vae.safetensors"}},
        "60": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["37", 0], "lora_name": "wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors", "strength_model": lora_high}},
        "61": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["56", 0], "lora_name": "wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors", "strength_model": lora_low}},
        "54": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["60", 0], "shift": shift}},
        "55": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["61", 0], "shift": shift}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["38", 0], "text": prompt}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["38", 0], "text": negative}},
        "59": {"class_type": "EmptyHunyuanLatentVideo", "inputs": {"width": w, "height": h, "length": 1, "batch_size": 1}},
        "57": {"class_type": "KSamplerAdvanced", "inputs": {
            "model": ["54", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["59", 0],
            "add_noise": "enable", "noise_seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler", "scheduler": "simple",
            "start_at_step": 0, "end_at_step": mid, "return_with_leftover_noise": "enable"}},
        "58": {"class_type": "KSamplerAdvanced", "inputs": {
            "model": ["55", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["57", 0],
            "add_noise": "disable", "noise_seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler", "scheduler": "simple",
            "start_at_step": mid, "end_at_step": 10000, "return_with_leftover_noise": "disable"}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["58", 0], "vae": ["39", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": prefix}},
    }


def post(prompt_graph):
    data = json.dumps({"prompt": prompt_graph}).encode()
    req = urllib.request.Request(f"{API}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)["prompt_id"]


def wait(pid: str, timeout: float = 900):
    t0 = time.time()
    while time.time() - t0 < timeout:
        with urllib.request.urlopen(f"{API}/history/{pid}") as r:
            h = json.load(r)
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st, ensure_ascii=False)[:800])
            outs = []
            for node in h[pid].get("outputs", {}).values():
                for im in node.get("images", []):
                    outs.append(im["filename"])
            return outs
        time.sleep(3)
    raise TimeoutError(pid)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20260910)
    ap.add_argument("--views", default="front,side,back")
    ap.add_argument("--tag", default="assassin")
    ap.add_argument("--quality", action="store_true", help="LoRA なし 20 ステップ")
    args = ap.parse_args()
    for view in args.views.split(","):
        prompt = CHARACTER + VIEWS[view] + COMMON
        prefix = f"charsheet/{args.tag}_{view}_{args.seed}" + ("_q" if args.quality else "")
        t0 = time.time()
        pid = post(build(prompt, NEGATIVE, args.seed, prefix, quality=args.quality))
        print(f"[{view}] queued {pid}", flush=True)
        outs = wait(pid)
        print(f"[{view}] done in {time.time() - t0:.0f}s -> {outs}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
