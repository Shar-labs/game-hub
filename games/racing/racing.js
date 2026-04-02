/**
 * TOP-DOWN 2-PLAYER RACING GAME
 * Pure vanilla JS, Canvas 900×600
 */

(function() {
'use strict';

// ─────────────────────────────────────────────
//  CANVAS SETUP
// ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = 900, H = 600;

// ─────────────────────────────────────────────
//  TRACK CENTERLINE WAYPOINTS
// ─────────────────────────────────────────────
const WAYPOINTS = [
  {x: 450, y: 100},
  {x: 750, y: 100},
  {x: 850, y: 200},
  {x: 850, y: 400},
  {x: 750, y: 480},
  {x: 550, y: 500},
  {x: 450, y: 520},
  {x: 300, y: 500},
  {x: 150, y: 480},
  {x:  80, y: 350},
  {x: 100, y: 220},
  {x: 150, y: 180},
  {x: 200, y: 150},
  {x: 300, y: 100},
];

const TRACK_HALF_WIDTH = 45;
const NUM_WAYPOINTS    = WAYPOINTS.length;

// ─────────────────────────────────────────────
//  SPLINE HELPERS — Catmull-Rom
// ─────────────────────────────────────────────
function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
  };
}

// Pre-compute a dense set of spline points for the closed loop
const SPLINE_STEPS = 8; // sub-steps per segment
const splinePoints = []; // dense list of {x,y}

function buildSpline() {
  const n = NUM_WAYPOINTS;
  for (let i = 0; i < n; i++) {
    const p0 = WAYPOINTS[(i - 1 + n) % n];
    const p1 = WAYPOINTS[i];
    const p2 = WAYPOINTS[(i + 1) % n];
    const p3 = WAYPOINTS[(i + 2) % n];
    for (let s = 0; s < SPLINE_STEPS; s++) {
      const t = s / SPLINE_STEPS;
      splinePoints.push(catmullRomPoint(p0, p1, p2, p3, t));
    }
  }
}
buildSpline();

// Pre-compute spline segment lengths for later use
const splineSegLengths = [];
let totalSplineLen = 0;
for (let i = 0; i < splinePoints.length; i++) {
  const a = splinePoints[i];
  const b = splinePoints[(i + 1) % splinePoints.length];
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  splineSegLengths.push(d);
  totalSplineLen += d;
}

// Find nearest point on the spline to a given (x,y)
// Returns {dist, idx, nx, ny, tx, ty} where nx/ny is nearest point, tx/ty is tangent
function nearestSplinePoint(x, y) {
  let bestDist = Infinity, bestIdx = 0, bestNx = 0, bestNy = 0;
  const n = splinePoints.length;
  for (let i = 0; i < n; i++) {
    const p = splinePoints[i];
    const q = splinePoints[(i + 1) % n];
    // Closest point on segment p->q
    const dx = q.x - p.x, dy = q.y - p.y;
    const lenSq = dx*dx + dy*dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((x - p.x)*dx + (y - p.y)*dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const nx = p.x + t*dx;
    const ny = p.y + t*dy;
    const dist = Math.hypot(x - nx, y - ny);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx  = i;
      bestNx   = nx;
      bestNy   = ny;
    }
  }
  // Tangent direction at bestIdx
  const p = splinePoints[bestIdx];
  const q = splinePoints[(bestIdx + 1) % n];
  const tLen = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return {
    dist:  bestDist,
    idx:   bestIdx,
    nx:    bestNx,
    ny:    bestNy,
    tx:    (q.x - p.x) / tLen,
    ty:    (q.y - p.y) / tLen,
  };
}

// ─────────────────────────────────────────────
//  CHECKPOINTS (8, evenly spaced around spline)
// ─────────────────────────────────────────────
const NUM_CHECKPOINTS = 8;
const checkpoints = []; // each: {x, y, nx, ny} — center pt + normal

function buildCheckpoints() {
  checkpoints.length = 0;
  const total = splinePoints.length;
  for (let c = 0; c < NUM_CHECKPOINTS; c++) {
    const idx = Math.floor(c * total / NUM_CHECKPOINTS);
    const p   = splinePoints[idx];
    const q   = splinePoints[(idx + 1) % total];
    const tx  = q.x - p.x, ty = q.y - p.y;
    const len = Math.hypot(tx, ty) || 1;
    // Normal perpendicular to tangent
    const nx = -ty / len, ny = tx / len;
    checkpoints.push({ x: p.x, y: p.y, nx, ny });
  }
}
buildCheckpoints();

