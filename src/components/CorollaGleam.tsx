/* eslint-disable */
// Corolla Gleam — Originkit

"use client"

/**
 * CorollaGleam — a turning ring of thick iridescent glass paddles: edge-on at
 * the top and bottom, opening toward face-on at the sides, their thin-film
 * colours flowing as each one travels round.
 *
 * Built from the user's PrismGlassFan and their reference still (a 1199×675
 * render of thirteen rounded slabs fanned up from below the frame), then
 * closed into a full ring at their request: the still is the top half of the
 * ring. What the still turned out to be, measured rather than eyeballed:
 *
 * - Geometry. The centre slab is one 27 px strip top to bottom, so the camera
 *   is orthographic. Silhouettes, face/wall edges and tip arcs fit "lean in
 *   the picture plane + twist about the slab's own axis" to ~3 px: slabs 282
 *   wide and 26 thick, a 12.3° step between them, and a twist that follows
 *   the angle from the vertical but eases off toward 90°,
 *   τ = 90°·(1 − e^(−gain·φ/90°)). The slab nearer the top sits in front and
 *   shows its face toward it, its rim away from it. In the ring the twist
 *   reads its angle from the nearer of top and bottom, folded smoothly at the
 *   sides, so a slab turning past them never jerks; Inner Radius 20 % gives
 *   the still's own slab extents.
 * - Section. The rim is flat across (one colour edge to edge) with a thin
 *   bright line on both edges: a flat plate with small fillets, not a
 *   capsule. The view ray stays at one distance along the slab, so each pixel
 *   solves that rounded-rectangle section in closed form — face, fillet,
 *   rim, fillet — with exact normals and no marching.
 * - Colour. Each flat face reflects one direction only yet changes colour
 *   along its length, so the look is a thin-film coat keyed by how far a
 *   surface faces the viewer and how far along the slab it is. Down the
 *   centre rim, whose end sweeps from facing to edge-on, the colours run
 *   through exactly the stations the other slabs' rims show, which confirms
 *   it. Those stations, slab by slab and side by side, are recipes over the
 *   colour controls fitted to the still in OKLab, plus the ring of thicker
 *   film at ~62 % of the length (a pastel rainbow on the near edge-on faces).
 *
 * Drawn as one quad per slab, back to front, over the CSS background, with a
 * soft contact shadow on the slabs behind; empty pixels cost nothing.
 * Vsync-locked ~60 fps while it moves, zero draws once still, off screen or
 * hidden, and the resolution steps down on its own on slow devices.
 */

import { useEffect, useRef, type CSSProperties } from "react"
const ControlType = new Proxy({}, { get: (_, k) => String(k) })
const addPropertyControls = (_c: unknown, _ctrls: unknown) => {}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

/** Reference frame (the user's original intrinsic size). */
const REF_W = 1200
const REF_H = 800
/** Stage units across the reference frame's height (1 unit ≈ 1 ref px). */
const STAGE_H = 800

const MAX_BLADES = 41

/** Width/height of the ring's bounds, contact shadow included. */
const CONTENT_ASPECT = 1.0
/** Ring radius at Scale 100 %, in stage units (the frame is 800 tall). */
const RING_FIT = 352
/** Width of the contact shadow round each slab, in slab units. */
const CONTACT_W = 24
/** Twist follows the angle exactly up to here, then eases into the sides. */
const FOLD_A = 75

interface Advanced {
    bladeWidth: number
    bladeLength: number
    thickness: number
    bevel: number
    tailLength: number
    pivotY: number
    fanAngle: number
    twistGain: number
    pinkColor: string
    deepColor: string
    lightColor: string
    tealColor: string
    hotColor: string
    filmShift: number
    rimFilm: number
    rimTop: number
    teal: number
    shadow: number
    contact: number
    specular: number
    shininess: number
    sheen: number
    grain: number
    vignette: number
    cycleMs: number
    staggerMs: number
    wobble: number
    sway: number
    lightTravel: number
}

/** Tuning values; every default here is the reference look. */
const DEFAULT_ADVANCED: Advanced = {
    bladeWidth: 282,
    bladeLength: 600,
    thickness: 26,
    bevel: 3.5,
    tailLength: 120,
    pivotY: 400,
    fanAngle: 180,
    twistGain: 100,
    pinkColor: "#B51F66",
    deepColor: "#3300CC",
    lightColor: "#B0A8EC",
    tealColor: "#008989",
    hotColor: "#F6DDA8",
    filmShift: 30,
    rimFilm: 50,
    rimTop: 0,
    teal: 60,
    shadow: 0,
    contact: 45,
    specular: 70,
    shininess: 60,
    sheen: 25,
    grain: 0,
    vignette: 0,
    cycleMs: 6000,
    staggerMs: 80,
    wobble: 3,
    sway: 4,
    lightTravel: 100,
}

interface Placement {
    x: number
    y: number
    angle: number
    tilt: number
}

const DEFAULT_PLACEMENT: Placement = { x: 0, y: 0, angle: 0, tilt: 0 }

const DEFAULTS = {
    background: "#000000",
    warm: "#D9703E",
    cool: "#5B61CF",
    count: 27,
    innerRadius: 22,
    scale: 194,
    hover: 100,
    breathe: 60,
    speed: 50,
    spin: 10,
}

/** Swatches a recipe can draw on: the colour controls, plus black. */
type Swatch = "W" | "C" | "P" | "D" | "L" | "T" | "H" | "K"

/**
 * The film behind the look, as recipes over the colour controls: "AB t g" is
 * g · mix(A, B, t) (W warm, C cool, P pink, D deep, L lavender, T teal,
 * H highlight, K black). Each row is one slab station from the centre out,
 * keyed by how far it faces the viewer; each column one point up the slab
 * (FILM_S, share of the length). Fitted to the still's own colours, slab by
 * slab and side by side (its light is not symmetric), so a colour control
 * recolours every place that swatch appears and nothing is baked from the
 * picture itself.
 */
const FILM_S = [0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9]
/** sin(twist) of slabs 1…6 in the reference fan: the face stations. */
const FACE_C = [0.1998, 0.3677, 0.5051, 0.6153, 0.7027, 0.7713]
/**
 * cos(twist) of slabs 0…6: the wall stations; then grazing stations, which
 * the rims run through where they turn over the rounded ends (read off the
 * centre rim, whose end sweeps from facing the viewer to edge-on).
 */
const WALL_C = [1.0, 0.9798, 0.9299, 0.8631, 0.7883, 0.7115, 0.6365, 0.56, 0.49, 0.4, 0.29, 0.0]

