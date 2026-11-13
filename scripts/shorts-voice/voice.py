# Michael (Kokoro am_michael) reads each line of a Short's spec → <dir>/voice/<id>.wav,
# plus voice/timing.json: each clip's length and where the speech starts and ends.
#   ~/Projects/files/tts/.venv/bin/python voice.py path/to/spec.json
import json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

TTS = os.path.expanduser("~/Projects/files/tts")
spec_path = os.path.abspath(sys.argv[1])
out_dir = os.path.join(os.path.dirname(spec_path), "voice")
spec = json.load(open(spec_path))
k = Kokoro(f"{TTS}/kokoro-v1.0.onnx", f"{TTS}/voices-v1.0.bin")
os.makedirs(out_dir, exist_ok=True)
out = {}
for line in spec["lines"]:
    samples, rate = k.create(line["say"], voice=spec.get("voice", "am_michael"), speed=spec.get("speed", 1.06), lang="en-us")
    samples = np.asarray(samples, dtype=np.float32)
    loud = np.where(np.abs(samples) > 0.02)[0]
    start, end = (loud[0] / rate, loud[-1] / rate) if len(loud) else (0, len(samples) / rate)
    sf.write(f"{out_dir}/{line['id']}.wav", samples, rate)
    out[line["id"]] = {"say": line["say"], "dur": len(samples) / rate, "speechStart": round(float(start), 3), "speechEnd": round(float(end), 3)}
    print(line["id"], round(len(samples) / rate, 2))
json.dump(out, open(f"{out_dir}/timing.json", "w"), indent=1)
