#!/usr/bin/env python3
"""
Cuts every art asset in `public/art/` out of the concept still.

    python3 scripts/extract-art.py

Sources live in `art-source/`, deliberately *not* under `public/`:
everything in `public/` is copied verbatim into the build and served, and
the two sources together are ~4.7MB that no visitor should ever
download.

    GoldChain.jpg   the concept still, 1376x768
    GoldChain.mp4   a 5.9s animated version of the same frame. Kept for
                    reference; nothing is cut from it any more. See the
                    note at the bottom of this file.

This script is the single source of truth for the crop boxes. It exists
because those boxes were picked by eye against the artwork, and the
hotspot percentages in `src/ui/Viewport.jsx` are expressed relative to
the backdrop crop — so anyone re-cropping the backdrop has to know
exactly what the old box was and recompute the hotspots to match.

Requires Pillow. `optipng` and `jpegoptim` are used when present and
skipped when not: they are a size optimisation, not a correctness one, so
the script must not fail without them.
"""
import os
import shutil
import subprocess
import sys
from PIL import Image

SOURCE = "art-source"
STILL = f"{SOURCE}/GoldChain.jpg"
OUT = "public/art"

# Boxes are (left, top, right, bottom) on the 1376x768 concept still.

# The cross-section: the largest rectangle of pure artwork in the concept.
#
# Bounded by the concept's own UI, measured off the rendered plate rather
# than off the panels' apparent edges — their glows and rounded corners
# reach further than they look. The brand plate bleeds to x=316 and the
# "Day 451" plate to x=1050; the stage cards start at y=515. It runs to
# y=0 because an earlier box started at y=54 and beheaded the Deity at the
# sunglasses, and the whole point of the picture is the idol.
#
# HOTSPOTS below are anchored in concept pixels and converted against this
# box by `write_regions()`, so changing the crop can no longer silently
# slide them off their rooms.
BACKDROP = (320, 0, 1046, 515)

# Where each part of the society sits in the painting, in concept pixels,
# with which edge the label should hang off when it is near one.
HOTSPOTS = {
    "union": (372, 175, "left"),
    "politicians": (879, 190, "center"),
    "hospital": (844, 310, "center"),
    "police": (1010, 400, "right"),
    "mines": (414, 320, "center"),
    "smelter": (369, 430, "left"),
}

# Written next to the UI that consumes it.
REGIONS_OUT = "src/ui/artRegions.js"

DEITY = (579, 0, 805, 196)

# One plate per societal system, taken from the region of the
# cross-section that system governs.
SYSTEMS = {
    "union": (240, 128, 420, 218),
    "politicians": (822, 130, 935, 222),
    "hospital": (770, 240, 925, 335),
    "police": (955, 335, 1090, 450),
    "mafia": (1145, 300, 1340, 455),
}

# The concept's own bottom strip already contains five finished stage
# illustrations; these are those, cut out.
STAGES = {
    "mines": (232, 585, 394, 672),
    "smelters": (410, 585, 569, 672),
    "transport": (582, 585, 742, 672),
    "mints": (755, 585, 914, 672),
    "delivery": (929, 585, 1111, 672),
}

# Icons, upscaled and keyed to alpha off their near-black panels.
ICONS = {
    "union": (14, 225, 38, 248),
    "politicians": (13, 338, 39, 366),
    "medical": (14, 446, 39, 471),
    "police": (15, 523, 39, 547),
    "mafiosi": (14, 601, 40, 627),
    "crown": (19, 21, 48, 48),
    "chest": (1178, 578, 1202, 608),
    "overview": (14, 718, 44, 752),
    "build": (159, 724, 183, 750),
    "workers": (271, 724, 295, 750),
    "research": (401, 724, 424, 750),
    "decrees": (542, 724, 564, 750),
    "stats": (665, 724, 686, 750),
    "achievements": (772, 720, 802, 752),
    "banana": (979, 722, 1007, 752),
    "coin": (1149, 722, 1175, 752),
    "flame": (414, 522, 442, 554),
    "cart": (584, 522, 614, 554),
    "coinstage": (757, 522, 787, 554),
}

# Formats this script used to emit, swept on every run so a stale asset
# from an earlier version cannot sit in public/ and get bundled forever.
RETIRED_FORMATS = ("gif", "webp", "webm")


