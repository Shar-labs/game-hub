/**
 * wheel.js — Mystery Card Spin Wheel for Game Hub
 * Shows 6 alternating slices: Connect Four / Battleship
 * After landing, redirects to the selected game after 1 second.
 */

(function () {
  const SEGMENTS = [
    { label: "Connect Four", color: "#bf5fff", url: "games/connectfour/index.html" },
    { label: "Battleship",   color: "#ff8c00", url: "games/battleship/index.html"  },
    { label: "Connect Four", color: "#bf5fff", url: "games/connectfour/index.html" },
    { label: "Battleship",   color: "#ff8c00", url: "games/battleship/index.html"  },
    { label: "Connect Four", color: "#bf5fff", url: "games/connectfour/index.html" },
    { label: "Battleship",   color: "#ff8c00", url: "games/battleship/index.html"  },
  ];

  const NUM_SEGMENTS = SEGMENTS.length;
  const SLICE_ANGLE = (2 * Math.PI) / NUM_SEGMENTS;

  let canvas, ctx, resultEl;
  let spinning = false;
  let currentAngle = 0; // current rotation of the wheel (radians)

  // ─── Public API ───────────────────────────────────────────────────────────

  window.openWheel = function () {
    const overlay = document.getElementById("wheel-overlay");
    if (!overlay) return;
    overlay.classList.add("open");

    // Lazy-init canvas
    canvas = document.getElementById("wheel-canvas");
    resultEl = document.getElementById("wheel-result");
    if (canvas) {
      ctx = canvas.getContext("2d");
      drawWheel(currentAngle);
    }
  };

  window.closeWheel = function () {
    const overlay = document.getElementById("wheel-overlay");
    if (overlay) overlay.classList.remove("open");
  };

  window.doSpin = function () {
    if (spinning) return;
    spinning = true;

    if (resultEl) {
      resultEl.textContent = "";
      resultEl.style.display = "none";
    }

    // Pick a random target segment index
    const targetIndex = Math.floor(Math.random() * NUM_SEGMENTS);

    // Full spins (5–8) + land exactly on center of the target segment
    const extraSpins = (5 + Math.floor(Math.random() * 4)) * 2 * Math.PI;
    // Angle of segment center, adjusted so pointer (top = -PI/2) hits it
    const segmentCenterAngle = SLICE_ANGLE * targetIndex + SLICE_ANGLE / 2;
    // We want the wheel rotated so that segmentCenterAngle faces the top pointer
    // pointer is at -PI/2 in canvas coords; we need: (segmentCenterAngle + finalAngle) % 2PI = 3PI/2 (bottom of canvas = top visually, depending on draw direction)
    // Simpler: pointer at top means angle offset = (3*PI/2 - segmentCenterAngle)
    const targetAngle =
      currentAngle +
      extraSpins +
      ((3 * Math.PI) / 2 - segmentCenterAngle - currentAngle + 4 * Math.PI) % (2 * Math.PI);

    const duration = 3000; // ms
    const startAngle = currentAngle;
    const startTime = performance.now();

    function easeOut(t) {
      // Cubic ease-out
      return 1 - Math.pow(1 - t, 3);
    }

    function animate(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easedT = easeOut(t);

      currentAngle = startAngle + (targetAngle - startAngle) * easedT;
      drawWheel(currentAngle);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Done spinning
        currentAngle = currentAngle % (2 * Math.PI);
        spinning = false;

        const seg = SEGMENTS[targetIndex];

        if (resultEl) {
          resultEl.textContent = "🎉 " + seg.label + "!";
          resultEl.style.display = "block";
        }

        // Redirect after 1 second
        setTimeout(function () {
          window.location.href = seg.url;
        }, 1000);
      }
    }

    requestAnimationFrame(animate);
  };

  // ─── Drawing ──────────────────────────────────────────────────────────────

  function drawWheel(rotation) {
    if (!canvas || !ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(cx, cy) - 10;

    ctx.clearRect(0, 0, W, H);

    // Draw segments
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const startA = rotation + i * SLICE_ANGLE;
      const endA = startA + SLICE_ANGLE;

      // Slice fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startA, endA);
      ctx.closePath();
      ctx.fillStyle = SEGMENTS[i].color;
      ctx.fill();

      // Slice border
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startA + SLICE_ANGLE / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px 'Segoe UI', Arial, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.fillText(SEGMENTS[i].label, radius - 14, 5);
      ctx.restore();
    }

    // Center hub circle
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pointer (triangle at top)
    const pSize = 16;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius - 4);
    ctx.lineTo(cx - pSize / 2, cy - radius + pSize);
    ctx.lineTo(cx + pSize / 2, cy - radius + pSize);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
})();
