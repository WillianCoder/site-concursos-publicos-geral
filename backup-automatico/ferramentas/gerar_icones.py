"""Gera os ícones do Backup Automático (programa e bandeja).

Uso: python3 gerar_icones.py <pasta-de-saida>
Desenha tudo em alta resolução e reduz com filtro Lanczos para cada tamanho.
"""
import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SS = 8  # superamostragem


def gradiente(tam, cores):
    """Gradiente diagonal (canto superior esquerdo -> inferior direito)."""
    img = Image.new("RGBA", (tam, tam))
    px = img.load()
    n = len(cores) - 1
    for y in range(tam):
        for x in range(tam):
            t = (x + y) / (2 * (tam - 1))
            i = min(int(t * n), n - 1)
            f = t * n - i
            a, b = cores[i], cores[i + 1]
            px[x, y] = tuple(int(a[k] + (b[k] - a[k]) * f) for k in range(3)) + (255,)
    return img


def squircle(tam, raio):
    m = Image.new("L", (tam, tam), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, tam - 1, tam - 1), radius=raio, fill=255)
    return m


def nuvem(tam, escala=1.0, dy=0.0):
    """Máscara de uma nuvem centralizada."""
    m = Image.new("L", (tam, tam), 0)
    d = ImageDraw.Draw(m)
    s = tam * escala
    cx, cy = tam / 2, tam / 2 + dy * tam
    def circ(x, y, r):
        d.ellipse((cx + x * s - r * s, cy + y * s - r * s, cx + x * s + r * s, cy + y * s + r * s), fill=255)
    circ(-0.17, 0.04, 0.17)
    circ(0.05, -0.06, 0.23)
    circ(0.21, 0.07, 0.15)
    d.rounded_rectangle((cx - 0.34 * s, cy + 0.02 * s, cx + 0.36 * s, cy + 0.22 * s), radius=0.10 * s, fill=255)
    return m


def seta(tam, escala=1.0, dy=0.0, desloc=0.0):
    """Máscara de uma seta para cima (dentro da nuvem)."""
    m = Image.new("L", (tam, tam), 0)
    d = ImageDraw.Draw(m)
    s = tam * escala
    cx, cy = tam / 2 + 0.01 * s, tam / 2 + dy * tam - desloc * s
    ponta = cy - 0.12 * s
    asa = 0.115 * s
    base_asa = cy - 0.005 * s
    haste = 0.042 * s
    pe = cy + 0.155 * s
    d.polygon([
        (cx, ponta), (cx + asa, base_asa), (cx + haste, base_asa), (cx + haste, pe),
        (cx - haste, pe), (cx - haste, base_asa), (cx - asa, base_asa)], fill=255)
    return m


AZUL = [(56, 189, 248), (37, 99, 235), (79, 70, 229)]


def desenhar_base(tam, desloc_seta=0.0, anel=None):
    t = tam * SS
    fundo = gradiente(t, AZUL)
    img = Image.new("RGBA", (t, t), (0, 0, 0, 0))
    img.paste(fundo, (0, 0), squircle(t, int(t * 0.24)))
    # brilho suave no topo
    brilho = Image.new("L", (t, t), 0)
    ImageDraw.Draw(brilho).ellipse((-t * 0.3, -t * 0.75, t * 1.3, t * 0.45), fill=40)
    brilho = brilho.filter(ImageFilter.GaussianBlur(t * 0.06))
    brilho = ImageChops.multiply(brilho, squircle(t, int(t * 0.24)))
    img = Image.composite(Image.new("RGBA", (t, t), (255, 255, 255, 255)), img, brilho)
    img.putalpha(squircle(t, int(t * 0.24)))
    # sombra da nuvem
    mn = nuvem(t, 1.0, 0.03)
    sombra = mn.filter(ImageFilter.GaussianBlur(t * 0.035))
    sombra = sombra.point(lambda v: int(v * 0.35))
    escuro = Image.new("RGBA", (t, t), (15, 23, 80, 255))
    tmp = img.copy()
    tmp.paste(escuro, (0, int(t * 0.025)), sombra)
    tmp.putalpha(img.getchannel("A"))
    img = tmp
    # nuvem branca
    branca = Image.new("RGBA", (t, t), (255, 255, 255, 255))
    img.paste(branca, (0, 0), mn)
    # seta azul recortada na nuvem
    ms = seta(t, 1.0, 0.03, desloc_seta)
    ms = ImageChops.multiply(ms, mn)
    seta_cor = gradiente(t, [(37, 99, 235), (67, 56, 202)])
    img.paste(seta_cor, (0, 0), ms)
    if anel is not None:
        # arco girando na borda (animação "copiando")
        d = ImageDraw.Draw(img)
        w = max(SS * 2, int(t * 0.075))
        m = w // 2 + int(t * 0.02)
        d.arc((m, m, t - m, t - m), start=anel, end=anel + 110, fill=(255, 255, 255, 255), width=w)
    return img