const RECIPES: Record<"faceL" | "faceR" | "wallL" | "wallR", string[][]> = {
    faceL: [
        ["TK 0.85 0.95", "WK 0.85 0.50", "WP 0.15 0.25", "WK 0.55 1.20", "WK 0.55 1.20", "WK 0.30 1.30", "WK 0.30 1.30", "WP 0.15 0.80", "WP 0.35 0.85"],
        ["DT 0.10 0.20", "DK 0.70 1.15", "PD 0.95 0.45", "DK 0.20 0.60", "WD 0.95 0.60", "PD 0.85 0.80", "PD 0.80 0.60", "PD 0.85 0.40", "PD 0.75 0.55"],
        ["DT 0.40 0.70", "DT 0.40 0.70", "DT 0.50 0.95", "DT 0.55 1.10", "DT 0.50 1.10", "CD 0.35 1.05", "DL 0.20 1.05", "DL 0.30 1.00", "DL 0.50 1.05"],
        ["LT 0.55 0.65", "LT 0.55 0.65", "LT 0.55 0.65", "DT 0.90 0.90", "CT 0.45 1.00", "CT 0.30 1.15", "CL 0.45 0.95", "CL 0.40 1.00", "CL 0.65 1.05"],
        ["CT 0.60 0.90", "CT 0.60 0.90", "CT 0.60 0.90", "CT 0.60 0.90", "CT 0.45 1.00", "CT 0.30 1.05", "CL 0.30 0.95", "CL 0.45 1.00", "CL 0.75 1.00"],
        ["DL 0.70 0.95", "DL 0.70 0.95", "DL 0.70 0.95", "DL 0.70 0.95", "DL 0.70 0.95", "DL 0.70 0.95", "DL 0.70 0.95", "DL 0.70 0.95", "DL 0.70 0.95"],
    ],
    faceR: [
        ["CK 0.90 0.95", "WK 0.70 0.40", "WP 0.30 0.50", "WK 0.35 1.20", "WK 0.35 1.20", "WL 0.35 0.95", "WL 0.35 0.95", "WK 0.15 1.10", "WP 0.20 0.90"],
        ["DK 0.90 0.70", "DK 0.85 1.30", "DK 0.70 1.25", "PD 0.85 0.55", "PD 0.85 0.65", "PD 0.80 0.60", "DK 0.80 1.20", "WD 0.90 0.20", "PD 0.60 0.25"],
        ["DT 0.30 0.50", "DT 0.30 0.50", "DT 0.40 0.75", "DT 0.45 0.95", "DT 0.45 0.85", "CD 0.50 0.90", "CD 0.05 0.70", "DL 0.55 0.55", "DL 0.40 0.95"],
        ["DT 0.80 0.75", "DT 0.80 0.75", "DT 0.80 0.75", "DT 0.90 0.80", "CT 0.45 0.85", "CT 0.15 1.05", "CL 0.50 0.85", "LT 0.15 0.75", "DL 0.80 1.00"],
        ["CT 0.60 0.90", "CT 0.60 0.90", "CT 0.60 0.90", "CT 0.60 0.90", "CT 0.45 1.00", "CT 0.30 1.05", "CL 0.30 0.95", "CL 0.45 1.00", "CL 0.75 1.00"],
        ["CP 0.05 1.05", "CP 0.05 1.05", "CP 0.05 1.05", "CP 0.05 1.05", "CP 0.05 1.05", "CP 0.05 1.05", "CP 0.05 1.05", "CP 0.05 1.05", "CP 0.05 1.05"],
    ],
    wallL: [
        ["CL 0.75 0.90", "WP 0.20 1.00", "WP 0.90 1.20", "PD 0.20 1.30", "PD 0.40 1.20", "PD 0.25 0.95", "PD 0.25 1.15", "PD 0.25 1.30", "WH 0.30 0.95"],
        ["LT 0.15 1.00", "WP 0.30 1.00", "WP 0.45 1.10", "PD 0.10 1.20", "PD 0.40 0.95", "PK 0.50 1.25", "WP 0.60 0.85", "WP 0.25 1.00", "WH 0.35 0.95"],
        ["CH 0.55 1.15", "WP 0.30 1.00", "WP 0.20 1.10", "WH 0.05 1.00", "WT 0.30 1.00", "WT 0.20 0.60", "WP 0.20 0.75", "WK 0.15 1.15", "LH 0.65 0.85"],
        ["WP 0.55 1.15", "WP 0.55 1.15", "WD 0.15 1.20", "WL 0.20 1.10", "LH 0.90 0.75", "WT 0.60 1.15", "WT 0.50 0.70", "WP 0.05 0.70", "PH 0.75 0.85"],
        ["PD 0.10 0.95", "PD 0.10 0.95", "PD 0.10 0.95", "PD 0.10 0.95", "PD 0.20 1.15", "WD 0.40 1.15", "LH 0.10 0.70", "CT 0.35 0.85", "WH 0.15 0.85"],
        ["WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WT 0.20 0.95", "WT 0.20 0.95"],
        ["WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WP 0.20 0.85", "WT 0.20 0.95", "WT 0.20 0.95"],
        ["LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35"],
        ["DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40"],
        ["PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30"],
        ["WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80"],
        ["WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90"],
    ],
    wallR: [
        ["CL 0.75 0.90", "WP 0.20 1.00", "WP 0.90 1.20", "PD 0.20 1.30", "PD 0.40 1.20", "PD 0.25 0.95", "PD 0.25 1.15", "PD 0.25 1.30", "WH 0.30 0.95"],
        ["DH 0.40 1.05", "WT 0.20 1.15", "PH 0.25 0.95", "WP 0.90 1.15", "WP 0.80 1.05", "WP 0.80 1.00", "WP 0.95 1.10", "PD 0.15 1.25", "WT 0.25 1.30"],
        ["LT 0.15 0.85", "WT 0.20 1.15", "WT 0.40 1.30", "WT 0.20 1.10", "WK 0.10 1.15", "WP 0.10 1.00", "WP 0.20 1.00", "WP 0.15 1.00", "CH 0.65 1.10"],
        ["WH 0.55 0.95", "WH 0.55 0.95", "TH 0.90 0.90", "TH 0.75 0.90", "CH 0.85 0.80", "WH 0.75 0.90", "WH 0.50 1.00", "WT 0.15 1.20", "WC 0.25 1.10"],
        ["WL 0.50 1.00", "WL 0.50 1.00", "WL 0.50 1.00", "WL 0.50 1.00", "CH 0.60 1.05", "CH 0.40 1.10", "PL 0.95 0.95", "WL 0.80 1.05", "DH 0.80 0.90"],
        ["LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "CL 0.65 0.95", "CL 0.65 0.95"],
        ["LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "LT 0.20 1.00", "CL 0.65 0.95", "CL 0.65 0.95"],
        ["LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35", "LH 0.50 0.35"],
        ["DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40", "DT 0.80 0.40"],
        ["PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30", "PD 0.60 0.30"],
        ["WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80", "WT 0.20 0.80"],
        ["WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90", "WL 0.80 0.90"],
    ],
}

/**
 * The ring of thicker film that crosses every slab at RING_S of its length:
 * on the near-edge-on faces (facing below RING_C) it splits into a pastel
 * rainbow — yellow, green, blue, violet going up — as in the still.
 */
const RING = { S: 0.65, SIG: 0.07, AMOUNT: 0.65, HUE0: 0.36, HUE1: -0.3, LIFT: 0.4, C: 0.28 }

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CorollaGleamProps {
    /** Ground behind the fan and in the gaps between slabs. */
    background?: string
    /** Number of slabs round the ring (odd). */
    count?: number
    /** The opening in the middle, as a share of the ring's radius. */
    innerRadius?: number
    /** How big the fan draws, growing up from the bottom edge. */
    scale?: number
    /** Film colour of the slabs seen near edge-on (inner faces, rims). */
    warm?: string
    /** Film colour of the slabs turning toward the viewer. */
    cool?: string
    /** Where the fan sits in its frame and how it is turned. */
    placement?: Partial<Placement>
    /** Pointer response: lean and twist toward it, light follows, press opens. */
    hover?: number
    /** How far the fan closes and reopens each cycle. 0 holds it open. */
    breathe?: number
    /** Master tempo: breathing, drifting film and spin. 0 stops it. */
    speed?: number
    /** How fast the ring turns; negative turns it anticlockwise. */
    spin?: number
    advanced?: Partial<Advanced>
    style?: CSSProperties
}

/* ------------------------------------------------------------------ */
/*  Colour helpers                                                     */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number]

const COLOR_CACHE = new Map<string, RGB>()

function parseColor(input: string | undefined, fallback: string): RGB {
    const key = typeof input === "string" ? input : ""
    const hit = COLOR_CACHE.get(key)
    if (hit) return hit
    let s = key.trim()
    const v = s.match(/^var\([^,]+,\s*(.+)\)$/)
    if (v) s = v[1].trim()
    let out: RGB | null = null
    let m = s.match(/^#([0-9a-f]{3,8})$/i)
    if (m) {
        let h = m[1]
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((c) => c + c)
                .join("")
        if (h.length >= 6)
            out = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
    }
    if (!out) {
        m = s.match(/^rgba?\(([^)]+)\)$/i)
        if (m) {
            const parts = m[1]
                .split(/[\s,/]+/)
                .filter(Boolean)
                .map(parseFloat)
            if (parts.length >= 3 && parts.slice(0, 3).every((n) => isFinite(n)))
                out = [parts[0] / 255, parts[1] / 255, parts[2] / 255]
        }
    }
    if (!out) out = key === fallback ? [0, 0, 0] : parseColor(fallback, fallback)
    if (COLOR_CACHE.size > 200) COLOR_CACHE.clear()
    COLOR_CACHE.set(key, out)
    return out
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function scaleRGB(a: RGB, k: number): RGB {
    return [a[0] * k, a[1] * k, a[2] * k]
}

interface Palette {
    warm: RGB
    cool: RGB
    pink: RGB
    deep: RGB
    lite: RGB
    teal: RGB
    hot: RGB
}

const TAB_W = 32
const TAB_ROWS = 32
/** Length range the tables span (below and above, they clamp). */
const TAB_S0 = 0.2
const TAB_S1 = 1.0

function swatch(p: Palette, k: string): RGB {
    switch (k as Swatch) {
        case "W": return p.warm
        case "C": return p.cool
        case "P": return p.pink
        case "D": return p.deep
        case "L": return p.lite
        case "T": return p.teal
        case "H": return p.hot
        default: return [0, 0, 0]
    }
}

function recipe(p: Palette, r: string): RGB {
    const [ab, t, g] = r.split(" ")
    return scaleRGB(mixRGB(swatch(p, ab[0]), swatch(p, ab[1]), parseFloat(t)), parseFloat(g))
}

function lerpTable(stations: number[], rows: RGB[][], c: number, k: number): RGB {
    // stations may run either way; find the bracketing pair
    const n = stations.length
    const asc = stations[n - 1] > stations[0]
    let i = 0
    while (i < n - 2 && (asc ? c > stations[i + 1] : c < stations[i + 1])) i++
    const t = clamp((c - stations[i]) / (stations[i + 1] - stations[i]), 0, 1)
    return mixRGB(rows[i][k], rows[i + 1][k], t)
}

/**
 * Bakes the four film tables into one 32×128 RGBA8 texture: rows 0–31 faces
 * left, 32–63 faces right, 64–95 walls left, 96–127 walls right. Across: the
 * length; down: facing, spanning each table's station range.
 */
function bakeTables(p: Palette, out: Uint8Array) {
    const tabs: [string[][], number[]][] = [
        [RECIPES.faceL, FACE_C],
        [RECIPES.faceR, FACE_C],
        [RECIPES.wallL, WALL_C],
        [RECIPES.wallR, WALL_C],
    ]
    for (let t = 0; t < 4; t++) {
        const [rec, st] = tabs[t]
        const rows = rec.map((row) => row.map((r) => recipe(p, r)))
        const c0 = st[0]
        const c1 = st[st.length - 1]
        for (let y = 0; y < TAB_ROWS; y++) {
            const c = c0 + ((c1 - c0) * y) / (TAB_ROWS - 1)
            // colour at each length key for this facing, then along the length
            const keys = FILM_S.map((_, k) => lerpTable(st, rows, c, k))
            for (let x = 0; x < TAB_W; x++) {
                const sv = TAB_S0 + ((TAB_S1 - TAB_S0) * x) / (TAB_W - 1)
                let k = 0
                while (k < FILM_S.length - 2 && sv > FILM_S[k + 1]) k++
                const f = clamp((sv - FILM_S[k]) / (FILM_S[k + 1] - FILM_S[k]), 0, 1)
                const col = mixRGB(keys[k], keys[k + 1], f)
                const o = ((t * TAB_ROWS + y) * TAB_W + x) * 4
                for (let ch = 0; ch < 3; ch++) out[o + ch] = Math.round(clamp(col[ch], 0, 1) * 255)
                out[o + 3] = 255
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Shaders                                                            */
/* ------------------------------------------------------------------ */

const SLAB_VS = `#version 300 es
precision highp float;
precision highp int;
uniform vec4 uSA[${MAX_BLADES}];   // axis u.xy, sin(twist), cos(twist)
uniform vec4 uSB[${MAX_BLADES}];   // side, quad half-extent across, film side (0 left…1 right), pointer glow
uniform vec4 uSC[${MAX_BLADES}];   // radial breathing offset, 0, 0, 0
uniform vec4 uGeo;     // R, L (inner end to tip), T, inner radius (slab units)
uniform vec2 uPivot;   // ring centre (stage, from the composition's bottom centre)
uniform vec4 uMap;     // composition origin (buffer px, y up), px per stage unit, px per slab unit
uniform vec4 uPl;      // placement centre (buffer px, y up), offset (buffer px, y up)
uniform vec4 uPl2;     // cos angle, sin angle, cos tilt, sin tilt
uniform vec4 uPl3;     // cos yaw, sin yaw (pointer lean), 0, 0
uniform vec3 uRes;     // buffer w, h, perspective distance (px)
uniform vec2 uShade;   // contact shadow strength, width (slab units)
out vec2 vP;
flat out vec4 vA;
flat out vec4 vB;
flat out vec4 vC;
void main() {
    int id = gl_VertexID / 6;
    int c = gl_VertexID - id * 6;
    int corner = c < 3 ? c : (c == 3 ? 2 : (c == 4 ? 1 : 3));
    vec4 A = uSA[id];
    vec4 B = uSB[id];
    vec4 C = uSC[id];
    vec2 u = A.xy;
    vec2 nO = B.x * vec2(u.y, -u.x);
    float pad = 4.0 / uMap.w + uShade.y;
    float r0 = uGeo.w + C.x;
    float s = (corner >> 1) == 0 ? r0 - pad : r0 + uGeo.y + pad;
    float k = ((corner & 1) == 0 ? -1.0 : 1.0) * (B.y + pad);
    vec2 local = s * u + k * nO;
    vP = local;
    vA = A;
    vB = B;
    vC = C;
    vec2 px = uMap.xy + uPivot * uMap.z + local * uMap.w;
    vec2 rel = px - uPl.xy;
    float D = uRes.z;
    // Lean (Tilt, top away when positive, then the pointer's yaw, right side
    // away when positive) under a perspective of D px.
    float x2 = rel.x * uPl3.x - rel.y * uPl2.w * uPl3.y;
    float y2 = rel.y * uPl2.z;
    float w = max((D + rel.y * uPl2.w * uPl3.x + rel.x * uPl3.y) / D, 0.05);
    // Angle: clockwise on screen for positive values.
    vec2 r = vec2(uPl2.x * x2 + uPl2.y * y2, -uPl2.y * x2 + uPl2.x * y2);
    vec2 scr = r + (uPl.xy + uPl.zw) * w;
    gl_Position = vec4(scr / uRes.xy * 2.0 - w, 0.0, w);
}`

const SLAB_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vP;
flat in vec4 vA;
flat in vec4 vB;
flat in vec4 vC;
uniform vec4 uGeo;     // R, L (inner end to tip), T, inner radius
uniform vec4 uGeo2;    // bevel radius, shaded root (share of L), film phase (0..1), film travel
uniform sampler2D uTab;   // film tables, 32×128 (see bakeTables)
uniform vec4 uTabC;    // face facing range c0, c1; wall facing range c0, c1
uniform vec4 uFilm;    // film shift (×), rim film (facing offset), rim tip, pointer film shift
uniform vec4 uRing;    // S, SIG, amount, hue at centre
uniform vec4 uRing2;   // hue per SIG, lift, facing cut-off, 0
uniform vec3 uLite;
uniform vec3 uHot;
uniform vec3 uPink;
uniform vec3 uWarm;
uniform vec3 uLight;   // unit light direction (view space)
uniform vec4 uLook;    // shadow, specular, shininess, pointer film shift
uniform vec2 uShade;   // contact shadow strength, width (slab units)
out vec4 outColor;

const float PI = 3.14159265;

// Film table lookup: row0 picks the table, c the facing (0…1 across its
// stations), sl the length (0…1 across TAB_S0…TAB_S1).
vec3 film(float row0, float c, float sl) {
    float u = (0.5 + clamp(sl, 0.0, 1.0) * 31.0) / 32.0;
    float v = (row0 + 0.5 + clamp(c, 0.0, 1.0) * 31.0) / 128.0;
    return textureLod(uTab, vec2(u, v), 0.0).rgb;
}

// Left table at row0, right at row0 + 32; both only near edge-on (top/bottom).
vec3 film2(float row0, float c, float sl, float side) {
    if (side <= 0.001) return film(row0, c, sl);
    if (side >= 0.999) return film(row0 + 32.0, c, sl);
    return mix(film(row0, c, sl), film(row0 + 32.0, c, sl), side);
}

// Exact signed distance to an ellipse (Quilez), with a circle fallback where
// the two radii meet and the closed form loses precision.
float sdEllipse(vec2 p, vec2 ab) {
    p = abs(p);
    if (abs(ab.x - ab.y) < 1e-3 * ab.y) return length(p) - ab.x;
    if (p.x > p.y) { p = p.yx; ab = ab.yx; }
    float l = ab.y * ab.y - ab.x * ab.x;
    float m = ab.x * p.x / l;
    float m2 = m * m;
    float n = ab.y * p.y / l;
    float n2 = n * n;
    float c = (m2 + n2 - 1.0) / 3.0;
    float c3 = c * c * c;
    float q = c3 + m2 * n2 * 2.0;
    float d = c3 + m2 * n2;
    float g = m + m * n2;
    float co;
    if (d < 0.0) {
        float h = acos(clamp(q / c3, -1.0, 1.0)) / 3.0;
        float s = cos(h);
        float t = sin(h) * sqrt(3.0);
        float rx = sqrt(max(-c * (s + t + 2.0) + m2, 0.0));
        float ry = sqrt(max(-c * (s - t + 2.0) + m2, 0.0));
        co = (ry + sign(l) * rx + abs(g) / max(rx * ry, 1e-12) - m) / 2.0;
    } else {
        float h = 2.0 * m * n * sqrt(d);
        float s = sign(q + h) * pow(abs(q + h), 1.0 / 3.0);
        float u = sign(q - h) * pow(abs(q - h), 1.0 / 3.0);
        float rx = -s - u - c * 4.0 + 2.0 * m2;
        float ry = (s - u) * sqrt(3.0);
        float rm = sqrt(rx * rx + ry * ry);
        co = (ry / sqrt(max(rm - rx, 1e-12)) + 2.0 * g / max(rm, 1e-12) - m) / 2.0;
    }
    co = clamp(co, 0.0, 1.0);
    vec2 r = ab * vec2(co, sqrt(1.0 - co * co));
    return length(r - p) * sign(p.y - r.y);
}

void main() {
    vec2 u = vA.xy;
    float st = vA.z;
    float ct = vA.w;
    vec2 nO = vB.x * vec2(u.y, -u.x);
    float s = dot(vP, u);
    float k = dot(vP, nO);
    // Stage units per buffer pixel (exact under Scale, Placement and Tilt).
    float px = max(sqrt(length(dFdx(vP)) * length(dFdy(vP))), 1e-4);

    float R = uGeo.x;
    float L = uGeo.y;
    float B = 0.5 * uGeo.z;
    // Fillet: never thinner than ~0.8 px, or the bevel lines alias.
    float rho = clamp(max(uGeo2.x, 0.8 * px), 1e-3, min(B, R) - 1e-3);
    // A stadium from the inner circle out: both ends rounded with radius R.
    float r0 = uGeo.w + vC.x;
    float dsg = s - (r0 + 0.5 * L);
    float capS = dsg < 0.0 ? -1.0 : 1.0;
    float dc = abs(dsg) - (0.5 * L - R);
    // The plate is a sharp slab shrunk by rho, rounded by a ball of rho.
    float Rp = R - rho;
    float Bp = B - rho;
    float dcc = min(dc, Rp);
    float Ap = dc > 0.0 ? sqrt(max(Rp * Rp - dcc * dcc, 0.0)) : Rp;

    // Silhouette: distance to the projected shrunk slab, minus rho. Projected,
    // the rounded end is an ellipse (Rp along the slab, Rp·sinτ across)
    // widened by the thickness, so measure against that ellipse.
    // A sub-pixel floor keeps the edge-on ellipse from degenerating; the
    // thickness segment gives the same amount back, so widths stay exact.
    float eps = min(0.25 * px, 0.5 * Bp * ct + 1e-4);
    float ea = Rp * st + eps;
    float xk = max(abs(k) - (Bp * ct - eps), 0.0);
    float dcore = xk - ea;
    // Within a hair of where an end starts, the straight-side distance is the
    // same to a fraction of a pixel, and the ellipse's closed form is not
    // numerically safe on its axis.
    if (dc > 0.5 * px) {
        vec2 ep = vec2(xk, dc);
        vec2 er = vec2(ea, Rp);
        float k0 = length(ep / er);
        float k1 = max(length(ep / (er * er)), 1e-6);
        dcore = k0 * (k0 - 1.0) / k1;
        // The quick estimate is good to a fraction of a pixel unless the
        // ellipse is thin; refine only where it decides an edge pixel.
        if (abs(dcore - rho) < 4.0 * px + 0.3 * abs(dcore) || ea < 6.0 * px) dcore = sdEllipse(ep, er);
    }
    float dist = dcore - rho;
    float cov = clamp(0.5 - dist / px, 0.0, 1.0);
    // A NaN from a degenerate input reads as "not covered", never as a block.
    if (!(cov >= 0.0 && cov <= 1.0)) cov = 0.0;
    if (cov <= 0.0) {
        // Just outside: a soft contact shadow on whatever lies behind (the
        // slabs drawn before this one), like the still's dark overlaps.
        float sh = uShade.x * pow(1.0 - clamp(dist / max(uShade.y, 1e-3), 0.0, 1.0), 2.0);
        if (!(sh > 0.004)) discard;
        outColor = vec4(0.0, 0.0, 0.0, sh);
        return;
    }

    // Section frame: p (outward, picture plane), w (width), n (thickness).
    vec3 p3 = vec3(nO, 0.0);
    vec3 u3 = vec3(u, 0.0);
    vec3 w3 = st * p3 + vec3(0.0, 0.0, ct);
    vec3 n3 = ct * p3 - vec3(0.0, 0.0, st);
    float dcp = max(dc, 0.0);
    vec3 Wn = normalize(Ap * w3 + capS * dcp * u3 + 1e-4 * w3);
    vec3 Wi = normalize(-Ap * w3 + capS * dcp * u3 - 1e-4 * w3);
    float tau = atan(st, ct);

    float kF0 = -Ap * st - B * ct;
    float kF1 = Ap * st - B * ct;
    float kW0 = (Ap + rho) * st - Bp * ct;
    float kW1 = (Ap + rho) * st + Bp * ct;

    // Feature coordinates shared by both films.
    // Share of the length, scaled to the still's own: the inner end sits where
    // the fan left the bottom of its frame (0.2), the tip at 1.
    float sAl = clamp(0.2 + 0.8 * (s - r0) / L, 0.0, 1.0);
    float phase = uGeo2.z * 2.0 * PI;
    float travel = uGeo2.w;
    float side = vB.z;   // 0 left of centre, 1 right (the still's light is not symmetric)
    // the film drifts up and down the slabs as the light circles
    float sF = 0.6 + (sAl - 0.6) * uFilm.x + 0.025 * travel * sin(phase - sAl * 3.0);
    float sl = (sF - ${TAB_S0.toFixed(2)}) / ${(TAB_S1 - TAB_S0).toFixed(2)};

    // Which part of the section this pixel sees: 0 inner fillet, 1 face,
    // 2 face-to-wall fillet, 3 wall, 4 outer fillet. Only the films a part
    // shows are computed.
    int part = k < kF0 ? 0 : (k <= kF1 ? 1 : (k < kW0 ? 2 : (k <= kW1 ? 3 : 4)));
    float capIn = smoothstep(0.0, 0.6, dcp / R);
    vec3 face = vec3(0.0);
    vec3 wall = vec3(0.0);
    float cf = st;
    float lf = clamp((k - kF0) / max(kF1 - kF0, 1e-3), 0.0, 1.0);

    if (part <= 2) {
        // ---- face film ----
        float ci = (cf + uFilm.w - uTabC.x) / (uTabC.y - uTabC.x);
        face = film2(0.0, ci, sl, side);
        // near edge-on faces are bright on their inner half, dark toward the wall
        if (cf < 0.42) face *= mix(1.0, clamp(exp(1.6 * (0.5 - lf)), 0.45, 1.35), 1.0 - smoothstep(0.25, 0.42, cf));
        // thicker-film ring: a pastel rainbow on the near edge-on faces
        if (cf < uRing2.z + 0.06) {
            float rr = (sF - uRing.x - 0.02 * travel * sin(phase)) / uRing.y;
            float g = exp(-rr * rr) * uRing.z * (1.0 - smoothstep(uRing2.z - 0.06, uRing2.z + 0.06, cf));
            vec3 rb = 0.5 + 0.5 * cos(2.0 * PI * (uRing.w + uRing2.x * rr + vec3(0.0, 1.0 / 3.0, 2.0 / 3.0)));
            rb = uRing2.y + (1.0 - uRing2.y) * 0.9 * rb;
            face = mix(face, rb, clamp(g, 0.0, 1.0));
        }
        // the dark slabs glow maroon on their inner side toward the tip
        if (abs(cf - 0.37) < 0.24) {
            float dk = exp(-pow((cf - 0.37) / 0.08, 2.0)) * pow(1.0 - lf, 5.0) * smoothstep(0.55, 0.8, sF);
            face = mix(face, uWarm * vec3(0.48, 0.03, 0.05), clamp(dk * 1.2, 0.0, 1.0));
        }
        // the roots darken toward the inner circle
        face *= mix(0.35, 1.0, smoothstep(0.0, max(uGeo2.y, 1e-3), (s - r0) / L));
    }
    if (part >= 2 || capIn > 0.0) {
        // ---- wall film ----
        float wi = (Wn.z - uFilm.y + uFilm.w - uTabC.z) / (uTabC.w - uTabC.z);
        wall = film2(64.0, wi, sl, side);
        wall = mix(wall, uLite, clamp(uFilm.z, 0.0, 1.0) * smoothstep(0.9, 1.0, sAl));
    }

    vec3 N;
    vec3 col;
    float bev = 0.0;
    if (part == 0) {
        // inner fillet: the face rolls over to the hidden far wall and darkens
        float phi = max(tau - acos(clamp((-(Ap * st + Bp * ct) - k) / rho, -1.0, 1.0)), 0.0);
        N = cos(phi) * (-n3) + sin(phi) * Wi;
        float a = tau > 1e-3 ? phi / tau : 1.0;
        // over the rounded ends this fillet turns and catches the light like the rim
        col = mix(face * (1.0 - 0.55 * a), wall, a * capIn);
        bev = 0.35 * sin(PI * clamp(0.3 + 0.7 * a, 0.0, 1.0));
    } else if (part == 1) {
        N = -n3;
        col = face;
    } else if (part == 2) {
        // front fillet, face to wall: a cream line on the near-edge-on slabs,
        // a dark seam on the ones turned toward the viewer
        float phi = clamp(acos(clamp((Ap * st - Bp * ct - k) / rho, -1.0, 1.0)) - tau, 0.0, 0.5 * PI);
        N = cos(phi) * (-n3) + sin(phi) * Wn;
        float a = phi / (0.5 * PI);
        float m = sin(PI * a);
        float capT = smoothstep(0.2, 0.7, dcp / R);
        col = mix(face, wall, smoothstep(0.25, 0.75, a)) * (1.0 - 0.6 * m * m * smoothstep(0.25, 0.5, st) * (1.0 - capT));
        bev = m * mix(1.0 - smoothstep(0.2, 0.45, st), 0.6, capT);
    } else if (part == 3) {
        N = Wn;
        col = wall;
    } else {
        // outer fillet: the wall rolls over to the back face through magenta
        float phi = clamp(asin(clamp((k - (Ap * st + Bp * ct)) / rho, -1.0, 1.0)) - tau, 0.0, 0.5 * PI);
        N = cos(phi) * Wn + sin(phi) * n3;
        float a = phi / max(0.5 * PI - tau, 1e-3);
        float capT = smoothstep(0.3, 0.9, dcp / R);
        col = mix(wall, uPink, smoothstep(0.0, 0.5, a) * (1.0 - capT)) * (1.0 - 0.8 * (1.0 - capT) * smoothstep(0.45, 1.0, a));
        bev = 0.6 * sin(PI * clamp(a * 1.6, 0.0, 1.0)) * (1.0 - smoothstep(0.2, 0.45, st));
    }

    // ---- light ----
    float lit = clamp(dot(N, uLight) * 0.5 + 0.5, 0.0, 1.0);
    col *= mix(1.0 - uLook.x, 1.0, lit);
    float shin = max(uLook.z, 1.0);
    vec3 H = normalize(uLight + vec3(0.0, 0.0, 1.0));
    // Bevel lines glint where they face the light, so the glints travel round
    // the ring as it turns and follow the pointer.
    float glint = pow(max(dot(N, H), 0.0), 6.0);
    col += uHot * uLook.y * pow(max(bev, 0.0), 1.0 + shin * 0.05) * (0.35 + 0.75 * glint);
    col += uHot * uLook.y * 0.04 * pow(max(dot(N, H), 0.0), shin);
    // The slabs under the pointer catch the light: their bevels flare and the
    // glass lifts a little.
    col += uHot * uLook.y * vB.w * 0.8 * max(bev, 0.0) * (0.5 + 0.5 * glint);
    col *= 1.0 + 0.15 * vB.w;

    col = clamp(col, 0.0, 1.0);
    if (any(isnan(col))) col = vec3(0.0);
    outColor = vec4(col * cov, cov);
}`

const FX_VS = `#version 300 es
void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

/** Grain and vignette over everything, drawn only when either is on. */
const FX_FS = `#version 300 es
precision highp float;
precision highp int;
uniform vec4 uFx;    // grain, vignette, seed, 0
uniform vec2 uRes;
out vec4 outColor;
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 vd = (frag / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float vig = uFx.y * smoothstep(0.35, 1.0, length(vd) * 1.1);
    // Mean-neutral grain: light and dark specks of equal weight.
    float n = (hash(frag + uFx.z * 13.1) - 0.5) * 2.0 * uFx.x * 0.25;
    float aW = max(n, 0.0);
    float aB = max(-n, 0.0);
    // Premultiplied: black at (vig + aB), white at aW.
    float a = clamp(vig + aB + aW, 0.0, 1.0);
    outColor = vec4(vec3(aW), a);
}`

/* ------------------------------------------------------------------ */
/*  GL helpers                                                         */
/* ------------------------------------------------------------------ */

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type)
    if (!sh) return null
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        console.warn("CorollaGleam shader:", gl.getShaderInfoLog(sh))
        gl.deleteShader(sh)
        return null
    }
    return sh
}

function link(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
    const vs = compile(gl, gl.VERTEX_SHADER, vsSrc)
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc)
    if (!vs || !fs) return null
    const prog = gl.createProgram()
    if (!prog) return null
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
        console.warn("CorollaGleam link:", gl.getProgramInfoLog(prog))
        gl.deleteProgram(prog)
        return null
    }
    return prog
}

const SLAB_UNIFORMS = [
    "uSA[0]", "uSB[0]", "uSC[0]", "uGeo", "uPivot", "uMap", "uPl", "uPl2", "uPl3", "uRes", "uShade", "uGeo2", "uTab",
    "uTabC", "uFilm", "uRing", "uRing2", "uLite", "uHot", "uPink", "uWarm", "uLight", "uLook",
] as const

type SlabUniform = (typeof SLAB_UNIFORMS)[number]

/** Uploads a vec4 only when it changed (doubles, so 0.07 matches itself). */
class U4 {
    private last = new Float64Array(4).fill(NaN)
    constructor(private loc: WebGLUniformLocation | null) {}
    set(gl: WebGL2RenderingContext, a: number, b: number, c: number, d: number) {
        const l = this.last
        if (l[0] === a && l[1] === b && l[2] === c && l[3] === d) return
        l[0] = a
        l[1] = b
        l[2] = c
        l[3] = d
        gl.uniform4f(this.loc, a, b, c, d)
    }
    reset() {
        this.last.fill(NaN)
    }
}

interface SlabProgram {
    prog: WebGLProgram
    U: Record<SlabUniform, WebGLUniformLocation | null>
    u4: Record<"uTabC" | "uFilm" | "uRing" | "uRing2" | "uGeo" | "uGeo2" | "uPl" | "uPl2" | "uLook", U4>
}

function makeSlabProgram(gl: WebGL2RenderingContext, fs: string): SlabProgram | null {
    const prog = link(gl, SLAB_VS, fs)
    if (!prog) return null
    const U = {} as Record<SlabUniform, WebGLUniformLocation | null>
    for (const n of SLAB_UNIFORMS) U[n] = gl.getUniformLocation(prog, n)
    const u = (n: SlabUniform) => new U4(U[n])
    return {
        prog,
        U,
        u4: {
            uTabC: u("uTabC"),
            uFilm: u("uFilm"),
            uRing: u("uRing"),
            uRing2: u("uRing2"),
            uGeo: u("uGeo"),
            uGeo2: u("uGeo2"),
            uPl: u("uPl"),
            uPl2: u("uPl2"),
            uLook: u("uLook"),
        },
    }
}

/* ------------------------------------------------------------------ */
/*  Live state handed to the loop                                      */
/* ------------------------------------------------------------------ */

interface Live {
    background: string
    count: number
    innerRadius: number
    spin: number
    scale: number
    warm: string
    cool: string
    hover: number
    breathe: number
    speed: number
    pl: Placement
    adv: Advanced
}

function clamp(x: number, a: number, b: number) {
    return x < a ? a : x > b ? b : x
}

/** Shallow-compares two Live objects one level deep (Framer re-renders a lot). */
function sameLive(a: Live | null, b: Live): boolean {
    if (!a) return false
    const keys = ["background", "count", "innerRadius", "scale", "warm", "cool", "hover", "breathe", "speed", "spin"] as const
    for (const k of keys) if (a[k] !== b[k]) return false
    for (const k of Object.keys(b.pl) as (keyof Placement)[]) if (a.pl[k] !== b.pl[k]) return false
    for (const k of Object.keys(b.adv) as (keyof Advanced)[]) if (a.adv[k] !== b.adv[k]) return false
    return true
}

/** Critically damped spring toward a target, settling in about `t` seconds. */
interface Spring {
    x: number
    v: number
}

function stepSpring(sp: Spring, target: number, dt: number, t: number) {
    const w = 5.8 / Math.max(t, 1e-3)
    // 4 ms substeps keep it stable at any frame rate.
    let left = dt
    while (left > 1e-6) {
        const h = Math.min(left, 0.004)
        const a = w * w * (target - sp.x) - 2 * w * sp.v
        sp.v += a * h
        sp.x += sp.v * h
        left -= h
    }
    if (Math.abs(target - sp.x) < 1e-4 && Math.abs(sp.v) < 1e-3) {
        sp.x = target
        sp.v = 0
    }
}

const QUALITY = [1, 0.85, 0.72, 0.6]
/** Pixel budget for the drawing buffer (a 1200×800 frame at 2× fits whole). */
const MAX_PIXELS = 4.2e6

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function CorollaGleam({
    background = DEFAULTS.background,
    count = DEFAULTS.count,
    innerRadius = DEFAULTS.innerRadius,
    scale = DEFAULTS.scale,
    warm = DEFAULTS.warm,
    cool = DEFAULTS.cool,
    placement,
    hover = DEFAULTS.hover,
    breathe = DEFAULTS.breathe,
    speed = DEFAULTS.speed,
    spin = DEFAULTS.spin,
    advanced,
    style,
}: CorollaGleamProps) {
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const liveRef = useRef<Live | null>(null)
    const wakeRef = useRef<() => void>(() => {})

    const next: Live = {
        background,
        count,
        innerRadius,
        scale,
        warm,
        cool,
        hover,
        breathe,
        speed,
        spin,
        pl: { ...DEFAULT_PLACEMENT, ...(placement ?? {}) },
        adv: { ...DEFAULT_ADVANCED, ...(advanced ?? {}) },
    }
    if (!sameLive(liveRef.current, next)) {
        liveRef.current = next
        wakeRef.current()
    }

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return

        let gl: WebGL2RenderingContext | null = null
        let colorP: SlabProgram | null = null
        let fxProg: WebGLProgram | null = null
        let vao: WebGLVertexArrayObject | null = null
        let palTex: WebGLTexture | null = null
        let FXU: { uFx: WebGLUniformLocation | null; uRes: WebGLUniformLocation | null } | null = null
        let timerExt: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null
        const queries: WebGLQuery[] = []
        let lost = false

        const tabBytes = new Uint8Array(TAB_W * TAB_ROWS * 4 * 4)
        let palKey = ""
        const sa = new Float32Array(MAX_BLADES * 4)
        const sb = new Float32Array(MAX_BLADES * 4)
        const scc = new Float32Array(MAX_BLADES * 4)
        // unsorted per-slab values, then their back-to-front order
        const ta = new Float32Array(MAX_BLADES * 4)
        const tb4 = new Float32Array(MAX_BLADES * 4)
        const tc = new Float32Array(MAX_BLADES * 4)
        const order = new Uint8Array(MAX_BLADES)
        const front = new Float32Array(MAX_BLADES)

        const init = (): boolean => {
            gl = canvas.getContext("webgl2", {
                alpha: true,
                premultipliedAlpha: true,
                antialias: false,
                depth: false,
                stencil: false,
                preserveDrawingBuffer: false,
                powerPreference: "low-power",
            })
            if (!gl) return false
            colorP = makeSlabProgram(gl, SLAB_FS)
            fxProg = link(gl, FX_VS, FX_FS)
            if (!colorP) return false
            vao = gl.createVertexArray()
            palTex = gl.createTexture()
            gl.bindTexture(gl.TEXTURE_2D, palTex)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TAB_W, TAB_ROWS * 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
            palKey = ""
            if (fxProg) FXU = { uFx: gl.getUniformLocation(fxProg, "uFx"), uRes: gl.getUniformLocation(fxProg, "uRes") }
            timerExt = gl.getExtension("EXT_disjoint_timer_query_webgl2") as typeof timerExt
            queries.length = 0
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
            return true
        }

        /* ---------------- sizing ---------------- */

        let cssW = Math.max(1, root.clientWidth)
        let cssH = Math.max(1, root.clientHeight)
        let shown = 1 // on-screen scale of the layout box (Framer zoom, CSS transforms)
        let qLevel = 0
        let wantW = 0
        let wantH = 0

        const measureShown = (r: DOMRect) => {
            if (cssW <= 0) return
            const sNew = r.width / cssW
            if (!isFinite(sNew) || sNew <= 0) return
            // 5 % hysteresis: Framer jitters the reported scale.
            if (Math.abs(sNew - shown) / shown > 0.05) {
                shown = sNew
                requestSize()
            }
        }

        const requestSize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            // Never fewer pixels than the layout box; zoomed in, up to 2× sharper.
            let k = dpr * clamp(shown, 1, 2) * QUALITY[qLevel]
            const px = cssW * cssH * k * k
            if (px > MAX_PIXELS) k *= Math.sqrt(MAX_PIXELS / px)
            wantW = Math.max(1, Math.round(cssW * k))
            wantH = Math.max(1, Math.round(cssH * k))
            dirty = true
            wake()
        }

        /** Applied right before a draw, so a wiped buffer is never shown. */
        const applySize = () => {
            if (canvas.width !== wantW || canvas.height !== wantH) {
                canvas.width = wantW
                canvas.height = wantH
            }
        }

        const ro = new ResizeObserver((entries) => {
            for (const e of entries) {
                const cr = e.contentRect
                cssW = Math.max(1, cr.width)
                cssH = Math.max(1, cr.height)
            }
            measureShown(root.getBoundingClientRect())
            requestSize()
        })
        ro.observe(root)

        /* ---------------- visibility ---------------- */

        let onScreen = true
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                onScreen = e.isIntersecting
                if (onScreen) {
                    measureShown(e.boundingClientRect)
                    wake()
                }
            }
        })
        io.observe(root)
        const onVis = () => {
            if (!document.hidden) wake()
        }
        document.addEventListener("visibilitychange", onVis)

        const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
        const onMq = () => wake()
        mq?.addEventListener?.("change", onMq)

        /* ---------------- pointer ---------------- */

        const ptr = { cx: 0, cy: 0, moved: false, over: false, down: false, u: 0.5, v: 0.5 }
        let scrolled = false
        const onMove = (e: PointerEvent) => {
            if (e.clientX === ptr.cx && e.clientY === ptr.cy && ptr.over) return
            ptr.cx = e.clientX
            ptr.cy = e.clientY
            ptr.moved = true
            ptr.over = true
            wake()
        }
        const onLeave = () => {
            ptr.over = false
            ptr.down = false
            wake()
        }
        const onDown = (e: PointerEvent) => {
            ptr.down = true
            onMove(e)
        }
        const onUp = (e: PointerEvent) => {
            ptr.down = false
            // Lifting a finger ends the hover too.
            if (e.pointerType === "touch") ptr.over = false
            wake()
        }
        const onScroll = () => {
            if (ptr.over) {
                scrolled = true
                wake()
            }
        }
        root.addEventListener("pointermove", onMove)
        root.addEventListener("pointerenter", onMove)
        root.addEventListener("pointerleave", onLeave)
        root.addEventListener("pointerdown", onDown)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)
        window.addEventListener("scroll", onScroll, { passive: true, capture: true })

        /* ---------------- context loss ---------------- */

        const onLost = (e: Event) => {
            e.preventDefault()
            lost = true
            stop()
        }
        const onRestored = () => {
            lost = false
            if (init()) {
                requestSize()
                wake()
            }
        }
        canvas.addEventListener("webglcontextlost", onLost)
        canvas.addEventListener("webglcontextrestored", onRestored)

        /* ---------------- loop state ---------------- */

        let raf = 0
        let running = false
        let dirty = true
        let lastTick = -1
        let lastDraw = -1
        let clock = 0 // animation seconds (speed-scaled)
        let frames = 0
        const gaps = new Float32Array(15)
        let gapN = 0
        let cadence = 16.7
        let divisor = 1
        // pointer springs (0..1 shares / -1..1)
        const spX: Spring = { x: 0, v: 0 }
        const spOver: Spring = { x: 0, v: 0 }
        const spDown: Spring = { x: 0, v: 0 }
        const spY: Spring = { x: 0, v: 0 }
        // where the bloom sits (0..1 shares of the frame), held when the pointer leaves
        const spPu: Spring = { x: 0.5, v: 0 }
        const spPv: Spring = { x: 0.5, v: 0 }
        let tX = 0
        let tY = 0
        let spinDeg = 0
        // quality ladder
        const gpuMs: number[] = []
        const drawGaps: number[] = []
        const banUntil = [0, 0, 0, 0]
        const banLen = [0, 0, 0, 0]
        let goodSince = -1
        let probe: { from: number; to: number; at: number; before: number } | null = null
        let seed = 0

        const wake = () => {
            if (running || lost) return
            running = true
            lastTick = -1
            raf = requestAnimationFrame(loop)
        }
        const stop = () => {
            running = false
            if (raf) cancelAnimationFrame(raf)
            raf = 0
        }
        wakeRef.current = wake

        const median = (arr: ArrayLike<number>, n: number) => {
            const t = Array.prototype.slice.call(arr, 0, n).sort((a: number, b: number) => a - b)
            return t.length ? t[t.length >> 1] : 16.7
        }

        const setLevel = (lv: number, now: number) => {
            if (lv === qLevel) return
            qLevel = lv
            goodSince = now
            gpuMs.length = 0
            drawGaps.length = 0
            requestSize()
        }

        /**
         * Resolution ladder. Judged against 60 fps rather than the measured
         * tick rate (a struggling GPU slows the ticks themselves), and every
         * change is a probe: a step down stays only if frames then come
         * faster, a step up only if they don't slow. A failed probe bans that
         * level, longer each time, so a host that ticks at 30 Hz (Framer's
         * canvas) never ping-pongs and never sits blurred for nothing.
         */
        const ladder = (now: number) => {
            if (frames < 30 || drawGaps.length < 24) return
            const m = median(drawGaps, drawGaps.length)
            const g = gpuMs.length >= 6 ? median(gpuMs, gpuMs.length) : -1
            drawGaps.length = 0
            gpuMs.length = 0
            const gpuSlow = g > 0.8 * 16.7
            if (probe) {
                if (now - probe.at < 1500) return
                const down = probe.to > probe.from
                const failed = down ? m > probe.before * 0.87 && !gpuSlow : m > probe.before * 1.13 || gpuSlow
                if (failed) {
                    banLen[probe.to] = Math.min(Math.max(banLen[probe.to] * 2, 30000), 240000)
                    banUntil[probe.to] = now + banLen[probe.to]
                    const back = probe.from
                    probe = null
                    setLevel(back, now)
                } else probe = null
                return
            }
            if ((m > 20 || gpuSlow) && qLevel < QUALITY.length - 1 && now > banUntil[qLevel + 1]) {
                probe = { from: qLevel, to: qLevel + 1, at: now, before: m }
                setLevel(qLevel + 1, now)
                goodSince = -1
                return
            }
            const r = qLevel > 0 ? QUALITY[qLevel - 1] / QUALITY[qLevel] : 1
            const roomy = m <= 18.5 && (g < 0 || g * r * r < 0.55 * 16.7)
            if (qLevel > 0 && roomy) {
                if (goodSince < 0) goodSince = now
                if (now - goodSince > 4000 && now > banUntil[qLevel - 1]) {
                    probe = { from: qLevel, to: qLevel - 1, at: now, before: m }
                    setLevel(qLevel - 1, now)
                }
            } else goodSince = -1
        }

        const pollTimers = () => {
            if (!gl || !timerExt) return
            for (let i = queries.length - 1; i >= 0; i--) {
                const q = queries[i]
                if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
                    if (!gl.getParameter(timerExt.GPU_DISJOINT_EXT)) gpuMs.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6)
                    gl.deleteQuery(q)
                    queries.splice(i, 1)
                }
            }
        }

        /* ---------------- the frame ---------------- */

        const loop = (now: number) => {
            raf = 0
            if (!running) return
            if (lost || !gl || document.hidden || !onScreen) {
                running = false
                return
            }
            raf = requestAnimationFrame(loop)

            // Display cadence from the median of recent tick gaps.
            if (lastTick >= 0) {
                const gap = now - lastTick
                if (gap > 0 && gap < 100) {
                    gaps[gapN % gaps.length] = gap
                    gapN++
                }
            }
            lastTick = now
            if (gapN >= 5) cadence = median(gaps, Math.min(gapN, gaps.length))
            // Draw every Nth vsync for ~60 fps; change N only past a margin.
            const x = 16.7 / cadence
            if (x < divisor - 0.1 || x >= divisor + 1.1) divisor = Math.max(1, Math.floor(x + 0.1))

            const live = liveRef.current
            if (!live) return
            const reduced = !!(mq && mq.matches)
            const animating = !reduced && live.speed > 0 && (live.breathe > 0 || live.spin !== 0 || live.adv.lightTravel > 0)
            const springsBusy =
                spX.v !== 0 || spY.v !== 0 || spOver.v !== 0 || spDown.v !== 0 ||
                spX.x !== (ptr.over ? tX : 0) || spY.x !== (ptr.over ? tY : 0) ||
                spOver.x !== (ptr.over ? 1 : 0) || spDown.x !== (ptr.down ? 1 : 0) ||
                spPu.v !== 0 || spPv.v !== 0 || (ptr.over && (spPu.x !== ptr.u || spPv.x !== ptr.v))

            if (!animating && !springsBusy && !dirty && !ptr.moved && !scrolled) {
                running = false
                return
            }
            if (lastDraw >= 0 && now - lastDraw < (divisor - 0.5) * cadence) return

            const dt = lastDraw < 0 ? 0 : Math.min((now - lastDraw) / 1000, 0.1)
            if (lastDraw >= 0 && now - lastDraw < 250) {
                drawGaps.push(now - lastDraw)
                if (drawGaps.length > 60) drawGaps.shift()
            }
            lastDraw = now
            frames++

            const adv = live.adv
            const hov = reduced ? 0 : Math.max(0, live.hover) / 50

            // Pointer → stage, read once per frame and only when it moved.
            if ((ptr.moved || scrolled) && ptr.over) {
                const r = root.getBoundingClientRect()
                measureShown(r)
                ptr.u = (ptr.cx - r.left) / Math.max(r.width, 1)
                ptr.v = (ptr.cy - r.top) / Math.max(r.height, 1)
            }
            ptr.moved = false
            scrolled = false

            const bw = Math.max(1, wantW || canvas.width)
            const bh = Math.max(1, wantH || canvas.height)
            // The ring is an object: contain its own square bounds (not the
            // whole 3:2 reference frame) and centre it, so a square or a phone
            // frame shows it as large as fits, never cropped.
            const Sbuf = Math.min(bh, bw / CONTENT_ASPECT)
            const stageU = Sbuf / STAGE_H
            const originX = bw / 2
            const originY = (bh - Sbuf) / 2
            const pl = live.pl
            const ang = (clamp(pl.angle, -180, 180) * Math.PI) / 180
            const ca = Math.cos(ang)
            const sA = Math.sin(ang)
            const offX = (clamp(pl.x, -200, 200) / 100) * bw
            const offY = (-clamp(pl.y, -200, 200) / 100) * bh
            const persp = 3 * Sbuf
            const cenX = originX
            const cenY = originY + adv.pivotY * stageU

            if (ptr.over) {
                tX = clamp((ptr.u - 0.5) * 2, -1, 1)
                tY = clamp((ptr.v - 0.5) * 2, -1, 1)
            }
            // Entering from cold, the bloom starts where the pointer is rather
            // than sweeping in from wherever it last was.
            if (ptr.over && spOver.x < 0.02) {
                spPu.x = ptr.u
                spPu.v = 0
                spPv.x = ptr.v
                spPv.v = 0
            }
            if (ptr.over) {
                stepSpring(spPu, ptr.u, dt, 0.22)
                stepSpring(spPv, ptr.v, dt, 0.22)
            }
            stepSpring(spX, ptr.over ? tX : 0, dt, 0.14)
            stepSpring(spY, ptr.over ? tY : 0, dt, 0.14)
            stepSpring(spOver, ptr.over ? 1 : 0, dt, 0.12)
            stepSpring(spDown, ptr.down ? 1 : 0, dt, 0.12)
            const pAmt = spOver.x * hov
            // A slight lean toward the pointer; the bloom below carries the response.
            const tilt = ((clamp(pl.tilt, -60, 60) - 2.5 * spY.x * hov) * Math.PI) / 180
            const yaw = (3 * spX.x * hov * Math.PI) / 180
            const cT = Math.cos(tilt)
            const sT = Math.sin(tilt)

            // Clock: elapsed time, so any refresh rate runs the same speed.
            const tempo = Math.max(0, live.speed) / 50
            if (animating) {
                clock += dt * tempo
                // Spin 1 = 3°/s at Speed 50.
                spinDeg = (spinDeg + clamp(live.spin, -10, 10) * 3 * dt * tempo) % 360
            }
            const cycle = Math.max(0.2, adv.cycleMs / 1000)
            const stag = adv.staggerMs / 1000
            const phase = animating || clock > 0 ? (((clock / cycle) % 1) + 1) % 1 : 0
            // Breathe 50 swells each slab outward by 4 % of its length and turns
            // it a few degrees, as a wave that runs round the ring.
            const amp = (Math.max(0, live.breathe) / 50) * 0.04

            let n = Math.round(live.count)
            n = clamp(n, 3, MAX_BLADES)
            if (n % 2 === 0) n -= 1
            const gain = Math.max(0, adv.twistGain) / 100
            const R = Math.max(2, adv.bladeWidth) / 2
            const L = Math.max(2 * R + 2, adv.bladeLength)
            const T = Math.max(1, Math.min(adv.thickness, R))
            const B = T / 2
            const DEG = Math.PI / 180
            // Inner Radius is a share of the ring's radius; the ring itself is
            // fitted to the frame (Scale 100 % fills ~94 % of its height).
            const kIn = clamp(live.innerRadius, 0, 85) / 100
            const r0 = (kIn / (1 - kIn)) * L
            const ringR = r0 + L
            const ringU = stageU * (clamp(live.scale, 1, 400) / 100) * (RING_FIT / ringR)
            // Fan Angle 180 closes the fan into a ring (no doubled slab at the
            // bottom); below 160 it is the still's fan, slabs spread ±Fan Angle.
            const F = clamp(adv.fanAngle, 1, 180)
            const wRing = clamp((F - 160) / 20, 0, 1)
            const wr = wRing * wRing * (3 - 2 * wRing)
            const rot = spinDeg + adv.sway * spX.x * pAmt

            // The bloom: slabs near the pointer's angle round the ring turn
            // toward face-on, slide out along their length and catch the light,
            // and their neighbours part round it, like petals following a
            // finger. Where the pointer sits, in the slabs' own frame.
            const stepDeg = (n > 1 ? (2 * F) / (n - 1) : 30) * (1 - wr) + (360 / n) * wr
            const sig = 1.6 * stepDeg
            let pTh = 0
            let bloom = 0
            if (pAmt > 1e-4) {
                const rx = spPu.x * bw - (cenX + offX)
                const ry = (1 - spPv.x) * bh - (cenY + offY)
                const lx0 = ca * rx - sA * ry
                const ly0 = (sA * rx + ca * ry) / Math.max(cT, 0.2)
                pTh = (Math.atan2(lx0, ly0) * 180) / Math.PI
                const pr = Math.hypot(lx0, ly0) / Math.max(ringU, 1e-6)
                // fades out in the hole and well past the tips
                const inW = clamp(pr / Math.max(r0 + 0.25 * L, 1e-3), 0, 1)
                const outW = 1 - clamp((pr - (r0 + L)) / (0.8 * L), 0, 1)
                bloom = pAmt * inW * inW * (3 - 2 * inW) * outW * outW * (3 - 2 * outW)
            }

            for (let i = 0; i < n; i++) {
                const fanA = n > 1 ? -F + (i * 2 * F) / (n - 1) : 0
                const ringA = -180 + ((i + 0.5) * 360) / n
                let th = fanA + (ringA - fanA) * wr + rot
                th = ((((th + 180) % 360) + 360) % 360) - 180
                let f = 0
                if (bloom > 1e-4) {
                    let d = th - pTh
                    d = ((((d + 180) % 360) + 360) % 360) - 180
                    const z = d / sig
                    const gz = Math.exp(-z * z)
                    f = bloom * gz
                    // the neighbours part round the pointer
                    th += 1.2 * stepDeg * Math.min(bloom, 1.5) * z * gz
                    th = ((((th + 180) % 360) + 360) % 360) - 180
                }
                // Extra twist fades out at the top and bottom, where a slab's
                // face changes sides, so a bloomed slab passing them never pops.
                const edge = clamp(Math.abs(Math.sin(th * DEG)) / 0.22, 0, 1)
                const openW = edge * edge * (3 - 2 * edge)
                const e = animating || clock > 0 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * (clock - i * stag)) / cycle) : 0
                // Twist follows the angle from the nearer of top and bottom,
                // easing off toward 90° (the still's own law), smoothly folded
                // at the sides so a slab passing them never jerks.
                const x = Math.abs(th)
                let y = x <= 90 ? x : 180 - x
                if (y > FOLD_A) y = FOLD_A + (y - FOLD_A) - ((y - FOLD_A) * (y - FOLD_A)) / (2 * (90 - FOLD_A))
                const twist = clamp(
                    90 * (1 - Math.exp((-gain * y) / 90)) - adv.wobble * e + (30 * f + 12 * spDown.x * hov) * openW,
                    0,
                    89
                )
                const thr = th * DEG
                const tb = twist * DEG
                const st = Math.sin(tb)
                const ct = Math.cos(tb)
                const sx = Math.sin(thr)
                const o = i * 4
                order[i] = i
                front[i] = Math.cos(thr)
                ta[o] = sx
                ta[o + 1] = Math.cos(thr)
                ta[o + 2] = st
                ta[o + 3] = ct
                // The face shows on the side toward the nearer of top and bottom.
                tb4[o] = sx >= 0 ? 1 : -1
                tb4[o + 1] = R * st + B * ct
                const fsd = clamp(sx / 0.05, -1, 1) * 0.5 + 0.5
                tb4[o + 2] = fsd * fsd * (3 - 2 * fsd)
                tb4[o + 3] = Math.min(f, 1.5) + 0.25 * spDown.x * hov
                tc[o] = (amp * e + 0.06 * f + 0.035 * spDown.x * hov) * L
                tc[o + 1] = 0
                tc[o + 2] = 0
                tc[o + 3] = 0
            }
            // Back to front: the top of the ring sits in front, the bottom behind
            // (each slab's face shows toward its neighbour nearer the top).
            const ord = order.subarray(0, n)
            ord.sort((a, b) => front[a] - front[b])
            for (let k = 0; k < n; k++) {
                const i = ord[k]
                for (let c = 0; c < 4; c++) {
                    sa[k * 4 + c] = ta[i * 4 + c]
                    sb[k * 4 + c] = tb4[i * 4 + c]
                    scc[k * 4 + c] = tc[i * 4 + c]
                }
            }
            const idx = n

            // Light: circles once per cycle and leans toward the pointer.
            const travel = Math.max(0, adv.lightTravel) / 100
            const phi = phase * Math.PI * 2
            let lx = -0.45 * travel * Math.cos(phi) + spX.x * 0.5 * pAmt
            let ly = 0.75 + 0.1 * travel * Math.sin(phi) - spY.x * 0.3 * pAmt
            let lz = 0.6
            const ll = Math.hypot(lx, ly, lz) || 1
            lx /= ll
            ly /= ll
            lz /= ll

            // Palette: rebaked only when a colour changes.
            const key = [live.warm, live.cool, adv.pinkColor, adv.deepColor, adv.lightColor, adv.tealColor, adv.hotColor, adv.teal].join("|")
            const palette: Palette = {
                warm: parseColor(live.warm, DEFAULTS.warm),
                cool: parseColor(live.cool, DEFAULTS.cool),
                pink: parseColor(adv.pinkColor, DEFAULT_ADVANCED.pinkColor),
                deep: parseColor(adv.deepColor, DEFAULT_ADVANCED.deepColor),
                lite: parseColor(adv.lightColor, DEFAULT_ADVANCED.lightColor),
                // Teal Amount 60 is the still; lower fades the teal toward deep blue-violet.
                teal: mixRGB(
                    mixRGB(parseColor(live.cool, DEFAULTS.cool), parseColor(adv.deepColor, DEFAULT_ADVANCED.deepColor), 0.5),
                    parseColor(adv.tealColor, DEFAULT_ADVANCED.tealColor),
                    clamp(adv.teal / 60, 0, 1.6)
                ).map((v) => clamp(v, 0, 1)) as RGB,
                hot: parseColor(adv.hotColor, DEFAULT_ADVANCED.hotColor),
            }

            const g = gl
            const cp = colorP
            if (!g || !cp) return
            applySize()
            pollTimers()
            let q: WebGLQuery | null = null
            if (timerExt && queries.length < 4) {
                q = g.createQuery()
                if (q) g.beginQuery(timerExt.TIME_ELAPSED_EXT, q)
            }

            g.viewport(0, 0, canvas.width, canvas.height)
            g.clearColor(0, 0, 0, 0)
            g.clear(g.COLOR_BUFFER_BIT)
            g.bindVertexArray(vao)

            const geom = (P: SlabProgram) => {
                g.useProgram(P.prog)
                g.uniform4fv(P.U["uSA[0]"], sa.subarray(0, idx * 4))
                g.uniform4fv(P.U["uSB[0]"], sb.subarray(0, idx * 4))
                g.uniform4fv(P.U["uSC[0]"], scc.subarray(0, idx * 4))
                P.u4.uGeo.set(g, R, L, T, r0)
                g.uniform2f(P.U.uPivot, 0, adv.pivotY)
                g.uniform4f(P.U.uMap, originX, originY, stageU, ringU)
                P.u4.uPl.set(g, cenX, cenY, offX, offY)
                P.u4.uPl2.set(g, ca, sA, cT, sT)
                g.uniform4f(P.U.uPl3, Math.cos(yaw), Math.sin(yaw), 0, 0)
                g.uniform3f(P.U.uRes, canvas.width, canvas.height, persp)
                g.uniform2f(P.U.uShade, clamp(adv.contact, 0, 100) / 100, CONTACT_W)
                P.u4.uGeo2.set(g, Math.max(0, adv.bevel), Math.max(0, adv.tailLength) / L, phase, reduced ? 0 : travel)
            }

            // Back to front with premultiplied blending: the edges stay soft.
            geom(cp)
            g.enable(g.BLEND)
            g.activeTexture(g.TEXTURE0)
            g.bindTexture(g.TEXTURE_2D, palTex)
            if (key !== palKey) {
                bakeTables(palette, tabBytes)
                g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, TAB_W, TAB_ROWS * 4, g.RGBA, g.UNSIGNED_BYTE, tabBytes)
                palKey = key
            }
            const U = cp.U
            g.uniform1i(U.uTab, 0)
            cp.u4.uTabC.set(g, FACE_C[0], FACE_C[FACE_C.length - 1], WALL_C[0], WALL_C[WALL_C.length - 1])
            cp.u4.uFilm.set(g, adv.filmShift / 30, ((adv.rimFilm - 50) / 100) * 0.25, adv.rimTop / 100, 0.03 * spX.x * pAmt)
            cp.u4.uRing.set(g, RING.S, RING.SIG, RING.AMOUNT * (adv.sheen / 25), RING.HUE0)
            cp.u4.uRing2.set(g, RING.HUE1, RING.LIFT, RING.C, 0)
            g.uniform3fv(U.uLite, palette.lite)
            g.uniform3fv(U.uHot, palette.hot)
            g.uniform3fv(U.uPink, palette.pink)
            g.uniform3fv(U.uWarm, palette.warm)
            g.uniform3f(U.uLight, lx, ly, lz)
            cp.u4.uLook.set(g, adv.shadow / 100, adv.specular / 100, Math.max(1, adv.shininess), 0)
            g.drawArrays(g.TRIANGLES, 0, idx * 6)

            const grain = Math.max(0, adv.grain) / 100
            const vig = Math.max(0, adv.vignette) / 100
            if ((grain > 0 || vig > 0) && fxProg && FXU) {
                if (animating) seed = Math.floor(clock * 24) % 97
                g.useProgram(fxProg)
                g.uniform4f(FXU.uFx, grain, vig, seed, 0)
                g.uniform2f(FXU.uRes, canvas.width, canvas.height)
                g.drawArrays(g.TRIANGLES, 0, 3)
            }
            if (q && timerExt) {
                g.endQuery(timerExt.TIME_ELAPSED_EXT)
                queries.push(q)
            }
            dirty = false
            ladder(now)
        }

        if (!init()) {
            // No WebGL2: the CSS background stays, nothing throws.
            return () => {
                ro.disconnect()
                io.disconnect()
            }
        }
        requestSize()
        wake()

        return () => {
            stop()
            wakeRef.current = () => {}
            ro.disconnect()
            io.disconnect()
            document.removeEventListener("visibilitychange", onVis)
            mq?.removeEventListener?.("change", onMq)
            root.removeEventListener("pointermove", onMove)
            root.removeEventListener("pointerenter", onMove)
            root.removeEventListener("pointerleave", onLeave)
            root.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            window.removeEventListener("scroll", onScroll, { capture: true })
            canvas.removeEventListener("webglcontextlost", onLost)
            canvas.removeEventListener("webglcontextrestored", onRestored)
            const g = gl
            if (g && !g.isContextLost()) {
                for (const q of queries) g.deleteQuery(q)
                if (colorP) g.deleteProgram(colorP.prog)
                if (fxProg) g.deleteProgram(fxProg)
                if (vao) g.deleteVertexArray(vao)
                if (palTex) g.deleteTexture(palTex)
            }
        }
    }, [])

    return (
        <div
            ref={rootRef}
            style={{
                width: "100%",
                height: "100%",
                aspectRatio: `${REF_W} / ${REF_H}`,
                ...style,
                position: "relative",
                overflow: "hidden",
                background,
                touchAction: "pan-y",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
            />
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Property controls                                                  */
/* ------------------------------------------------------------------ */

// Control order arranged in the builder.
addPropertyControls(CorollaGleam, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: DEFAULTS.background,
        description: "Colour behind the fan and in the gaps between slabs.",
    },
    warm: {
        type: ControlType.Color,
        title: "Warm",
        defaultValue: DEFAULTS.warm,
        description: "Thin-film colour where a slab is seen at a steep angle (inner slabs, rims).",
    },
    cool: {
        type: ControlType.Color,
        title: "Cool",
        defaultValue: DEFAULTS.cool,
        description: "Thin-film colour where a slab faces the viewer (outer slabs).",
    },
    count: {
        type: ControlType.Number,
        title: "Slabs",
        min: 5,
        max: 41,
        step: 2,
        defaultValue: DEFAULTS.count,
        description: "Number of glass slabs round the ring (always odd).",
    },
    innerRadius: {
        type: ControlType.Number,
        title: "Inner Radius",
        min: 0,
        max: 60,
        step: 1,
        unit: "%",
        defaultValue: DEFAULTS.innerRadius,
        description: "The opening in the middle, as a share of the ring's radius. The ring keeps its size; the slabs get shorter.",
    },
    scale: {
        type: ControlType.Number,
        title: "Scale",
        min: 40,
        max: 200,
        step: 1,
        unit: "%",
        defaultValue: DEFAULTS.scale,
        description: "How big the ring draws about its centre. 100 % fills the frame's height.",
    },
    placement: {
        type: ControlType.Object,
        title: "Placement",
        controls: {
            x: {
                type: ControlType.Number,
                title: "X Offset",
                min: -200,
                max: 200,
                step: 0.5,
                unit: "%",
                defaultValue: 0,
                description: "Moves the fan across the frame, as a share of its width. Positive is right.",
            },
            y: {
                type: ControlType.Number,
                title: "Y Offset",
                min: -200,
                max: 200,
                step: 0.5,
                unit: "%",
                defaultValue: 70,
                description: "Moves the fan down the frame, as a share of its height. Positive is down.",
            },
            angle: {
                type: ControlType.Number,
                title: "Angle",
                min: -180,
                max: 180,
                step: 1,
                unit: "°",
                defaultValue: 0,
                description: "Turns the fan about its own centre. Positive is clockwise.",
            },
            tilt: {
                type: ControlType.Number,
                title: "Tilt",
                min: -60,
                max: 60,
                step: 1,
                unit: "°",
                defaultValue: 0,
                description: "Leans the fan about the frame's horizontal axis. Positive tips its top away.",
            },
        },
    },
    hover: {
        type: ControlType.Number,
        title: "Hover",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        defaultValue: DEFAULTS.hover,
        description: "Pointer response: the slabs nearest the pointer turn open, slide out and catch the light, their neighbours part round it; press opens the whole ring. 0 = off.",
    },
    breathe: {
        type: ControlType.Number,
        title: "Breathe",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: DEFAULTS.breathe,
        description: "How far the fan closes and reopens each cycle. 0 holds it open.",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: DEFAULTS.speed,
        description: "Master tempo of the breathing, the drifting film and the spin. 50 = one breath every 6 s, 0 = stopped.",
    },
    spin: {
        type: ControlType.Number,
        title: "Spin",
        min: -10,
        max: 10,
        step: 0.1,
        defaultValue: DEFAULTS.spin,
        description: "How fast the ring turns. Positive is clockwise; 4 ≈ one turn every 30 s at Speed 50. 0 holds it still.",
    },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        description: "Tuning values for matching the reference.",
        controls: {
            bladeWidth: { type: ControlType.Number, title: "Slab Width", min: 60, max: 600, step: 1, unit: "px", defaultValue: 282, description: "Width of each slab at an 800 px tall stage." },
            bladeLength: { type: ControlType.Number, title: "Slab Length", min: 200, max: 1200, step: 1, unit: "px", defaultValue: 600, description: "Inner rounded end to outer tip (the ring is fitted to the frame, so this sets proportion)." },
            thickness: { type: ControlType.Number, title: "Thickness", min: 4, max: 80, step: 1, unit: "px", defaultValue: 26, description: "Glass thickness; sets the rim band width." },
            bevel: { type: ControlType.Number, title: "Bevel", min: 0, max: 20, step: 0.5, unit: "px", defaultValue: 3.5, description: "Radius of the rounded edges that catch the bright lines along each rim." },
            tailLength: { type: ControlType.Number, title: "Tail", min: 0, max: 400, step: 1, unit: "px", defaultValue: 120, description: "Length of each slab's shaded root, toward the inner circle." },
            pivotY: { type: ControlType.Number, title: "Pivot Height", min: -400, max: 400, step: 1, unit: "px", defaultValue: 400, description: "Height of the ring's centre above the bottom of the 800 px stage. 400 centres it." },
            fanAngle: { type: ControlType.Number, title: "Fan Angle", min: 20, max: 180, step: 1, unit: "°", defaultValue: 180, description: "Lean of the outermost slab. 180 closes the fan into a full ring; 74 with 13 slabs is the reference fan." },
            twistGain: { type: ControlType.Number, title: "Twist", min: 0, max: 300, step: 1, unit: "%", defaultValue: 100, description: "How fast slabs turn face-on as they lean out (eases off toward 90°)." },
            pinkColor: { type: ControlType.Color, title: "Pink", defaultValue: "#B51F66", description: "Magenta of the rim film loop." },
            deepColor: { type: ControlType.Color, title: "Deep", defaultValue: "#3300CC", description: "Indigo film colour, between warm and cool (the dark slabs)." },
            lightColor: { type: ControlType.Color, title: "Lavender", defaultValue: "#B0A8EC", description: "Face-on film colour, the light band and the rim tips." },
            tealColor: { type: ControlType.Color, title: "Teal", defaultValue: "#008989", description: "Tint at the base of face-on slabs." },
            hotColor: { type: ControlType.Color, title: "Highlight", defaultValue: "#F6DDA8", description: "Bevel highlights and the palest rim film." },
            filmShift: { type: ControlType.Number, title: "Film Shift", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30, description: "How far the face film shifts along each slab, base to tip." },
            rimFilm: { type: ControlType.Number, title: "Rim Film", min: 0, max: 100, step: 1, unit: "%", defaultValue: 50, description: "Where the rims sit in their film loop. 50 is the reference." },
            rimTop: { type: ControlType.Number, title: "Rim Tip", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Lilac shift of the rim near the tips." },
            teal: { type: ControlType.Number, title: "Teal Amount", min: 0, max: 100, step: 1, unit: "%", defaultValue: 60, description: "Teal at the base of face-on slabs." },
            shadow: { type: ControlType.Number, title: "Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Darkening of faces turned from the circling light." },
            contact: { type: ControlType.Number, title: "Contact Shadow", min: 0, max: 100, step: 1, unit: "%", defaultValue: 45, description: "Soft shadow each slab casts on the ones behind it (and round the ring on a light background)." },
            specular: { type: ControlType.Number, title: "Specular", min: 0, max: 200, step: 1, unit: "%", defaultValue: 70, description: "Strength of the bright bevel lines; they glint where they face the circling light." },
            shininess: { type: ControlType.Number, title: "Shininess", min: 2, max: 400, step: 1, defaultValue: 60, description: "Tightness of the highlights." },
            sheen: { type: ControlType.Number, title: "Sheen", min: 0, max: 100, step: 1, unit: "%", defaultValue: 25, description: "The soft light band crossing every slab (rainbow on the edge-on ones)." },
            grain: { type: ControlType.Number, title: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Film grain over everything." },
            vignette: { type: ControlType.Number, title: "Vignette", min: 0, max: 100, step: 1, unit: "%", defaultValue: 0, description: "Edge darkening." },
            cycleMs: { type: ControlType.Number, title: "Cycle", min: 1000, max: 20000, step: 10, unit: "ms", defaultValue: 6000, description: "One close-and-reopen at Speed 50." },
            staggerMs: { type: ControlType.Number, title: "Stagger", min: 0, max: 600, step: 1, unit: "ms", defaultValue: 80, description: "Delay per slab from the centre outward." },
            wobble: { type: ControlType.Number, title: "Twist Swing", min: 0, max: 30, step: 1, unit: "°", defaultValue: 3, description: "Extra turn about each slab's axis as the fan closes." },
            sway: { type: ControlType.Number, title: "Pointer Sway", min: 0, max: 20, step: 1, unit: "°", defaultValue: 4, description: "How far the ring turns toward the pointer." },
            lightTravel: { type: ControlType.Number, title: "Light Orbit", min: 0, max: 200, step: 1, unit: "%", defaultValue: 100, description: "How far the light circles each cycle, and how far the film drifts with it." },
        },
    },
})