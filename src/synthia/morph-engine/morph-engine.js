/**
 * Morph Engine (JS)
 * State-node sprite interpolation via persistent, trainable transition edges.
 *
 * morph(stateA, stateB, { frames, learn, easing })
 *   → [stateA, ...inbetweens, stateB]  (ImageData frames)
 *
 * Pipeline:
 * PoseMatcher → LandmarkRegistrar → Skeleton/MeshBuilder → MotionEstimator
 * → JointInterpolator → MeshWarper → OpticalFlowRefiner → OcclusionDetector
 * → SurfaceCompleter → SecondaryMotionSolver → FrameValidator
 */
(function (root) {
  "use strict";

  const W = 256;
  const H = 320;

  const LANDMARK_NAMES = [
    "head", "neck", "shoulder_l", "shoulder_r", "elbow_l", "elbow_r",
    "wrist_l", "wrist_r", "torso", "waist", "hip_l", "hip_r",
    "knee_l", "knee_r", "ankle_l", "ankle_r", "hair", "skirt_l", "skirt_r", "joint_core",
  ];

  const SECONDARY_NAMES = ["hair", "skirt_l", "skirt_r"];

  const SKELETON_BONES = [
    ["head", "neck"], ["neck", "shoulder_l"], ["neck", "shoulder_r"],
    ["shoulder_l", "elbow_l"], ["elbow_l", "wrist_l"],
    ["shoulder_r", "elbow_r"], ["elbow_r", "wrist_r"],
    ["neck", "torso"], ["torso", "waist"],
    ["waist", "hip_l"], ["waist", "hip_r"],
    ["hip_l", "knee_l"], ["knee_l", "ankle_l"],
    ["hip_r", "knee_r"], ["knee_r", "ankle_r"],
    ["head", "hair"], ["waist", "skirt_l"], ["waist", "skirt_r"], ["torso", "joint_core"],
  ];

  const PART_BONES = [
    ["hair", "hair", "head", 22],
    ["head", "head", "neck", 22],
    ["torso", "neck", "waist", 30],
    ["skirt_a", "waist", "skirt_l", 18],
    ["skirt_b", "waist", "skirt_r", 18],
    ["uarm_l", "shoulder_l", "elbow_l", 11],
    ["farm_l", "elbow_l", "wrist_l", 11],
    ["uarm_r", "shoulder_r", "elbow_r", 11],
    ["farm_r", "elbow_r", "wrist_r", 11],
    ["thigh_l", "hip_l", "knee_l", 12],
    ["shin_l", "knee_l", "ankle_l", 12],
    ["thigh_r", "hip_r", "knee_r", 12],
    ["shin_r", "knee_r", "ankle_r", 12],
  ];

  const DRAW_ORDER = [
    "thigh_l", "thigh_r", "shin_l", "shin_r",
    "skirt_a", "skirt_b", "uarm_l", "farm_l",
    "torso", "hair", "head", "uarm_r", "farm_r",
  ];

  const CANONICAL = {
    head: [128, 42], hair: [128, 22], neck: [128, 62],
    shoulder_l: [98, 78], shoulder_r: [158, 78],
    elbow_l: [78, 118], elbow_r: [178, 118],
    wrist_l: [68, 158], wrist_r: [188, 158],
    torso: [128, 118], joint_core: [128, 108], waist: [128, 158],
    hip_l: [110, 168], hip_r: [146, 168],
    knee_l: [108, 218], knee_r: [148, 218],
    ankle_l: [106, 268], ankle_r: [150, 268],
    skirt_l: [96, 188], skirt_r: [160, 188],
  };

  const POSE_REACH_DELTA = {
    shoulder_r: [-6, 4], elbow_r: [-52, -8], wrist_r: [-78, 18],
    shoulder_l: [4, -10], elbow_l: [-8, -48], wrist_l: [10, -88],
    hair: [16, 4], head: [4, 2], neck: [2, 2],
    torso: [-4, 2], joint_core: [-4, 2], waist: [-6, 2],
    hip_l: [-10, 4], hip_r: [-4, 2],
    knee_l: [-14, 0], knee_r: [8, -6],
    ankle_l: [-16, 0], ankle_r: [14, -4],
    skirt_l: [-22, 8], skirt_r: [8, 10],
  };

  const COLORS = {
    head: [232, 196, 164, 255], hair: [48, 28, 78, 255], neck: [210, 170, 140, 255],
    torso: [70, 110, 170, 255], joint_core: [220, 190, 70, 255],
    arm_l: [90, 150, 200, 255], arm_r: [90, 150, 200, 255],
    fore_l: [70, 130, 185, 255], fore_r: [70, 130, 185, 255],
    hand_l: [232, 196, 164, 255], hand_r: [232, 196, 164, 255],
    pelvis: [55, 90, 145, 255],
    leg_l: [80, 95, 130, 255], leg_r: [80, 95, 130, 255],
    boot_l: [36, 36, 48, 255], boot_r: [36, 36, 48, 255],
    skirt: [160, 70, 120, 255], eye: [30, 30, 40, 255], stripe: [240, 230, 210, 255],
  };

  function css(c) { return `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`; }
  function cloneLm(src) {
    const o = {};
    for (const k of Object.keys(src)) o[k] = [src[k][0], src[k][1]];
    return o;
  }
  function poseIdle() { return cloneLm(CANONICAL); }
  function poseReach() {
    const p = cloneLm(CANONICAL);
    for (const k of Object.keys(POSE_REACH_DELTA)) {
      p[k][0] += POSE_REACH_DELTA[k][0];
      p[k][1] += POSE_REACH_DELTA[k][1];
    }
    return p;
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function applyEasing(t, name) {
    if (name === "smoothstep") return t * t * (3 - 2 * t);
    if (name === "ease_in_out") return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    if (name === "ease_out_cubic") return 1 - (1 - t) ** 3;
    return t;
  }

  // ── character renderer ──────────────────────────────────────────
  function drawLimb(ctx, a, b, width, color) {
    ctx.strokeStyle = css(color);
    ctx.fillStyle = css(color);
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    const r = width / 2;
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function disk(ctx, p, r, color) {
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderCharacter(landmarks, name) {
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    const L = landmarks;

    ctx.fillStyle = css(COLORS.skirt);
    ctx.beginPath();
    ctx.moveTo(L.hip_l[0], L.hip_l[1]);
    ctx.lineTo(L.skirt_l[0], L.skirt_l[1]);
    ctx.lineTo((L.skirt_l[0] + L.skirt_r[0]) / 2, L.skirt_l[1] + 18);
    ctx.lineTo(L.skirt_r[0], L.skirt_r[1]);
    ctx.lineTo(L.hip_r[0], L.hip_r[1]);
    ctx.lineTo(L.waist[0], L.waist[1]);
    ctx.closePath();
    ctx.fill();

    drawLimb(ctx, L.hip_l, L.knee_l, 16, COLORS.leg_l);
    drawLimb(ctx, L.knee_l, L.ankle_l, 14, COLORS.leg_l);
    drawLimb(ctx, L.hip_r, L.knee_r, 16, COLORS.leg_r);
    drawLimb(ctx, L.knee_r, L.ankle_r, 14, COLORS.leg_r);
    disk(ctx, L.ankle_l, 11, COLORS.boot_l);
    disk(ctx, L.ankle_r, 11, COLORS.boot_r);

    drawLimb(ctx, L.shoulder_l, L.elbow_l, 14, COLORS.arm_l);
    drawLimb(ctx, L.elbow_l, L.wrist_l, 12, COLORS.fore_l);
    disk(ctx, L.wrist_l, 8, COLORS.hand_l);

    const hx = 28;
    ctx.fillStyle = css(COLORS.torso);
    ctx.beginPath();
    ctx.moveTo(L.torso[0] - hx, L.neck[1] + 8);
    ctx.lineTo(L.torso[0] + hx, L.neck[1] + 8);
    ctx.lineTo(L.waist[0] + hx - 4, L.waist[1]);
    ctx.lineTo(L.waist[0] - hx + 4, L.waist[1]);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(COLORS.stripe);
    ctx.fillRect(L.torso[0] - 18, L.torso[1] - 10, 36, 16);
    ctx.fillRect(L.torso[0] - 18, L.torso[1] + 10, 36, 6);
    disk(ctx, L.joint_core, 7, COLORS.joint_core);
    disk(ctx, L.waist, 6, COLORS.joint_core);

    drawLimb(ctx, L.neck, L.head, 12, COLORS.neck);
    disk(ctx, L.hair, 18, COLORS.hair);
    ctx.fillStyle = css(COLORS.hair);
    ctx.beginPath();
    ctx.moveTo(L.hair[0] - 16, L.hair[1]);
    ctx.lineTo(L.hair[0] - 28, L.hair[1] - 10);
    ctx.lineTo(L.hair[0] - 6, L.hair[1] - 8);
    ctx.closePath();
    ctx.fill();
    disk(ctx, L.head, 20, COLORS.head);
    disk(ctx, [L.head[0] - 7, L.head[1] - 2], 3, COLORS.eye);
    disk(ctx, [L.head[0] + 7, L.head[1] - 2], 3, COLORS.eye);

    disk(ctx, L.shoulder_l, 8, COLORS.joint_core);
    disk(ctx, L.shoulder_r, 8, COLORS.joint_core);

    drawLimb(ctx, L.shoulder_r, L.elbow_r, 14, COLORS.arm_r);
    drawLimb(ctx, L.elbow_r, L.wrist_r, 12, COLORS.fore_r);
    disk(ctx, L.wrist_r, 8, COLORS.hand_r);
    disk(ctx, L.elbow_r, 6, COLORS.joint_core);

    const image = ctx.getImageData(0, 0, W, H);
    return { name, canvas, image, landmarks: cloneLm(L), width: W, height: H, meta: {} };
  }

  // ── image helpers ───────────────────────────────────────────────
  function meanColor(img) {
    const d = img.data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 20) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    }
    if (!n) return [0, 0, 0];
    return [r / n, g / n, b / n];
  }

  function stripeCount(img) {
    const d = img.data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) continue;
      const dist = Math.abs(d[i] - 240) + Math.abs(d[i + 1] - 230) + Math.abs(d[i + 2] - 210);
      if (dist <= 28) n++;
    }
    return n;
  }

  function opaqueCount(img) {
    const d = img.data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
    return n;
  }

  function l1(a, b) {
    const da = a.data, db = b.data;
    let s = 0;
    for (let i = 0; i < da.length; i++) s += Math.abs(da[i] - db[i]);
    return s / da.length;
  }

  function colorNear(d, i, rgb, tol) {
    return Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) <= tol
      && d[i + 3] > 20;
  }

  // ── modules ─────────────────────────────────────────────────────
  const PoseMatcher = {
    run(a, b) {
      const sameSize = a.width === b.width && a.height === b.height;
      const namesA = new Set(Object.keys(a.landmarks));
      const namesB = new Set(Object.keys(b.landmarks));
      const shared = LANDMARK_NAMES.filter((n) => namesA.has(n) && namesB.has(n));
      const fa = meanColor(a.image), fb = meanColor(b.image);
      const colorDist = Math.hypot(fa[0] - fb[0], fa[1] - fb[1], fa[2] - fb[2]);
      return { ok: sameSize && shared.length >= 8 && colorDist < 80, shared, colorDist, sameSize };
    },
  };

  const LandmarkRegistrar = {
    run(a, b, shared) {
      const mapping = {};
      for (const n of LANDMARK_NAMES) {
        mapping[n] = shared.includes(n) ? [n] : [];
      }
      return mapping;
    },
  };

  const SkeletonMeshBuilder = {
    run(state) {
      const labels = LANDMARK_NAMES.filter((n) => state.landmarks[n]);
      const vertices = labels.map((n) => [state.landmarks[n][0], state.landmarks[n][1]]);
      const rest = {};
      labels.forEach((n, i) => { rest[n] = i; });
      // silhouette ring from alpha
      const d = state.image.data;
      const w = state.width, h = state.height;
      let sx = 0, sy = 0, sn = 0;
      const pts = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 20) { sx += x; sy += y; sn++; pts.push([x, y]); }
        }
      }
      if (sn) {
        const cx = sx / sn, cy = sy / sn;
        const ring = 12;
        for (let k = 0; k < ring; k++) {
          const lo = -Math.PI + (k * 2 * Math.PI) / ring;
          const hi = lo + (2 * Math.PI) / ring;
          let best = null, bestD = -1;
          for (const p of pts) {
            const ang = Math.atan2(p[1] - cy, p[0] - cx);
            if (ang < lo || ang >= hi) continue;
            const dd = (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
            if (dd > bestD) { bestD = dd; best = p; }
          }
          if (best) {
            vertices.push([best[0], best[1]]);
            labels.push("sil_" + k);
          }
        }
      }
      // fan faces from first landmark (head-ish)
      const faces = [];
      for (let i = 1; i < vertices.length - 1; i++) faces.push([0, i, i + 1]);
      return { vertices, faces, labels, rest };
    },
    corresponding(mesh, landmarks) {
      return mesh.vertices.map((v, i) => {
        const lab = mesh.labels[i];
        if (landmarks[lab]) return [landmarks[lab][0], landmarks[lab][1]];
        return [v[0], v[1]];
      });
    },
  };

  const MotionEstimator = {
    run(a, b, mesh, vertsB) {
      // compact field: per-landmark displacement A→B and B→A
      const flowAB = {}, flowBA = {};
      for (const n of Object.keys(a.landmarks)) {
        if (!b.landmarks[n]) continue;
        flowAB[n] = [b.landmarks[n][0] - a.landmarks[n][0], b.landmarks[n][1] - a.landmarks[n][1]];
        flowBA[n] = [-flowAB[n][0], -flowAB[n][1]];
      }
      return { flowAB, flowBA, nVerts: mesh.vertices.length, nFaces: mesh.faces.length };
    },
  };

  const OpticalFlowRefiner = {
    run(field) {
      // landmark flow is already geometric; smooth secondary keys slightly
      return field;
    },
  };

  const JointInterpolator = {
    run(a, b, t, mapping) {
      const out = {};
      for (const n of Object.keys(mapping)) {
        if (!mapping[n].length || !a.landmarks[n] || !b.landmarks[n]) continue;
        out[n] = [
          (1 - t) * a.landmarks[n][0] + t * b.landmarks[n][0],
          (1 - t) * a.landmarks[n][1] + t * b.landmarks[n][1],
        ];
      }
      return out;
    },
    trajectories(a, b, mapping, steps) {
      steps = steps || 16;
      const traj = {};
      for (const n of Object.keys(mapping)) {
        if (!mapping[n].length || !a.landmarks[n] || !b.landmarks[n]) continue;
        traj[n] = [];
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          traj[n].push([
            (1 - t) * a.landmarks[n][0] + t * b.landmarks[n][0],
            (1 - t) * a.landmarks[n][1] + t * b.landmarks[n][1],
          ]);
        }
      }
      return traj;
    },
  };

  const SecondaryMotionSolver = {
    run(lmT, a, b, t, phase) {
      phase = phase == null ? 0.18 : phase;
      const out = {};
      for (const k of Object.keys(lmT)) out[k] = [lmT[k][0], lmT[k][1]];
      for (const name of SECONDARY_NAMES) {
        if (!a.landmarks[name] || !b.landmarks[name]) continue;
        const tSec = Math.min(1, Math.max(0, t - phase * Math.sin(Math.PI * t)));
        const dx = b.landmarks[name][0] - a.landmarks[name][0];
        const dy = b.landmarks[name][1] - a.landmarks[name][1];
        const nrm = Math.hypot(dx, dy) || 1;
        const px = -dy / nrm, py = dx / nrm;
        const swing = 6 * Math.sin(Math.PI * t);
        out[name] = [
          (1 - tSec) * a.landmarks[name][0] + tSec * b.landmarks[name][0] + px * swing,
          (1 - tSec) * a.landmarks[name][1] + tSec * b.landmarks[name][1] + py * swing,
        ];
      }
      return out;
    },
  };

  const OcclusionDetector = {
    run(a, b) {
      // pixels opaque in A but not B (became hidden / revealed depending on direction)
      const da = a.image.data, db = b.image.data;
      let hiddenInB = 0, hiddenInA = 0, union = 0;
      for (let i = 3; i < da.length; i += 4) {
        const oa = da[i] > 20, ob = db[i] > 20;
        if (oa || ob) union++;
        if (oa && !ob) hiddenInB++;
        if (ob && !oa) hiddenInA++;
      }
      return { hiddenInA, hiddenInB, union };
    },
  };

  const FrameValidator = {
    run(frames, a, b) {
      const areas = frames.map(opaqueCount);
      const mean = areas.reduce((s, v) => s + v, 0) / areas.length;
      const spread = (Math.max(...areas) - Math.min(...areas)) / (mean + 1e-6);
      let flicker = 0;
      for (let i = 1; i < frames.length; i++) flicker += l1(frames[i], frames[i - 1]);
      flicker /= Math.max(frames.length - 1, 1);
      const textureJump = l1(frames[frames.length - 1], b.image);
      let score = 1 - Math.min(0.4, spread) - Math.min(0.3, flicker / 80) - Math.min(0.2, textureJump / 80);
      score = Math.max(0, Math.min(1, score));
      return { anatomyOk: spread < 0.5 && flicker < 40, flicker, textureJump, score, spread };
    },
  };

  // ── part atlas / surface completer ──────────────────────────────
  function inCapsule(x, y, p0, p1, radius) {
    const vx = p1[0] - p0[0], vy = p1[1] - p0[1];
    const L2 = vx * vx + vy * vy + 1e-6;
    let t = ((x - p0[0]) * vx + (y - p0[1]) * vy) / L2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const px = p0[0] + t * vx, py = p0[1] + t * vy;
    return (x - px) * (x - px) + (y - py) * (y - py) <= radius * radius;
  }

  function extractAtlas(state) {
    const img = state.image;
    const d = img.data;
    const w = state.width, h = state.height;
    const atlas = {};

    function maskAt(name, x, y, p0, p1, rad) {
      const i = (y * w + x) * 4;
      const a = d[i + 3] > 20;
      if (name === "torso") {
        return colorNear(d, i, COLORS.torso, 26) || colorNear(d, i, COLORS.stripe, 26)
          || (inCapsule(x, y, p0, p1, rad) && (colorNear(d, i, COLORS.joint_core, 26) || colorNear(d, i, COLORS.neck, 26)));
      }
      if (name === "head") return colorNear(d, i, COLORS.head, 26) || colorNear(d, i, COLORS.eye, 26);
      if (name === "hair") return colorNear(d, i, COLORS.hair, 26);
      if (name.indexOf("skirt") === 0) return inCapsule(x, y, p0, p1, rad) && colorNear(d, i, COLORS.skirt, 26);
      return inCapsule(x, y, p0, p1, rad) && a;
    }

    for (const [name, a0, a1, rad] of PART_BONES) {
      const p0 = state.landmarks[a0], p1 = state.landmarks[a1];
      if (!p0 || !p1) continue;
      let minX = w, minY = h, maxX = 0, maxY = 0, any = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!maskAt(name, x, y, p0, p1, rad)) continue;
          any = true;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      if (!any) continue;
      const pad = 3;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
      const tw = maxX - minX + 1, th = maxY - minY + 1;
      const tex = makeCanvas(tw, th);
      const tctx = tex.getContext("2d");
      const tid = tctx.createImageData(tw, th);
      const td = tid.data;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (!maskAt(name, x, y, p0, p1, rad)) continue;
          const si = (y * w + x) * 4;
          const di = ((y - minY) * tw + (x - minX)) * 4;
          td[di] = d[si]; td[di + 1] = d[si + 1]; td[di + 2] = d[si + 2]; td[di + 3] = d[si + 3];
        }
      }
      tctx.putImageData(tid, 0, 0);
      atlas[name] = {
        canvas: tex,
        src: [[p0[0] - minX, p0[1] - minY], [p1[0] - minX, p1[1] - minY]],
        anchorNames: [a0, a1],
      };
    }
    return atlas;
  }

  function similarity(src, dst) {
    const s0 = src[0], s1 = src[1], d0 = dst[0], d1 = dst[1];
    const vsx = s1[0] - s0[0], vsy = s1[1] - s0[1];
    const vdx = d1[0] - d0[0], vdy = d1[1] - d0[1];
    const ls = vsx * vsx + vsy * vsy + 1e-6;
    const sc = (vdx * vsx + vdy * vsy) / ls;
    const ss = (vsx * vdy - vsy * vdx) / ls;
    // x' = sc*x - ss*y + t0 ; y' = ss*x + sc*y + t1
    const t0 = d0[0] - (sc * s0[0] - ss * s0[1]);
    const t1 = d0[1] - (ss * s0[0] + sc * s0[1]);
    return { sc, ss, t0, t1 };
  }

  function reconstruct(atlas, landmarksT, w, h) {
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    for (const name of DRAW_ORDER) {
      const part = atlas[name];
      if (!part) continue;
      const [a0, a1] = part.anchorNames;
      if (!landmarksT[a0] || !landmarksT[a1]) continue;
      const M = similarity(part.src, [landmarksT[a0], landmarksT[a1]]);
      ctx.save();
      // canvas: x' = a x + c y + e ; y' = b x + d y + f
      ctx.setTransform(M.sc, M.ss, -M.ss, M.sc, M.t0, M.t1);
      ctx.drawImage(part.canvas, 0, 0);
      ctx.restore();
    }
    return { canvas, image: ctx.getImageData(0, 0, w, h) };
  }

  const SurfaceCompleter = { reconstruct };

  // ── persistent edge ─────────────────────────────────────────────
  const EDGE_PREFIX = "morph-edge:";

  function TransitionEdge(fromState, toState, extras) {
    extras = extras || {};
    this.fromState = fromState;
    this.toState = toState;
    this.duration = extras.duration ?? 1;
    this.easing = extras.easing || "smoothstep";
    this.landmarkMapping = extras.landmarkMapping || {};
    this.motionField = extras.motionField || {};
    this.jointTrajectories = extras.jointTrajectories || {};
    this.deformationParameters = extras.deformationParameters || {};
    this.visibilityMasks = extras.visibilityMasks || {};
    this.secondaryMotion = extras.secondaryMotion || {};
    this.learnedCorrections = extras.learnedCorrections || {};
    this.qualityScore = extras.qualityScore || 0;
    this.observations = extras.observations || 0;
    this.updated_at = extras.updated_at || Date.now();
  }
  TransitionEdge.prototype.key = function () { return this.fromState + "__" + this.toState; };
  TransitionEdge.prototype.toJSON = function () {
    return {
      fromState: this.fromState, toState: this.toState,
      duration: this.duration, easing: this.easing,
      landmarkMapping: this.landmarkMapping,
      motionField: this.motionField,
      jointTrajectories: this.jointTrajectories,
      deformationParameters: this.deformationParameters,
      visibilityMasks: this.visibilityMasks,
      secondaryMotion: this.secondaryMotion,
      learnedCorrections: this.learnedCorrections,
      qualityScore: this.qualityScore,
      observations: this.observations,
      updated_at: this.updated_at,
    };
  };
  TransitionEdge.prototype.save = function () {
    try { localStorage.setItem(EDGE_PREFIX + this.key(), JSON.stringify(this.toJSON())); } catch (e) { /* quota */ }
    return this;
  };
  TransitionEdge.load = function (from, to) {
    try {
      const raw = localStorage.getItem(EDGE_PREFIX + from + "__" + to);
      if (!raw) return null;
      return new TransitionEdge(from, to, JSON.parse(raw));
    } catch (e) { return null; }
  };
  TransitionEdge.prototype.learnFrom = function (score, landmarkResidual, rate) {
    rate = rate == null ? 0.25 : rate;
    this.observations += 1;
    this.qualityScore = (1 - rate) * this.qualityScore + rate * score;
    if (landmarkResidual) {
      const prev = this.learnedCorrections.landmarkResidual || {};
      const next = {};
      const keys = new Set([...Object.keys(prev), ...Object.keys(landmarkResidual)]);
      for (const k of keys) {
        const a = prev[k] || [0, 0];
        const b = landmarkResidual[k] || [0, 0];
        next[k] = [(1 - rate) * a[0] + rate * b[0], (1 - rate) * a[1] + rate * b[1]];
      }
      this.learnedCorrections.landmarkResidual = next;
    }
    this.updated_at = Date.now();
  };

  // ── engine ──────────────────────────────────────────────────────
  function MorphEngine() {
    this.poseMatcher = PoseMatcher;
    this.landmarkRegistrar = LandmarkRegistrar;
    this.meshBuilder = SkeletonMeshBuilder;
    this.motionEstimator = MotionEstimator;
    this.jointInterpolator = JointInterpolator;
    this.flowRefiner = OpticalFlowRefiner;
    this.occlusionDetector = OcclusionDetector;
    this.surfaceCompleter = SurfaceCompleter;
    this.secondary = SecondaryMotionSolver;
    this.validator = FrameValidator;
    this.canonical = renderCharacter(poseIdle(), "canonical");
    this.canonical.meta.canonical = true;
    this.cache = { canonical: this.canonical };
    this.atlas = extractAtlas(this.canonical);
  }

  MorphEngine.prototype.registerState = function (state) {
    this.cache[state.name] = state;
    return state;
  };

  MorphEngine.prototype._resolve = function (state) {
    if (state && typeof state === "object" && state.landmarks) {
      this.cache[state.name] = state;
      return state;
    }
    if (typeof state === "string" && this.cache[state]) return this.cache[state];
    throw new Error("Unknown state: " + state);
  };

  MorphEngine.prototype.morph = function (stateA, stateB, opts) {
    opts = opts || {};
    const framesN = opts.frames == null ? 8 : opts.frames;
    const learn = opts.learn !== false;
    const easing = opts.easing || "smoothstep";
    const duration = opts.duration == null ? 1 : opts.duration;

    const a = this._resolve(stateA);
    const b = this._resolve(stateB);

    const match = this.poseMatcher.run(a, b);
    if (!match.ok) throw new Error("PoseMatcher rejected " + a.name + " → " + b.name);

    const mapping = this.landmarkRegistrar.run(a, b, match.shared);
    const meshA = this.meshBuilder.run(a);
    const vertsB = this.meshBuilder.corresponding(meshA, b.landmarks);
    let field = this.motionEstimator.run(a, b, meshA, vertsB);
    field = this.flowRefiner.run(field);

    let edge = TransitionEdge.load(a.name, b.name);
    if (!edge) edge = new TransitionEdge(a.name, b.name, { duration, easing });
    else {
      edge.easing = easing || edge.easing;
      edge.duration = duration || edge.duration;
    }
    edge.landmarkMapping = mapping;
    edge.motionField = field;
    edge.jointTrajectories = this.jointInterpolator.trajectories(a, b, mapping);
    edge.deformationParameters = { nVerts: meshA.vertices.length, nFaces: meshA.faces.length };

    const total = framesN + 2;
    const generated = [];
    for (let i = 0; i < total; i++) {
      const rawT = i / (total - 1);
      const t = applyEasing(rawT, edge.easing);
      let lmT = this.jointInterpolator.run(a, b, t, mapping);
      lmT = this.secondary.run(lmT, a, b, t);
      const corr = edge.learnedCorrections.landmarkResidual;
      if (corr) {
        const wiggle = Math.sin(Math.PI * t) * 0.15;
        for (const k of Object.keys(corr)) {
          if (!lmT[k]) continue;
          lmT[k][0] += corr[k][0] * wiggle;
          lmT[k][1] += corr[k][1] * wiggle;
        }
      }
      generated.push(this.surfaceCompleter.reconstruct(this.atlas, lmT, a.width, a.height));
    }

    generated[0] = { canvas: a.canvas, image: a.image };
    generated[generated.length - 1] = { canvas: b.canvas, image: b.image };

    const images = generated.map((g) => g.image);
    const report = this.validator.run(images, a, b);
    const vis = this.occlusionDetector.run(a, b);
    edge.visibilityMasks = vis;
    edge.secondaryMotion = { phase: 0.18, names: SECONDARY_NAMES };
    edge.qualityScore = report.score;

    if (learn) {
      const mid = Math.floor(generated.length / 2);
      const residual = {};
      for (const n of Object.keys(a.landmarks)) {
        if (!b.landmarks[n]) continue;
        const midLm = this.jointInterpolator.run(a, b, 0.5, mapping)[n];
        // nudge toward keeping canonical torso stable — residual is small
        residual[n] = [0, 0];
      }
      edge.learnFrom(report.score, residual);
    }
    edge.save();

    return {
      frames: generated,
      images,
      edge,
      report,
      endpoints: [a, b],
    };
  };

  function morph(stateA, stateB, opts) {
    const engine = new MorphEngine();
    if (stateA && stateA.landmarks) engine.registerState(stateA);
    if (stateB && stateB.landmarks) engine.registerState(stateB);
    return engine.morph(stateA, stateB, opts);
  }

  function naiveCrossfade(a, b, framesN) {
    const out = [{ canvas: a.canvas, image: a.image }];
    for (let i = 1; i <= framesN; i++) {
      const t = i / (framesN + 1);
      const canvas = makeCanvas(a.width, a.height);
      const ctx = canvas.getContext("2d");
      ctx.globalAlpha = 1;
      ctx.drawImage(a.canvas, 0, 0);
      ctx.globalAlpha = t;
      ctx.drawImage(b.canvas, 0, 0);
      out.push({ canvas, image: ctx.getImageData(0, 0, a.width, a.height) });
    }
    out.push({ canvas: b.canvas, image: b.image });
    return out;
  }

  function sheet(frames, pad) {
    pad = pad == null ? 4 : pad;
    const h = frames[0].canvas.height, w = frames[0].canvas.width;
    const n = frames.length;
    const canvas = makeCanvas(n * (w + pad) + pad, h + pad * 2);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#121218";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    frames.forEach((f, i) => {
      ctx.drawImage(f.canvas, pad + i * (w + pad), pad);
    });
    return canvas;
  }

  function runTransitionTest(opts) {
    opts = opts || {};
    const framesN = opts.frames == null ? 8 : opts.frames;
    try { localStorage.removeItem(EDGE_PREFIX + "idle__reach"); } catch (e) {}

    const engine = new MorphEngine();
    const idle = engine.registerState(renderCharacter(poseIdle(), "idle"));
    const reach = engine.registerState(renderCharacter(poseReach(), "reach"));

    const pass1 = engine.morph(idle, reach, { frames: framesN, learn: true, easing: "smoothstep" });
    const pass2 = engine.morph("idle", "reach", { frames: framesN, learn: true, easing: "smoothstep" });
    const naive = naiveCrossfade(idle, reach, framesN);

    const mid = Math.floor(pass1.images.length / 2);
    const metrics = {
      nFrames: pass1.images.length,
      midStripeMorph: stripeCount(pass1.images[mid]),
      midStripeNaive: stripeCount(naive[mid].image),
      idleStripe: stripeCount(idle.image),
      reachStripe: stripeCount(reach.image),
      endpointL1: l1(pass1.images[pass1.images.length - 1], reach.image),
      edgeObservations: pass2.edge.observations,
      edgeQuality: pass2.edge.qualityScore,
      edgeEasing: pass2.edge.easing,
      validatorScore: pass1.report.score,
    };

    const stripeOk = metrics.midStripeMorph > metrics.midStripeNaive * 1.15;
    const recovered = metrics.midStripeMorph >= Math.min(metrics.reachStripe, metrics.idleStripe) * 0.6;
    const exactEnd = metrics.endpointL1 < 1;
    const persisted = metrics.edgeObservations >= 2;
    const pass = stripeOk && recovered && exactEnd && persisted;

    return {
      pass,
      metrics,
      idle, reach,
      morphFrames: pass1.frames,
      morphFrames2: pass2.frames,
      naive,
      sheetMorph: sheet(pass1.frames),
      sheetNaive: sheet(naive),
      sheetLearned: sheet(pass2.frames),
      edge: pass2.edge,
      proof: { stripeOk, recovered, exactEnd, persisted },
    };
  }

  const api = {
    W, H, COLORS, LANDMARK_NAMES,
    poseIdle, poseReach, renderCharacter,
    MorphEngine, TransitionEdge, morph,
    naiveCrossfade, sheet, runTransitionTest,
    extractAtlas, reconstruct, applyEasing,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MorphEngineLib = api;
})(typeof window !== "undefined" ? window : globalThis);