// Test if a car has crossed a checkpoint line this frame
// Returns true if car centre crossed the checkpoint's perpendicular line
function crossedCheckpoint(cp, carOld, carNew) {
  // Checkpoint line: through cp.x/y, perpendicular direction = cp.nx/cp.ny
  // Signed distances from line
  const dot1 = (carOld.x - cp.x) * cp.ny - (carOld.y - cp.y) * cp.nx;
  const dot2 = (carNew.x  - cp.x) * cp.ny - (carNew.y  - cp.y) * cp.nx;
  // Also must be within track width of the centerline
  const distFromCenter = Math.abs((carNew.x - cp.x) * cp.nx + (carNew.y - cp.y) * cp.ny);
  if (distFromCenter > TRACK_HALF_WIDTH + 20) return false;
  return (dot1 < 0 && dot2 >= 0) || (dot1 >= 0 && dot2 < 0);
}

// ─────────────────────────────────────────────
//  PHYSICS CONSTANTS
// ─────────────────────────────────────────────
const PHYSICS = {
  maxSpeed:           5.5,
  acceleration:       0.12,
  braking:            0.25,
  friction:           0.97,
  offTrackFriction:   0.88,
  steeringSpeed:      0.038,
  steeringSpeedAtLow: 0.055,
  driftFactor:        0.85,
  minSpeedToSteer:    0.3,
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist2(a, b) { return (a.x-b.x)**2 + (a.y-b.y)**2; }

// ─────────────────────────────────────────────
//  PARTICLES
// ─────────────────────────────────────────────
const particles = [];
function spawnParticle(x, y, type) {
  const count = (type === 'dust') ? 3 : (type === 'spark') ? 6 : 1;
  for (let i = 0; i < count; i++) {
    const angle  = Math.random() * Math.PI * 2;
    const speed  = Math.random() * (type === 'spark' ? 3 : 1.5) + 0.5;
    let color;
    if (type === 'dust')  color = `rgba(${180+Math.random()*40|0},${130+Math.random()*30|0},80,0.7)`;
    if (type === 'spark') color = Math.random() < 0.5 ? '#fff' : '#ffd700';
    if (type === 'smoke') color = `rgba(120,120,120,0.5)`;
    particles.push({
      x, y,
      velX:  Math.cos(angle) * speed,
      velY:  Math.sin(angle) * speed,
      life:  1.0,
      decay: 0.03 + Math.random() * 0.04,
      color,
      size:  type === 'spark' ? 2 : (type === 'dust' ? 3 + Math.random()*3 : 4),
      type,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.velX;
    p.y    += p.velY;
    p.velX *= 0.92;
    p.velY *= 0.92;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life * 0.85;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  // Prevent arrow keys from scrolling
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup',   e => { keys[e.code] = false; });

// ─────────────────────────────────────────────
//  CAR CREATION
// ─────────────────────────────────────────────
function makeCar(name, color, x, y, angle) {
  return {
    name, color, x, y, angle,
    speed: 0, velX: 0, velY: 0,
    lap: 0,
    checkpoint: -1,       // last checkpoint index hit
    checkpointArmed: true, // ready to cross next checkpoint
    finished: false,
    onTrack: true,
    prevX: x, prevY: y,
  };
}

let cars;
function resetCars() {
  // Starting at start/finish (checkpoint 0 area), heading right along top straight
  cars = [
    makeCar('P1', '#00aaff', 450, 108, 0),
    makeCar('P2', '#ff8c00', 450, 128, 0),
  ];
}
resetCars();

// ─────────────────────────────────────────────
//  PHYSICS TICK
// ─────────────────────────────────────────────
function tickCar(car, input) {
  // Save old position for checkpoint crossing test
  car.prevX = car.x;
  car.prevY = car.y;

  // 1. Steering
  if (Math.abs(car.speed) > PHYSICS.minSpeedToSteer) {
    const steerAmount = car.speed > 0 ? input.steer : -input.steer;
    const t  = Math.min(Math.abs(car.speed) / PHYSICS.maxSpeed, 1);
    const sr = lerp(PHYSICS.steeringSpeedAtLow, PHYSICS.steeringSpeed, t);
    car.angle += steerAmount * sr;
  }

  // 2. Throttle / brake
  if (input.throttle) car.speed += PHYSICS.acceleration;
  if (input.brake)    car.speed -= PHYSICS.braking;

  // 3. Friction
  const friction = car.onTrack ? PHYSICS.friction : PHYSICS.offTrackFriction;
  car.speed *= friction;

  // 4. Clamp speed
  car.speed = clamp(car.speed, -PHYSICS.maxSpeed * 0.4, PHYSICS.maxSpeed);

  // 5. Drift: blend world velocity toward heading
  const headX = Math.cos(car.angle) * car.speed;
  const headY = Math.sin(car.angle) * car.speed;
  const blend = 1 - PHYSICS.driftFactor + 0.3;
  car.velX = lerp(car.velX, headX, blend);
  car.velY = lerp(car.velY, headY, blend);

  // 6. Move
  car.x += car.velX;
  car.y += car.velY;

  // 7. Screen boundary clamp
  car.x = clamp(car.x, 8, W - 8);
  car.y = clamp(car.y, 8, H - 8);

  // 8. Track boundary
  const near = nearestSplinePoint(car.x, car.y);
  car.onTrack = near.dist <= TRACK_HALF_WIDTH;
  if (!car.onTrack) {
    // Apply off-track penalty
    car.speed *= 0.96;
    // Push back toward track center
    const pushX = near.nx - car.x;
    const pushY = near.ny - car.y;
    const pushLen = Math.hypot(pushX, pushY) || 1;
    car.x += (pushX / pushLen) * 2;
    car.y += (pushY / pushLen) * 2;
    // Dust particles (occasionally)
    if (Math.random() < 0.3) spawnParticle(car.x, car.y, 'dust');
  }

  // 9. Exhaust smoke at low throttle / idle
  if (!input.throttle && Math.abs(car.speed) > 0.5 && Math.random() < 0.1) {
    const rearX = car.x - Math.cos(car.angle) * 14;
    const rearY = car.y - Math.sin(car.angle) * 14;
    spawnParticle(rearX, rearY, 'smoke');
  }
}

// ─────────────────────────────────────────────
//  CHECKPOINT / LAP LOGIC
// ─────────────────────────────────────────────
function updateLaps(car) {
  if (car.finished) return;

  for (let ci = 0; ci < NUM_CHECKPOINTS; ci++) {
    const cp = checkpoints[ci];
    const old = { x: car.prevX, y: car.prevY };
    const now = { x: car.x,     y: car.y     };

    if (!crossedCheckpoint(cp, old, now)) continue;

    if (ci === 0) {
      // Start/finish line — only count lap if last checkpoint was (NUM_CHECKPOINTS-1)
      if (car.checkpoint === NUM_CHECKPOINTS - 1) {
        car.lap++;
        car.checkpoint = 0;
        if (car.lap >= 3) {
          car.finished = true;
          car.finishTime = raceTime;
        }
      } else if (car.checkpoint === -1) {
        // Initial crossing at start — arm checkpoint sequence
        car.checkpoint = 0;
      }
    } else {
      // Sequential checkpoint: must be next after current
      if (ci === car.checkpoint + 1) {
        car.checkpoint = ci;
      }
    }
    break; // only handle one checkpoint crossing per frame
  }
}

// ─────────────────────────────────────────────
//  CAR-CAR COLLISION
// ─────────────────────────────────────────────
function carCollision(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d  = Math.hypot(dx, dy);
  if (d < 30 && d > 0) {
    const nx = dx / d, ny = dy / d;
    const push = (30 - d) / 2 + 1;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
    a.speed *= 0.80; b.speed *= 0.80;
    a.velX  *= 0.80; a.velY  *= 0.80;
    b.velX  *= 0.80; b.velY  *= 0.80;
    // Spark at midpoint
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    spawnParticle(mx, my, 'spark');
    spawnParticle(mx, my, 'spark');
  }
}

// ─────────────────────────────────────────────
//  TRACK RENDERING
// ─────────────────────────────────────────────

// Precompute the inner and outer edge point arrays for drawing
const outerEdge = [], innerEdge = [];

function buildTrackEdges() {
  const n = splinePoints.length;
  outerEdge.length = 0; innerEdge.length = 0;
  for (let i = 0; i < n; i++) {
    const cur  = splinePoints[i];
    const next = splinePoints[(i + 1) % n];
    const tx = next.x - cur.x, ty = next.y - cur.y;
    const len = Math.hypot(tx, ty) || 1;
    // Normal (left = outer, right = inner for CCW track)
    const nx = -ty / len, ny = tx / len;
    outerEdge.push({ x: cur.x + nx * TRACK_HALF_WIDTH, y: cur.y + ny * TRACK_HALF_WIDTH });
    innerEdge.push({ x: cur.x - nx * TRACK_HALF_WIDTH, y: cur.y - ny * TRACK_HALF_WIDTH });
  }
}
buildTrackEdges();

// Offscreen canvas for track (render once)
let trackCanvas = null;

function buildTrackCanvas() {
  trackCanvas = document.createElement('canvas');
  trackCanvas.width  = W;
  trackCanvas.height = H;
  const tc = trackCanvas.getContext('2d');

  const n = splinePoints.length;

  // 1. Background grass
  tc.fillStyle = '#1e3a1e';
  tc.fillRect(0, 0, W, H);

  // Grass texture noise
  tc.save();
  for (let i = 0; i < 4000; i++) {
    const gx = Math.random() * W, gy = Math.random() * H;
    const bright = Math.random() < 0.5 ? 35 : 25;
    tc.fillStyle = `rgba(${bright},${bright+20},${bright},0.45)`;
    tc.fillRect(gx, gy, 1.5, 1.5);
  }
  tc.restore();

  // 2. Track asphalt (fill road polygon)
  // Draw filled road using outer edge as one polygon and inner as a hole (clip)
  tc.save();
  tc.fillStyle = '#1a1a2e';

  // Outer polygon (road + infield)
  tc.beginPath();
  tc.moveTo(outerEdge[0].x, outerEdge[0].y);
  for (let i = 1; i < n; i++) tc.lineTo(outerEdge[i].x, outerEdge[i].y);
  tc.closePath();
  tc.fill();

  // Inner grass (infield) — punch hole
  tc.fillStyle = '#1e3a1e';
  tc.beginPath();
  tc.moveTo(innerEdge[0].x, innerEdge[0].y);
  for (let i = 1; i < n; i++) tc.lineTo(innerEdge[i].x, innerEdge[i].y);
  tc.closePath();
  tc.fill();

  // Infield grass noise
  tc.save();
  // create clipping path for infield
  tc.beginPath();
  tc.moveTo(innerEdge[0].x, innerEdge[0].y);
  for (let i = 1; i < n; i++) tc.lineTo(innerEdge[i].x, innerEdge[i].y);
  tc.closePath();
  tc.clip();
  for (let i = 0; i < 2000; i++) {
    const gx = Math.random() * W, gy = Math.random() * H;
    const bright = Math.random() < 0.5 ? 45 : 30;
    tc.fillStyle = `rgba(${bright},${bright+25},${bright},0.5)`;
    tc.fillRect(gx, gy, 2, 2);
  }
  tc.restore();

  tc.restore();

  // 3. Road surface noise/texture
  tc.save();
  // Clip to road
  tc.beginPath();
  tc.moveTo(outerEdge[0].x, outerEdge[0].y);
  for (let i = 1; i < n; i++) tc.lineTo(outerEdge[i].x, outerEdge[i].y);
  tc.closePath();
  tc.beginPath();  // start new sub-path for inner (hole)
  // Actually use evenodd fill for clipping
  const roadPath = new Path2D();
  roadPath.moveTo(outerEdge[0].x, outerEdge[0].y);
  for (let i = 1; i < n; i++) roadPath.lineTo(outerEdge[i].x, outerEdge[i].y);
  roadPath.closePath();
  const innerPath = new Path2D();
  innerPath.moveTo(innerEdge[0].x, innerEdge[0].y);
  for (let i = 1; i < n; i++) innerPath.lineTo(innerEdge[i].x, innerEdge[i].y);
  innerPath.closePath();

  // Clip to road area (outer minus inner using evenodd)
  const combinedPath = new Path2D();
  combinedPath.addPath(roadPath);
  combinedPath.addPath(innerPath);
  tc.clip(combinedPath, 'evenodd');

  for (let i = 0; i < 3000; i++) {
    const gx = Math.random() * W, gy = Math.random() * H;
    const v = Math.floor(Math.random() * 15 + 20);
    tc.fillStyle = `rgba(${v},${v},${v+5},0.4)`;
    tc.fillRect(gx, gy, 1.5, 1.5);
  }
  tc.restore();

  // 4. White dashed center line
  tc.save();
  tc.strokeStyle = 'rgba(255,255,255,0.55)';
  tc.lineWidth   = 2;
  tc.setLineDash([14, 12]);
  tc.lineDashOffset = 0;
  tc.beginPath();
  tc.moveTo(splinePoints[0].x, splinePoints[0].y);
  for (let i = 1; i < n; i++) tc.lineTo(splinePoints[i].x, splinePoints[i].y);
  tc.closePath();
  tc.stroke();
  tc.setLineDash([]);
  tc.restore();

  // 5. Outer edge line
  tc.save();
  tc.strokeStyle = 'rgba(255,255,255,0.8)';
  tc.lineWidth   = 2.5;
  tc.beginPath();
  tc.moveTo(outerEdge[0].x, outerEdge[0].y);
  for (let i = 1; i < n; i++) tc.lineTo(outerEdge[i].x, outerEdge[i].y);
  tc.closePath();
  tc.stroke();
  tc.restore();

  // 6. Inner edge line
  tc.save();
  tc.strokeStyle = 'rgba(255,255,255,0.8)';
  tc.lineWidth   = 2.5;
  tc.beginPath();
  tc.moveTo(innerEdge[0].x, innerEdge[0].y);
  for (let i = 1; i < n; i++) tc.lineTo(innerEdge[i].x, innerEdge[i].y);
  tc.closePath();
  tc.stroke();
  tc.restore();

  // 7. Kerbs (alternating red/white segments at corners every N spline points)
  const KERB_STEP = 6, KERB_W = 7;
  for (let i = 0; i < n; i += KERB_STEP) {
    const colorA = (Math.floor(i / KERB_STEP) % 2 === 0) ? '#cc2222' : '#ffffff';
    const colorB = colorA === '#cc2222' ? '#ffffff' : '#cc2222';
    // Outer kerb
    const i2 = Math.min(i + KERB_STEP, n - 1);
    tc.save();
    tc.strokeStyle = colorA;
    tc.lineWidth   = KERB_W;
    tc.lineCap = 'butt';
    tc.beginPath();
    tc.moveTo(outerEdge[i].x, outerEdge[i].y);
    tc.lineTo(outerEdge[i2 % n].x, outerEdge[i2 % n].y);
    tc.stroke();
    // Inner kerb
    tc.strokeStyle = colorB;
    tc.beginPath();
    tc.moveTo(innerEdge[i].x, innerEdge[i].y);
    tc.lineTo(innerEdge[i2 % n].x, innerEdge[i2 % n].y);
    tc.stroke();
    tc.restore();
  }

  // 8. Start/finish line — checkered pattern at checkpoint 0
  {
    const cp   = checkpoints[0];
    const perp = { x: cp.nx, y: cp.ny };
    const tang = { x: -cp.ny, y: cp.nx };
    const SQUARES = 6, SQ_W = TRACK_HALF_WIDTH * 2 / SQUARES, SQ_H = 10;
    tc.save();
    tc.translate(cp.x, cp.y);
    tc.rotate(Math.atan2(tang.y, tang.x));
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < SQUARES; col++) {
        const isWhite = (row + col) % 2 === 0;
        tc.fillStyle = isWhite ? '#ffffff' : '#000000';
        tc.fillRect(
          -TRACK_HALF_WIDTH + col * SQ_W,
          -SQ_H / 2 + row * (SQ_H / 2),
          SQ_W, SQ_H / 2
        );
      }
    }
    tc.restore();
  }

  // 9. Re-draw inner/outer white lines on top of kerbs
  tc.save();
  tc.strokeStyle = 'rgba(255,255,255,0.9)';
  tc.lineWidth   = 1.8;
  tc.beginPath();
  tc.moveTo(outerEdge[0].x, outerEdge[0].y);
  for (let i = 1; i < n; i++) tc.lineTo(outerEdge[i].x, outerEdge[i].y);
  tc.closePath(); tc.stroke();
  tc.beginPath();
  tc.moveTo(innerEdge[0].x, innerEdge[0].y);
  for (let i = 1; i < n; i++) tc.lineTo(innerEdge[i].x, innerEdge[i].y);
  tc.closePath(); tc.stroke();
  tc.restore();
}

// ─────────────────────────────────────────────
//  CAR DRAWING
// ─────────────────────────────────────────────
function drawCar(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  const L = 24, W2 = 14; // length, width
  const HL = L / 2, HW = W2 / 2;

  // Shadow
  ctx.save();
  ctx.translate(3, 4);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  roundRect(ctx, -HL, -HW, L, W2, 4);
  ctx.fill();
  ctx.restore();

  // Body
  ctx.fillStyle = car.color;
  roundRect(ctx, -HL, -HW, L, W2, 4);
  ctx.fill();

  // Body highlight (top sheen)
  ctx.save();
  const grad = ctx.createLinearGradient(-HL, -HW, -HL, HW);
  grad.addColorStop(0, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = grad;
  roundRect(ctx, -HL, -HW, L, W2, 4);
  ctx.fill();
  ctx.restore();

  // Windscreen (front area)
  ctx.fillStyle = 'rgba(120,200,255,0.55)';
  roundRect(ctx, HL - 9, -HW + 2, 8, W2 - 4, 2);
  ctx.fill();

  // Rear window
  ctx.fillStyle = 'rgba(80,120,180,0.4)';
  roundRect(ctx, -HL + 2, -HW + 2, 6, W2 - 4, 2);
  ctx.fill();

  // Wheels (4 corners) — dark rectangles
  ctx.fillStyle = '#1a1a1a';
  const wheelPositions = [
    { x:  HL - 6, y: -HW - 2 },
    { x:  HL - 6, y:  HW - 2 },
    { x: -HL + 2, y: -HW - 2 },
    { x: -HL + 2, y:  HW - 2 },
  ];
  for (const wp of wheelPositions) {
    ctx.save();
    ctx.translate(wp.x + 3, wp.y + 2);
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, -3, -2, 6, 4, 1);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  // Headlights (front)
  ctx.fillStyle = '#fffde0';
  ctx.shadowColor = '#fffaaa';
  ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(HL + 1, -HW + 3, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(HL + 1,  HW - 3, 2.5, 0, Math.PI*2); ctx.fill();

  // Taillights (rear)
  ctx.fillStyle = '#ff2222';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(-HL - 1, -HW + 3, 2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-HL - 1,  HW - 3, 2, 0, Math.PI*2); ctx.fill();

  // Name label on car
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.font = 'bold 7px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(car.name, 0, 0);

  ctx.restore();
}

// Polyfill roundRect for older browsers
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─────────────────────────────────────────────
//  HUD
// ─────────────────────────────────────────────
function drawHUDBox(x, y, car, align) {
  const bW = 160, bH = 72;
  const bX = align === 'left' ? x : x - bW;

  // Box background
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(ctx, bX, y, bW, bH, 8);
  ctx.fill();
  ctx.strokeStyle = car.color + '88';
  ctx.lineWidth = 1.5;
  roundRect(ctx, bX, y, bW, bH, 8);
  ctx.stroke();
  ctx.restore();

  const pad = 10;
  const tx  = align === 'left' ? bX + pad : bX + bW - pad;
  const ta  = align === 'left' ? 'left' : 'right';

  // Player name
  ctx.fillStyle = car.color;
  ctx.font = 'bold 15px "Segoe UI", Arial';
  ctx.textAlign   = ta;
  ctx.textBaseline = 'top';
  ctx.fillText(car.name, tx, y + 8);

  // Lap
  const lapDisplay = car.finished ? 'FINISHED 🏁' : `LAP ${Math.min(car.lap + 1, 3)} / 3`;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px "Segoe UI", Arial';
  ctx.fillText(lapDisplay, tx, y + 26);

  // Speed (convert to "km/h" by multiplying by 20)
  const speedKmh = Math.abs(car.speed * 20 * 10) | 0;
  ctx.fillStyle = '#ccc';
  ctx.font = '11px "Segoe UI", Arial';
  ctx.fillText(`${speedKmh} km/h`, tx, y + 43);

  // On/off track status
  ctx.fillStyle = car.onTrack ? '#44ff88' : '#ff6644';
  ctx.fillText(car.onTrack ? '✓ ON TRACK' : '✗ OFF TRACK', tx, y + 57);
}

function formatTime(ms) {
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s / 60);
  const ss = s % 60;
  const mss = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(mss).padStart(2,'0')}`;
}

function drawHUD() {
  // P1 box (top-left)
  drawHUDBox(8, 8, cars[0], 'left');
  // P2 box (top-right)
  drawHUDBox(W - 8, 8, cars[1], 'right');

  // Race time (center top)
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, W/2 - 65, 8, 130, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(formatTime(raceTime), W/2, 16);
}

// ─────────────────────────────────────────────
//  MINI-MAP
// ─────────────────────────────────────────────
function drawMiniMap() {
  const MX = W - 10, MY = H - 10;
  const MW = 150, MH = 100;
  const bX = MX - MW, bY = MY - MH;

  // Track bounding box for scaling
  const allX = splinePoints.map(p => p.x);
  const allY = splinePoints.map(p => p.y);
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;

  function mapPt(px, py) {
    return {
      x: bX + (px - minX) / rangeX * (MW - 20) + 10,
      y: bY + (py - minY) / rangeY * (MH - 20) + 10,
    };
  }

  // Background
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(ctx, bX, bY, MW, MH, 6);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  roundRect(ctx, bX, bY, MW, MH, 6);
  ctx.stroke();

  // Track outline (outer)
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 5;
  ctx.beginPath();
  const op0 = mapPt(outerEdge[0].x, outerEdge[0].y);
  ctx.moveTo(op0.x, op0.y);
  for (let i = 1; i < outerEdge.length; i++) {
    const op = mapPt(outerEdge[i].x, outerEdge[i].y);
    ctx.lineTo(op.x, op.y);
  }
  ctx.closePath(); ctx.stroke();

  // Inner track outline
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 5;
  ctx.beginPath();
  const ip0 = mapPt(innerEdge[0].x, innerEdge[0].y);
  ctx.moveTo(ip0.x, ip0.y);
  for (let i = 1; i < innerEdge.length; i++) {
    const ip = mapPt(innerEdge[i].x, innerEdge[i].y);
    ctx.lineTo(ip.x, ip.y);
  }
  ctx.closePath(); ctx.stroke();

  // Road fill
  ctx.fillStyle = '#2a2a3e';
  ctx.beginPath();
  ctx.moveTo(op0.x, op0.y);
  for (let i = 1; i < outerEdge.length; i++) {
    const op = mapPt(outerEdge[i].x, outerEdge[i].y);
    ctx.lineTo(op.x, op.y);
  }
  ctx.closePath();
  ctx.beginPath();
  ctx.moveTo(ip0.x, ip0.y);
  for (let i = 1; i < innerEdge.length; i++) {
    const ip = mapPt(innerEdge[i].x, innerEdge[i].y);
    ctx.lineTo(ip.x, ip.y);
  }
  ctx.closePath();

  // Just draw road directly
  ctx.fillStyle = '#1a1a2e';
  const roadMM = new Path2D();
  roadMM.moveTo(op0.x, op0.y);
  for (let i = 1; i < outerEdge.length; i++) {
    const op = mapPt(outerEdge[i].x, outerEdge[i].y);
    roadMM.lineTo(op.x, op.y);
  }
  roadMM.closePath();
  const innerMM = new Path2D();
  innerMM.moveTo(ip0.x, ip0.y);
  for (let i = 1; i < innerEdge.length; i++) {
    const ip = mapPt(innerEdge[i].x, innerEdge[i].y);
    innerMM.lineTo(ip.x, ip.y);
  }
  innerMM.closePath();
  const combMM = new Path2D();
  combMM.addPath(roadMM); combMM.addPath(innerMM);
  ctx.fill(combMM, 'evenodd');

  // Car dots
  for (const car of cars) {
    const cp = mapPt(car.x, car.y);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────────────────────────
//  GAME STATE
// ─────────────────────────────────────────────
const STATE = {
  COUNTDOWN: 'countdown',
  RACING:    'racing',
  FINISHED:  'finished',
};
let gameState  = STATE.COUNTDOWN;
let countdownVal  = 3;
let countdownTimer = 0;
let raceTime   = 0;
let winner     = null;
let lastTime   = null;

// ─────────────────────────────────────────────
//  RESTART
// ─────────────────────────────────────────────
function restartGame() {
  resetCars();
  particles.length = 0;
  gameState   = STATE.COUNTDOWN;
  countdownVal   = 3;
  countdownTimer = 0;
  raceTime    = 0;
  winner      = null;
  lastTime    = null;
}

// ─────────────────────────────────────────────
//  DRAW COUNTDOWN OVERLAY
// ─────────────────────────────────────────────
function drawCountdown() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);

  const text = countdownVal > 0 ? String(countdownVal) : 'GO!';
  const color = countdownVal > 0 ? '#fff' : '#00ff88';

  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.font        = 'bold 110px "Segoe UI", Arial';
  ctx.fillStyle   = 'rgba(0,0,0,0.5)';
  ctx.fillText(text, W/2 + 4, H/2 + 4);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 40;
  ctx.fillText(text, W/2, H/2);

  ctx.shadowBlur = 0;
  ctx.font       = 'bold 22px "Segoe UI", Arial';
  ctx.fillStyle  = '#aaa';
  ctx.fillText('RACE STARTS IN...', W/2, H/2 + 80);

  ctx.font       = '15px "Segoe UI", Arial';
  ctx.fillStyle  = '#00aaff';
  ctx.fillText('P1: W/S = Throttle/Brake   A/D = Steer', W/2, H - 60);
  ctx.fillStyle  = '#ff8c00';
  ctx.fillText('P2: ↑/↓ = Throttle/Brake   ←/→ = Steer', W/2, H - 38);

  ctx.restore();
}

// ─────────────────────────────────────────────
//  DRAW FINISH OVERLAY
// ─────────────────────────────────────────────
function drawFinishOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Trophy
  ctx.font      = '80px serif';
  ctx.fillStyle = '#ffd700';
  ctx.fillText('🏆', W/2, H/2 - 80);

  // Winner text
  ctx.font      = 'bold 54px "Segoe UI", Arial';
  ctx.fillStyle = winner ? winner.color : '#fff';
  ctx.shadowColor = winner ? winner.color : '#fff';
  ctx.shadowBlur  = 30;
  const wText = winner ? `${winner.name} WINS!` : 'BOTH FINISHED!';
  ctx.fillText(wText, W/2, H/2 - 10);

  ctx.shadowBlur = 0;
  ctx.font       = '22px "Segoe UI", Arial';
  ctx.fillStyle  = '#ccc';
  ctx.fillText(`Time: ${formatTime(winner ? winner.finishTime : raceTime)}`, W/2, H/2 + 45);

  ctx.font       = '18px "Segoe UI", Arial';
  ctx.fillStyle  = '#888';
  ctx.fillText('Press R to restart', W/2, H/2 + 85);

  ctx.restore();
}

// ─────────────────────────────────────────────
//  MAIN GAME LOOP
// ─────────────────────────────────────────────
function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  const dtMs = Math.min(timestamp - lastTime, 50); // cap dt
  lastTime = timestamp;

  // ── Update ──────────────────────────────────
  if (gameState === STATE.COUNTDOWN) {
    countdownTimer += dtMs;
    if (countdownTimer >= 1000) {
      countdownTimer -= 1000;
      countdownVal--;
      if (countdownVal < 0) {
        gameState = STATE.RACING;
      }
    }
  } else if (gameState === STATE.RACING) {
    raceTime += dtMs;

    // Read inputs
    const inp1 = {
      throttle: keys['KeyW'],
      brake:    keys['KeyS'],
      steer:    (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0),
    };
    const inp2 = {
      throttle: keys['ArrowUp'],
      brake:    keys['ArrowDown'],
      steer:    (keys['ArrowRight'] ? 1 : 0) - (keys['ArrowLeft'] ? 1 : 0),
    };

    // Only allow movement after GO!
    tickCar(cars[0], inp1);
    tickCar(cars[1], inp2);

    // Checkpoints / laps
    updateLaps(cars[0]);
    updateLaps(cars[1]);

    // Car-car collision
    carCollision(cars[0], cars[1]);

    // Particles
    updateParticles();

    // Check finish
    for (const car of cars) {
      if (car.finished && gameState === STATE.RACING) {
        winner     = car;
        gameState  = STATE.FINISHED;
      }
    }
  } else if (gameState === STATE.FINISHED) {
    updateParticles();
    // Restart
    if (keys['KeyR']) {
      restartGame();
    }
  }

  // ── Draw ────────────────────────────────────
  // Track (pre-rendered)
  ctx.drawImage(trackCanvas, 0, 0);

  // Particles (under cars)
  drawParticles();

  // Cars
  for (const car of cars) drawCar(car);

  // HUD
  drawHUD();
  drawMiniMap();

  // Overlays
  if (gameState === STATE.COUNTDOWN) {
    drawCountdown();
  } else if (gameState === STATE.FINISHED) {
    drawFinishOverlay();
  }

  requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
buildTrackCanvas();
requestAnimationFrame(loop);

})(); // end IIFE
