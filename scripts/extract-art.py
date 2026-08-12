#!/usr/bin/env python3
"""
Cuts every art asset in `public/art/` out of the concept material.

    python3 scripts/extract-art.py

Sources live in `art-source/`, deliberately *not* under `public/`:
everything in `public/` is copied verbatim into `dist/` and served, and
the two sources together are ~4.7MB that no visitor should ever
download.

    GoldChain.jpg   the concept still, 1376x768
    GoldChain.mp4   a 5.9s animated version of the same frame, 24fps,
                    identical resolution, so the crop boxes below apply
                    to both

This script is the single source of truth for the crop boxes. It exists
because those boxes were picked by eye against the artwork, and the
hotspot percentages in `src/ui/Viewport.jsx` are expressed relative to
the backdrop crop — so anyone re-cropping the backdrop has to know
exactly what the old box was and recompute the hotspots to match.

Requires Pillow and ffmpeg. `optipng` and `jpegoptim` are used when
present and skipped when not — they are a size optimisation, not a
correctness one, so the script must not fail without them.
"""
import os
import shutil
import subprocess
import sys
from PIL import Image

SOURCE = "art-source"
STILL = f"{SOURCE}/GoldChain.jpg"
VIDEO = f"{SOURCE}/GoldChain.mp4"
OUT = "public/art"

# ---------------------------------------------------------------- stills
#
# Boxes are (left, top, right, bottom) on the 1376x768 concept still.

# The cross-section, cropped clear of the concept's own UI panels. The
# hotspot percentages in Viewport.jsx are relative to THIS box.
BACKDROP_STILL = (228, 54, 1071, 517)

DEITY_STILL = (579, 0, 805, 196)

# The same region as BACKDROP_STILL, in ffmpeg's x/y/w/h form.
BACKDROP_STILL_CROP = (
    BACKDROP_STILL[0],
    BACKDROP_STILL[1],
    BACKDROP_STILL[2] - BACKDROP_STILL[0],
    BACKDROP_STILL[3] - BACKDROP_STILL[1],
)

# One plate per societal system, taken from the region of the
# cross-section that system governs.
SYS_STILLS = {
    "union": (240, 128, 420, 218),
    "politicians": (822, 130, 935, 222),
    "hospital": (770, 240, 925, 335),
    "police": (955, 335, 1090, 450),
    "mafia": (1145, 300, 1340, 455),
}

# The concept's own bottom strip already contains five finished stage
# illustrations; these are those, cut out.
STAGE_STILLS = {
    "mines": (232, 585, 394, 672),
    "smelters": (410, 585, 569, 672),
    "transport": (582, 585, 742, 672),
    "mints": (755, 585, 914, 672),
    "delivery": (929, 585, 1111, 672),
}