def selo(img, cor, simbolo):
    t = img.size[0]
    r = t * 0.25
    cx, cy = t - r * 1.0, t - r * 1.0
    d = ImageDraw.Draw(img)
    borda = t * 0.045
    d.ellipse((cx - r - borda, cy - r - borda, cx + r + borda, cy + r + borda), fill=(255, 255, 255, 255))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=cor + (255,))
    if simbolo == "!":
        d.rounded_rectangle((cx - r * 0.16, cy - r * 0.62, cx + r * 0.16, cy + r * 0.18), radius=r * 0.12, fill="white")
        d.ellipse((cx - r * 0.17, cy + r * 0.34, cx + r * 0.17, cy + r * 0.68), fill="white")
    elif simbolo == "||":
        d.rounded_rectangle((cx - r * 0.42, cy - r * 0.5, cx - r * 0.12, cy + r * 0.5), radius=r * 0.08, fill="white")
        d.rounded_rectangle((cx + r * 0.12, cy - r * 0.5, cx + r * 0.42, cy + r * 0.5), radius=r * 0.08, fill="white")
    return img


def reduzir(img, tam):
    return img.resize((tam, tam), Image.LANCZOS)


def salvar_ico(caminho, imagens):
    imagens = sorted(imagens, key=lambda i: i.size[0], reverse=True)
    imagens[0].save(caminho, format="ICO", sizes=[i.size for i in imagens], append_images=imagens[1:])


def main(saida):
    os.makedirs(saida, exist_ok=True)
    tamanhos_app = [256, 128, 96, 64, 48, 40, 32, 24, 20, 16]
    tamanhos_bandeja = [64, 48, 40, 32, 24, 20, 16]

    def gerar(tamanhos, **kw):
        out = []
        for tam in tamanhos:
            base = desenhar_base(tam, **{k: v for k, v in kw.items() if k in ("desloc_seta", "anel")})
            if kw.get("selo"):
                base = selo(base, *kw["selo"])
            out.append(reduzir(base, tam))
        return out

    salvar_ico(os.path.join(saida, "app.ico"), gerar(tamanhos_app))
    reduzir(desenhar_base(256), 256).save(os.path.join(saida, "logo.png"))
    salvar_ico(os.path.join(saida, "bandeja.ico"), gerar(tamanhos_bandeja))
    salvar_ico(os.path.join(saida, "bandeja-erro.ico"), gerar(tamanhos_bandeja, selo=((220, 38, 38), "!")))
    salvar_ico(os.path.join(saida, "bandeja-aviso.ico"), gerar(tamanhos_bandeja, selo=((217, 119, 6), "!")))
    salvar_ico(os.path.join(saida, "bandeja-pausa.ico"), gerar(tamanhos_bandeja, selo=((100, 116, 139), "||")))
    quadros = 8
    for i in range(quadros):
        desloc = 0.035 * math.sin(2 * math.pi * i / quadros)
        salvar_ico(os.path.join(saida, f"bandeja-copiando-{i}.ico"),
                   gerar(tamanhos_bandeja, desloc_seta=desloc, anel=(i * 360 / quadros) - 90))
    print("ícones gerados em", saida)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "icones")
