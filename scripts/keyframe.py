# Guarda un keyframe: original en fuentes/keyframes/originales y recorte central 16:9 en fuentes/keyframes.
# Uso: .venv-rembg/Scripts/python.exe -I 02-renta-cuatrimotos/scripts/keyframe.py <imagen> <nombre>
import shutil, sys
from pathlib import Path
from PIL import Image

src, name = Path(sys.argv[1]), sys.argv[2]
out = Path(__file__).resolve().parent.parent / "fuentes" / "keyframes"
(out / "originales").mkdir(parents=True, exist_ok=True)
shutil.copy(src, out / "originales" / f"{name}.png")
im = Image.open(src)
w, h = im.size
nh = round(w * 9 / 16)
if nh < h:
    top = (h - nh) // 2
    im = im.crop((0, top, w, top + nh))
im.save(out / f"{name}.png")
print(name, im.size)
