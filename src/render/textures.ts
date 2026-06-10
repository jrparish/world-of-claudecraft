import * as THREE from 'three';

// Procedurally generated canvas textures — no external assets.

function makeCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let seedState = 12345;
function rnd(): number {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}

// Mottled detail texture multiplied over terrain vertex colors.
export function groundDetailTexture(): THREE.CanvasTexture {
  return makeCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) {
      const v = 150 + Math.floor(rnd() * 105);
      ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
      const x = rnd() * s, y = rnd() * s;
      const r = 1 + rnd() * 2.5;
      ctx.fillRect(x, y, r, r);
    }
    // blades
    for (let i = 0; i < 1400; i++) {
      const v = 120 + Math.floor(rnd() * 100);
      ctx.strokeStyle = `rgba(${v},${v},${v},0.30)`;
      const x = rnd() * s, y = rnd() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4);
      ctx.stroke();
    }
  });
}

export function barkTexture(): THREE.CanvasTexture {
  return makeCanvas(128, (ctx, s) => {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 4 + Math.floor(rnd() * 6)) {
      const w = 2 + rnd() * 3;
      const shade = rnd() > 0.5 ? 'rgba(40,24,12,0.5)' : 'rgba(120,90,55,0.45)';
      ctx.fillStyle = shade;
      ctx.fillRect(x, 0, w, s);
    }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = 'rgba(30,18,8,0.5)';
      ctx.fillRect(rnd() * s, rnd() * s, 2, 6 + rnd() * 14);
    }
  });
}

export function foliageTexture(): THREE.CanvasTexture {
  return makeCanvas(128, (ctx, s) => {
    ctx.fillStyle = '#2e5d2a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const g = 70 + Math.floor(rnd() * 60);
      ctx.fillStyle = `rgba(${20 + rnd() * 30},${g},${25 + rnd() * 20},0.5)`;
      const x = rnd() * s, y = rnd() * s;
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + rnd() * 3, 3 + rnd() * 5, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function roofTexture(): THREE.CanvasTexture {
  return makeCanvas(128, (ctx, s) => {
    ctx.fillStyle = '#8a4a2f';
    ctx.fillRect(0, 0, s, s);
    const rowH = 16;
    for (let y = 0; y < s; y += rowH) {
      const offset = (y / rowH) % 2 === 0 ? 0 : 16;
      ctx.fillStyle = 'rgba(40,16,8,0.55)';
      ctx.fillRect(0, y + rowH - 2, s, 2);
      for (let x = -16; x < s; x += 32) {
        ctx.fillStyle = 'rgba(40,16,8,0.4)';
        ctx.fillRect(x + offset, y, 2, rowH);
        const v = rnd();
        if (v > 0.6) {
          ctx.fillStyle = 'rgba(255,200,160,0.07)';
          ctx.fillRect(x + offset + 2, y, 30, rowH - 2);
        }
      }
    }
  });
}

// Plaster with timber framing
export function wallTexture(): THREE.CanvasTexture {
  return makeCanvas(128, (ctx, s) => {
    ctx.fillStyle = '#d6c4a0';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1200; i++) {
      const v = 190 + Math.floor(rnd() * 40);
      ctx.fillStyle = `rgba(${v},${v - 15},${v - 45},0.3)`;
      ctx.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
    ctx.fillStyle = '#5a4226';
    ctx.fillRect(0, 0, s, 8);
    ctx.fillRect(0, s - 8, s, 8);
    ctx.fillRect(0, 0, 8, s);
    ctx.fillRect(s - 8, 0, 8, s);
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-s, -4, s * 2, 8);
    ctx.restore();
  });
}

export function stoneTexture(): THREE.CanvasTexture {
  return makeCanvas(128, (ctx, s) => {
    ctx.fillStyle = '#8d8d85';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 28; i++) {
      const x = rnd() * s, y = rnd() * s, w = 14 + rnd() * 26, h = 10 + rnd() * 16;
      const v = 115 + Math.floor(rnd() * 50);
      ctx.fillStyle = `rgb(${v},${v},${v - 6})`;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(40,40,38,0.6)';
      ctx.strokeRect(x, y, w, h);
    }
  });
}

export function waterNormalish(): THREE.CanvasTexture {
  const tex = makeCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#7f7fff';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) {
      const x = rnd() * s, y = rnd() * s, r = 6 + rnd() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${100 + rnd() * 80},${100 + rnd() * 80},255,0.25)`);
      g.addColorStop(1, 'rgba(127,127,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Soft round cloud sprite
export function cloudTexture(): THREE.CanvasTexture {
  return makeCanvas(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) {
      const x = s * 0.25 + rnd() * s * 0.5;
      const y = s * 0.35 + rnd() * s * 0.3;
      const r = s * 0.10 + rnd() * s * 0.14;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Vertical sky gradient for the dome
export function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#3a72b8');
  g.addColorStop(0.45, '#7eb2e4');
  g.addColorStop(0.62, '#aacdec');
  g.addColorStop(0.75, '#cfe4f2');
  g.addColorStop(1.0, '#dcecf4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function grassTuftTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 18; i++) {
    const x = 8 + rnd() * 48;
    const sway = (rnd() - 0.5) * 14;
    const h = 26 + rnd() * 30;
    const g = 110 + Math.floor(rnd() * 70);
    ctx.strokeStyle = `rgba(${30 + rnd() * 30},${g},${30 + rnd() * 25},0.9)`;
    ctx.lineWidth = 1.5 + rnd();
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.quadraticCurveTo(x + sway * 0.4, 64 - h * 0.6, x + sway, 64 - h);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Sparkle star for ground quest objects
export function sparkleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,250,180,0.95)');
  g.addColorStop(0.25, 'rgba(255,230,120,0.45)');
  g.addColorStop(1, 'rgba(255,220,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(255,255,220,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 6); ctx.lineTo(32, 58);
  ctx.moveTo(6, 32); ctx.lineTo(58, 32);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
