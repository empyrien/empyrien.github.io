#!/usr/bin/env python3
"""Nine-pointed star geometry for the site's emblem, favicon and astrolabe.

Every star on the site is drawn from these numbers, so they all agree.
Points sit on a circle of radius R, the first one straight up, 40° apart.

  python3 tools/star.py            # print the path data used in the HTML
"""
from math import cos, sin, radians, pi

N = 9


def pt(r, k, offset=-90.0):
    a = radians(offset + k * 360.0 / N)
    return r * cos(a), r * sin(a)


def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def polygon(points):
    return "M" + " L".join(f"{f(x)} {f(y)}" for x, y in points) + " Z"


def filled_star(R, ratio):
    """Solid star outline: 18 vertices, alternating tip (R) and notch (R*ratio)."""
    pts = []
    for k in range(N):
        pts.append(pt(R, k))
        pts.append(pt(R * ratio, k + 0.5))
    return polygon(pts)


def star_polygon(R, step):
    """The {9/step} star polygon as one continuous stroke (9 and 2 or 4 are coprime)."""
    order = [(i * step) % N for i in range(N)]
    return polygon([pt(R, k) for k in order])


def notch_ratio(step):
    """Inner radius of {9/step}, as a fraction of R."""
    return cos(pi * step / N) / cos(pi * (step - 1) / N)


def ticks(r_out, r_in_minor, r_in_major, count=72):
    d = []
    for i in range(count):
        a = radians(-90 + i * 360.0 / count)
        r_in = r_in_major if i % (count // N) == 0 else r_in_minor
        d.append(f"M{f(r_out*cos(a))} {f(r_out*sin(a))} L{f(r_in*cos(a))} {f(r_in*sin(a))}")
    return " ".join(d)


if __name__ == "__main__":
    print("emblem (filled, notch 0.56):\n ", filled_star(10, 0.56))
    print("favicon (filled, notch 0.6, R=15):\n ", filled_star(15, 0.6))
    print("{9/2} R=86:\n ", star_polygon(86, 2))
    print("{9/4} R=86:\n ", star_polygon(86, 4))
    print("notch radius {9/2}:", f(86 * notch_ratio(2)), " {9/4}:", f(86 * notch_ratio(4)))
    print("ticks:\n ", ticks(97, 94.5, 91))
    print("tip dots R=86:\n ", [(f(x), f(y)) for x, y in (pt(86, k) for k in range(N))])