# Icons, upscaled and keyed to alpha off their near-black panels.
ICON_STILLS = {
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

# --------------------------------------------------------------- motion
#
# The clip is a continuous dolly *into* the set, not a loop: the UI
# overlay fades out over the first ~15 frames, then the camera pushes in
# until it ends deep among the mafiosi. So there is no window that loops
# on its own, and every usable window is a different composition.
#
# Frames 16-43 are the one stretch that is a wide shot with the UI gone
# and almost no camera travel — ambient motion only. That is the window
# worth using as a backdrop; the later close-ups are prettier but the
# camera is moving too fast to sit behind a UI.
#
# Windows are (first frame, last frame) inclusive, 24fps, 1-indexed to
# match `ffmpeg -vsync 0` output.
# Every asset that moves, with the window of the clip it comes from.
#
# The point of doing this per component rather than as one animated
# backdrop: the close-ups are the good part of the clip. Each system and
# each stage gets the region of the set it actually governs, and because
# the plates sit at 17% opacity behind text (or, for stage thumbnails, at
# 34px tall with no text over them), the generative pass garbling the
# signage doesn't matter here the way it does on a full-size backdrop.
#
# Names match the stills exactly, so the UI mapping is unchanged and the
# stills stay usable as the reduced-motion fallback.
#
# Windows are (first, last) inclusive, 24fps, 1-indexed to match
# `ffmpeg -vsync 0` output. Crops are x, y, w, h.
def asset(window, crop, width, quality=64, ship=("webp",), fps=12,
          loop="pingpong"):
    """One animated asset.

    `loop`: "pingpong" plays the window forwards then backwards, which is
    how a window that doesn't loop on its own is made seamless. "forward"
    plays it once and repeats, for content where reversing would be
    obviously wrong — the conveyor belt, whose coins would visibly run
    backwards half the time.
    """
    return {
        "window": window, "crop": crop, "width": width,
        "quality": quality, "ship": ship, "fps": fps, "loop": loop,
    }


# Every asset that moves, with the window of the clip it comes from.
#
# The point of doing this per component rather than as one animated
# backdrop: the close-ups are the good part of the clip. Each system and
# each stage gets the region of the set it actually governs, and because
# the plates sit at 17% opacity behind text (or, for stage thumbnails, at
# 34px tall with no text over them), the generative pass garbling the
# signage doesn't matter here the way it does on a full-size backdrop.
#
# Names match the stills exactly, so the UI mapping is unchanged and the
# stills stay usable as the reduced-motion fallback.
#
# Windows are (first, last) inclusive, 24fps, 1-indexed to match
# `ffmpeg -vsync 0` output. Crops are x, y, w, h in source pixels.
MOTION = {
    # -- backdrop and portrait -------------------------------------------
    #
    # The backdrop uses the *same* crop box as the still so both
    # compositions are identical and the hotspot percentages stay valid
    # whichever is on screen. Its window is short because the camera is
    # already pushing in: over the full 16-43 stretch it travels far
    # enough to slide the hotspots off their rooms.
    "diorama": asset((16, 30), BACKDROP_STILL_CROP, 900, 70, ("webm",)),
    # The Deity has no signage to garble, so this close-up survives intact.
    "deity": asset((20, 43), (570, 0, 250, 190), 220, 72),

    # -- the conveyor ----------------------------------------------------
    #
    # The belt that carries the tribute up to the Deity: the flow made
    # visible. Forward-only, because ping-ponging a conveyor runs the
    # coins backwards half the time.
    #
    # The window is 9 frames because that is the belt's measured period —
    # one coin pitch of travel. Frame 16 matches frame 25 more closely
    # than any two adjacent frames match each other, which is what a real
    # period looks like. Shipped as video so the UI can drive
    # `playbackRate` from the actual coin rate and pause it when the
    # tribute stops.
    "belt": asset(
        (16, 24), (665, 244, 30, 273), 60, 70, ("webm",),
        fps=24, loop="forward",
    ),

    # -- system plates ---------------------------------------------------
    #
    # Quality is deliberately low: these render at 17% opacity as card
    # texture, where detail is invisible and bytes are not.
    "sys/union": asset((56, 66), (0, 10, 420, 200), 360, 58),
    "sys/politicians": asset((16, 30), (810, 100, 190, 140), 360, 58),
    "sys/hospital": asset((60, 72), (700, 30, 500, 320), 360, 58),
    "sys/police": asset((58, 70), (1080, 200, 296, 200), 360, 58),
    "sys/mafia": asset((120, 136), (300, 60, 700, 500), 360, 58),

    # -- stage thumbnails ------------------------------------------------
    #
    # Reused across the eight pipeline roles the same way the stills are:
    # five illustrations, eight stages.
    "stage/mines": asset((98, 110), (0, 150, 560, 340), 220, 68),
    "stage/smelters": asset((72, 84), (0, 230, 420, 300), 220, 68),
    "stage/transport": asset((64, 76), (540, 40, 400, 320), 220, 68),
    "stage/mints": asset((86, 98), (380, 100, 480, 340), 220, 68),
    "stage/delivery": asset((56, 66), (380, 0, 420, 200), 220, 68),
}

# Rendered in every format only for these, where the format choice is
# worth measuring. The rest go straight to WebP: at these sizes GIF would
# multiply the payload several times over for no visible gain.
MEASURE = ("diorama", "deity")

ALL_FORMATS = ("gif", "webp", "webm")

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


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def have(tool):
    return shutil.which(tool) is not None


def optimise(paths):
    """Lossless recompression pass.

    Pillow and ffmpeg both write conservative encoders; optipng finds
    better PNG filter/deflate combinations and jpegoptim rebuilds the
    Huffman tables. Neither changes a pixel — `--all-progressive` is the
    only structural change, and it only affects decode order.
    """
    pngs = [p for p in paths if p.endswith(".png")]
    jpgs = [p for p in paths if p.endswith(".jpg")]
    before = sum(os.path.getsize(p) for p in paths)

    if pngs and have("optipng"):
        run(["optipng", "-quiet", "-o5", "-strip", "all", *pngs])
    if jpgs and have("jpegoptim"):
        run(["jpegoptim", "--quiet", "--strip-all", "--all-progressive", *jpgs])

    after = sum(os.path.getsize(p) for p in paths)
    missing = [t for t in ("optipng", "jpegoptim") if not have(t)]
    return before / 1024, after / 1024, missing


def extract_stills():
    src = Image.open(STILL).convert("RGB")
    written = []

    for box, path, quality in (
        (BACKDROP_STILL, f"{OUT}/diorama.jpg", 90),
        (DEITY_STILL, f"{OUT}/deity.jpg", 92),
    ):
        src.crop(box).save(path, quality=quality)
        written.append(path)

    for group, boxes in (("sys", SYS_STILLS), ("stage", STAGE_STILLS)):
        os.makedirs(f"{OUT}/{group}", exist_ok=True)
        for name, box in boxes.items():
            path = f"{OUT}/{group}/{name}.jpg"
            src.crop(box).save(path, quality=90)
            written.append(path)

    os.makedirs(f"{OUT}/icons", exist_ok=True)
    for name, box in ICON_STILLS.items():
        path = f"{OUT}/icons/{name}.png"
        icon = src.crop(box).resize((96, 96), Image.LANCZOS)
        key_alpha(icon).save(path)
        written.append(path)

    return written


def motion_filter(spec):
    """Crop, scale, and loop.

    Ping-pong plays the window forwards then backwards. The reversed half
    drops its first frame, otherwise the turning point shows the same
    image twice and the loop visibly stutters at each end.
    """
    x, y, w, h = spec["crop"]
    base = (
        f"crop={w}:{h}:{x}:{y},"
        f"scale={spec['width']}:-2:flags=lanczos,fps={spec['fps']}"
    )
    if spec["loop"] == "forward":
        return f"{base}[looped]"
    return (
        f"{base},split[fwd][rev];"
        f"[rev]reverse,trim=start_frame=1,setpts=N/FRAME_RATE/TB[bak];"
        f"[fwd][bak]concat=n=2:v=1:a=0[looped]"
    )


def encode(fmt, start, duration, chain, quality, path):
    """One ffmpeg invocation per output format.

    No software h264 here on purpose: this ffmpeg has no libx264, and VP9
    plus WebP cover every browser worth targeting without needing it.
    """
    common = [
        "ffmpeg", "-y", "-v", "error",
        "-ss", f"{start:.4f}", "-t", f"{duration:.4f}", "-i", VIDEO,
    ]

    if fmt == "gif":
        return run(common + [
            "-filter_complex",
            f"{chain};[looped]split[a][b];"
            f"[a]palettegen=stats_mode=diff:max_colors=192[p];"
            f"[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
            "-loop", "0", path,
        ])

    if fmt == "webp":
        return run(common + [
            "-filter_complex", chain, "-map", "[looped]",
            "-c:v", "libwebp_anim", "-lossless", "0",
            "-quality", str(quality),
            "-compression_level", "6", "-loop", "0", path,
        ])

    return run(common + [
        "-filter_complex", chain, "-map", "[looped]",
        "-an", "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0",
        "-row-mt", "1", path,
    ])


def extract_motion(tmp="/tmp/goldchain-art"):
    """Renders every window in every format into a scratch directory,
    then installs only the formats each asset actually ships."""
    os.makedirs(tmp, exist_ok=True)
    sizes = {}

    # Re-runs must be idempotent: a format that was shipped by an earlier
    # version of this script and isn't any more would otherwise sit in
    # public/ forever, get bundled, and be served to no purpose.
    for name, spec in MOTION.items():
        for fmt in ALL_FORMATS:
            if fmt not in spec["ship"]:
                stale = f"{OUT}/{name}.{fmt}"
                if os.path.exists(stale):
                    os.remove(stale)

    for name, spec in MOTION.items():
        first, last = spec["window"]
        start = (first - 1) / 24
        duration = (last - first + 1) / 24
        chain = motion_filter(spec)
        keep = spec["ship"]
        formats = ALL_FORMATS if name in MEASURE else keep

        sizes[name] = {}
        for fmt in formats:
            path = f"{tmp}/{name.replace('/', '-')}.{fmt}"
            encode(fmt, start, duration, chain, spec["quality"], path)
            sizes[name][fmt] = os.path.getsize(path) / 1024
            if fmt in keep:
                # shutil, not os.replace: the scratch dir is on a
                # different filesystem, which os.replace cannot cross.
                shutil.move(path, f"{OUT}/{name}.{fmt}")
            elif fmt == "gif":
                # Parked outside public/ rather than deleted. GIF is
                # several times the size of the shipped encodings so it
                # has no business in the build, but it is the one format a
                # README or a chat window will animate.
                target = f"{SOURCE}/gif/{name.replace('/', '-')}.gif"
                os.makedirs(os.path.dirname(target), exist_ok=True)
                shutil.move(path, target)

        sizes[name]["kept"] = keep

    return sizes


def main():
    for path in (STILL, VIDEO):
        if not os.path.exists(path):
            sys.exit(f"missing source: {path}")

    os.makedirs(OUT, exist_ok=True)
    written = extract_stills()
    before, after, missing = optimise(written)
    saved = 100 * (1 - after / before) if before else 0
    print(
        f"stills:  {len(written)} files, {before:.0f}K -> {after:.0f}K "
        f"({saved:.0f}% smaller)"
    )
    if missing:
        print(f"         (not installed, skipped: {', '.join(missing)})")

    sizes = extract_motion()
    print("\nmotion:")
    print(f"  {'asset':18} {'gif':>9} {'webp':>9} {'webm':>9}   shipped")
    total = 0
    for name, kinds in sizes.items():
        cell = lambda k: f"{kinds[k]:8.0f}K" if k in kinds else f"{'-':>9}"
        print(
            f"  {name:18} {cell('gif')} {cell('webp')} {cell('webm')}"
            f"   {', '.join(kinds['kept'])}"
        )
        total += sum(kinds[k] for k in kinds["kept"] if k in kinds)
    print(f"  {'':18} {'':9} {'':9} {'shipped:':>9} {total:6.0f}K")

    print(
        "\nGIFs are written to art-source/gif/ and are not shipped: at these\n"
        "sizes they cost several times the WebP for no visible gain. They\n"
        "exist because a README or a chat window will animate a GIF and\n"
        "will not animate a WebM.\n"
        "\nThe animated backdrop is a viewport mode, not the default. The\n"
        "generative pass garbled every sign in the set (MONKEY WORKERS\n"
        "UNION, POLICE) and dropped the Deity's salary placard with the UI,\n"
        "so the still is the more readable backdrop even though it doesn't\n"
        "move. That objection does not apply to the close-ups, which is why\n"
        "the per-component plates are animated by default: at 17% opacity\n"
        "behind text, or 34px tall, garbled signage is invisible.\n"
        "\nEvery animated asset has a same-named .jpg still, used as the\n"
        "prefers-reduced-motion fallback."
    )


if __name__ == "__main__":
    main()
