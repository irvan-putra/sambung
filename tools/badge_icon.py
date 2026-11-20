#!/usr/bin/env python3
"""sambung launcher icon: two arrows passing each other, because sambung
means "connect" - a request goes out and the reply comes back.

Same shared rules as the other vanipy apps: numbers-only version strip across
the bottom 24%, picture inside the round-mask safe circle, deterministic
output (pinned Pillow + pinned DejaVu font vendored in tools/fonts/, fail
instead of substituting).
    pip install pillow==12.3.0
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PILLOW_PIN = "12.3.0"
import PIL

if PIL.__version__ != PILLOW_PIN:
    sys.exit("Pillow %s required, found %s" % (PILLOW_PIN, PIL.__version__))

import importlib.util

HELPERS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "badge_common.py")
spec = importlib.util.spec_from_file_location("badge_common", HELPERS)
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)

S = common.S


def arrow(d, y_mid, direction, color):
    """One horizontal arrow centered on x=0.5. direction: +1 right, -1 left."""
    half_len, half_thick, head_w, head_h = 0.20, 0.030, 0.075, 0.075
    x0, x1 = 0.5 - half_len, 0.5 + half_len
    y0, y1 = y_mid - half_thick, y_mid + half_thick
    if direction > 0:
        d.rectangle([x0 * S, y0 * S, (x1 - head_w) * S, y1 * S], fill=color)
        d.polygon([((x1 - head_w) * S, (y_mid - head_h) * S),
                   (x1 * S, y_mid * S),
                   ((x1 - head_w) * S, (y_mid + head_h) * S)], fill=color)
    else:
        d.rectangle([(x0 + head_w) * S, y0 * S, x1 * S, y1 * S], fill=color)
        d.polygon([((x0 + head_w) * S, (y_mid - head_h) * S),
                   (x0 * S, y_mid * S),
                   ((x0 + head_w) * S, (y_mid + head_h) * S)], fill=color)


def connect(version):
    BG = (95, 61, 196, 255)       # sambung violet (#5f3dc4)
    STRIP = (64, 39, 143, 255)    # darker violet
    WHITE = (250, 250, 247, 255)
    AMBER = (255, 179, 0, 255)
    art, d = common.new_layer()
    # request goes out (top, pointing right), reply comes back (bottom, left)
    arrow(d, 0.40, +1, WHITE)
    arrow(d, 0.60, -1, WHITE)
    # the meeting point: small amber dot between the two heads
    d.ellipse([(0.475) * S, (0.485) * S, (0.525) * S, (0.535) * S], fill=AMBER)
    return common.compose(BG, art, version, STRIP, WHITE, rounded=.2)


def main():
    version = common.parse_version(sys.argv)
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    common.write_densities(connect(version), os.path.join(root, "android/app/src/main/res"))
    print("wrote sambung icons for", version)


if __name__ == "__main__":
    main()