def key_alpha(img, lo=34, hi=78):
    """Turns the near-black panel background an icon was cut from into
    transparency, with a soft ramp so glowing edges don't get a halo."""
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, _ = px[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum <= lo:
                a = 0
            elif lum >= hi:
                a = 255
            else:
                a = int(255 * (lum - lo) / (hi - lo))
            px[x, y] = (r, g, b, a)
    return img


def have(tool):
    return shutil.which(tool) is not None


def optimise(paths):
    """Lossless recompression pass.

    Pillow writes a conservative encoder; optipng finds better PNG
    filter/deflate combinations and jpegoptim rebuilds the Huffman tables.
    Neither changes a pixel — `--all-progressive` is the only structural
    change, and it only affects decode order.
    """
    pngs = [p for p in paths if p.endswith(".png")]
    jpgs = [p for p in paths if p.endswith(".jpg")]
    before = sum(os.path.getsize(p) for p in paths)

    if pngs and have("optipng"):
        subprocess.run(
            ["optipng", "-quiet", "-o5", "-strip", "all", *pngs],
            check=True, capture_output=True,
        )
    if jpgs and have("jpegoptim"):
        subprocess.run(
            ["jpegoptim", "--quiet", "--strip-all", "--all-progressive", *jpgs],
            check=True, capture_output=True,
        )

    after = sum(os.path.getsize(p) for p in paths)
    return before / 1024, after / 1024, [
        t for t in ("optipng", "jpegoptim") if not have(t)
    ]


def write_regions():
    """Emits the backdrop's aspect ratio and the hotspot anchors as
    percentages of the plate.

    Generated rather than hand-maintained because the two have to agree:
    the hotspots are positioned as percentages of the backdrop crop, so a
    change to the crop that isn't mirrored in the percentages puts the
    strike badge somewhere other than the picket line, silently.
    """
    left, top, right, bottom = BACKDROP
    width, height = right - left, bottom - top

    lines = [
        "// Generated by scripts/extract-art.py — do not edit by hand.",
        "//",
        "// The backdrop crop and everything positioned against it. Hotspot",
        "// coordinates are percentages of the plate, derived from anchors",
        "// given in concept pixels, so the two cannot drift apart.",
        "",
        f"export const PLATE_ASPECT = {width} / {height};",
        "",
        "export const REGIONS = {",
    ]
    for name, (x, y, align) in HOTSPOTS.items():
        px = 100 * (x - left) / width
        py = 100 * (y - top) / height
        lines.append(
            f'  {name}: {{ left: "{px:.1f}%", top: "{py:.1f}%", '
            f'align: "{align}" }},'
        )
    lines += ["};", ""]

    with open(REGIONS_OUT, "w") as fh:
        fh.write("\n".join(lines))
    return REGIONS_OUT


def sweep_retired():
    """Removes anything animated left over from an earlier run."""
    removed = 0
    for root, _, files in os.walk(OUT):
        for f in files:
            if f.rsplit(".", 1)[-1] in RETIRED_FORMATS:
                os.remove(os.path.join(root, f))
                removed += 1
    return removed


def extract():
    src = Image.open(STILL).convert("RGB")
    written = []

    for box, path in ((BACKDROP, f"{OUT}/diorama.jpg"), (DEITY, f"{OUT}/deity.jpg")):
        src.crop(box).save(path, quality=92)
        written.append(path)

    for group, boxes in (("sys", SYSTEMS), ("stage", STAGES)):
        os.makedirs(f"{OUT}/{group}", exist_ok=True)
        for name, box in boxes.items():
            path = f"{OUT}/{group}/{name}.jpg"
            src.crop(box).save(path, quality=90)
            written.append(path)

    os.makedirs(f"{OUT}/icons", exist_ok=True)
    for name, box in ICONS.items():
        path = f"{OUT}/icons/{name}.png"
        key_alpha(src.crop(box).resize((96, 96), Image.LANCZOS)).save(path)
        written.append(path)

    return written


def main():
    if not os.path.exists(STILL):
        sys.exit(f"missing source: {STILL}")

    os.makedirs(OUT, exist_ok=True)
    swept = sweep_retired()
    written = extract()
    regions = write_regions()
    before, after, missing = optimise(written)
    saved = 100 * (1 - after / before) if before else 0

    print(
        f"{len(written)} files, {before:.0f}K -> {after:.0f}K "
        f"({saved:.0f}% smaller)"
    )
    print(f"wrote {regions}")
    if swept:
        print(f"swept {swept} stale animated asset(s)")
    if missing:
        print(f"not installed, skipped: {', '.join(missing)}")

    print(
        "\nEverything is a still. Three rounds of animation were cut from\n"
        "the clip and all three were removed after looking at the result:\n"
        "\n"
        "  system plates and stage thumbnails — in a 250x110 card at 17%\n"
        "  opacity behind text, or a 34px-tall thumbnail, the motion is\n"
        "  fast, tiny and illegible. It read as flicker. ~840K of payload\n"
        "  for a worse result than the stills.\n"
        "\n"
        "  the full backdrop — the generative pass garbled every sign in\n"
        "  the set (MONKEY WORKERS UNION, POLICE) and dropped the Deity's\n"
        "  salary placard along with the UI, so the still is the more\n"
        "  readable backdrop even though it doesn't move.\n"
        "\n"
        "  the conveyor, as video overlaid on the still — registering the\n"
        "  clip against the still over the belt region gives a scale of\n"
        "  1.000 and a 2px offset, so the two are not misaligned: the clip\n"
        "  simply redrew the belt, its coins and its rails in different\n"
        "  places. MAD 22.8 after optimal registration against 31\n"
        "  unregistered. No transform reconciles two different drawings,\n"
        "  and the mismatch shows as a doubled rail.\n"
        "\n"
        "Nothing animates now. Emphasis on the stills is CSS: framing,\n"
        "gradients, glows and state colour — see theme.css."
    )


if __name__ == "__main__":
    main()
