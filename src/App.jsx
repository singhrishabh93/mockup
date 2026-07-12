import { useEffect, useRef, useState } from "react";
import Shell from "./Shell.jsx";
import "./App.css";

const SIZES = {
  play: { w: 1080, h: 1920, label: "play store 1080×1920" },
  app: { w: 1290, h: 2796, label: "app store 1290×2796" },
};
const FRAMES = {
  black: ["#2c2c2e", "#111113"],
  silver: ["#e4e5e9", "#b4b6bd"],
  blue: ["#46648c", "#22344d"],
};
const BUTTONS = {
  iphone: [["l", 0.17, 0.035], ["l", 0.24, 0.07], ["l", 0.33, 0.07], ["r", 0.27, 0.11]],
  android: [["r", 0.2, 0.12], ["r", 0.37, 0.06]],
};
const font = (size) => `800 ${size}px Inter, system-ui, sans-serif`;

function contrast(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#000" : "#fff";
}

function wrap(ctx, text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsize(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function fitCaption(ctx, text, max, W) {
  const min = W * 0.04;
  let size = W * 0.065;
  let lines;
  for (;;) {
    ctx.font = font(size);
    lines = wrap(ctx, text, max);
    const fits = lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= max);
    if (fits || size <= min) break;
    size = Math.max(min, size - W * 0.005);
  }
  if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
  return { lines: lines.map((l) => ellipsize(ctx, l, max)), size };
}

function draw(canvas, { shot, device, frame, bg, transparent, caption, size }) {
  const { w: W, h: H } = SIZES[size];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  if (!transparent) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  const pad = W * 0.08;
  let top = pad;
  const text = caption.trim();
  if (text) {
    const { lines, size: fs } = fitCaption(ctx, text, W - pad * 2, W);
    ctx.fillStyle = transparent ? "#000" : contrast(bg);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * fs * 1.25));
    top += lines.length * fs * 1.25 + W * 0.06;
  }

  const android = device === "android";
  const aspect = android ? 9 / 20 : 9 / 19.5;
  const bez = android ? 0.03 : 0.035;
  const hPerW = (1 - 2 * bez) / aspect + 2 * bez;
  const availH = H - top - pad;
  const bw = Math.min(W - pad * 2, availH / hPerW);
  const bh = bw * hPerW;
  const x = (W - bw) / 2;
  const y = top + (availH - bh) / 2;
  const r = bw * (android ? 0.11 : 0.15);
  const [rim, rimDark] = FRAMES[frame];

  const btn = bw * 0.012;
  ctx.fillStyle = rimDark;
  for (const [side, at, len] of BUTTONS[device]) {
    ctx.beginPath();
    ctx.roundRect(side === "l" ? x - btn : x + bw - btn, y + bh * at, btn * 2, bh * len, btn);
    ctx.fill();
  }

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = W * 0.05;
  ctx.shadowOffsetY = W * 0.02;
  const grad = ctx.createLinearGradient(x, 0, x + bw, 0);
  grad.addColorStop(0, rimDark);
  grad.addColorStop(0.06, rim);
  grad.addColorStop(0.94, rim);
  grad.addColorStop(1, rimDark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, r);
  ctx.fill();
  ctx.restore();

  const rimW = bw * 0.014;
  ctx.fillStyle = "#0a0a0b";
  ctx.beginPath();
  ctx.roundRect(x + rimW, y + rimW, bw - rimW * 2, bh - rimW * 2, r - rimW);
  ctx.fill();

  const b = bw * bez;
  const sx = x + b;
  const sy = y + b;
  const sw = bw - b * 2;
  const sh = bh - b * 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, r - b);
  ctx.clip();
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(sx, sy, sw, sh);
  if (shot) {
    const scale = Math.max(sw / shot.naturalWidth, sh / shot.naturalHeight);
    const dw = shot.naturalWidth * scale;
    const dh = shot.naturalHeight * scale;
    ctx.drawImage(shot, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
  }
  ctx.restore();

  ctx.fillStyle = "#000";
  ctx.beginPath();
  if (android) ctx.arc(sx + sw / 2, sy + sw * 0.05, sw * 0.03, 0, Math.PI * 2);
  else {
    const iw = sw * 0.3;
    const ih = sw * 0.088;
    ctx.roundRect(sx + (sw - iw) / 2, sy + sw * 0.032, iw, ih, ih / 2);
  }
  ctx.fill();
}

export default function App() {
  const canvasRef = useRef(null);
  const [shot, setShot] = useState(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [device, setDevice] = useState("iphone");
  const [frame, setFrame] = useState("black");
  const [bg, setBg] = useState("#fdfff4");
  const [transparent, setTransparent] = useState(false);
  const [caption, setCaption] = useState("");
  const [size, setSize] = useState("play");
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([document.fonts.load(font(48)), document.fonts.ready]).then(
      () => alive && setFontReady(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => shot && URL.revokeObjectURL(shot.src), [shot]);

  useEffect(() => {
    draw(canvasRef.current, { shot, device, frame, bg, transparent, caption, size });
  }, [shot, device, frame, bg, transparent, caption, size, fontReady]);

  function load(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("that file isn't an image.");
      return;
    }
    const img = new Image();
    img.onload = () => {
      setError("");
      setShot(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      setError("couldn't read that image.");
    };
    img.src = URL.createObjectURL(file);
  }

  function download() {
    canvasRef.current.toBlob((blob) => {
      if (!blob) return setError("export failed.");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mockup-${SIZES[size].w}x${SIZES[size].h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  }

  return (
    <Shell
      name="mockup"
      tag="design · store"
      description="put an app screenshot inside a phone frame, ready for store listings."
      repo="mockup"
    >
      <div className="workspace">
        <aside className="panel" aria-label="mockup settings">
          <div className="group">
            <span className="group-label">screenshot</span>
            <label
              className={`drop${dragging ? " over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                load(e.dataTransfer.files[0]);
              }}
            >
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(e) => load(e.target.files[0])}
              />
              {shot ? (
                <img className="thumb" src={shot.src} alt="" />
              ) : (
                <span className="drop-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15V3M7 8l5-5 5 5M4 21h16" />
                  </svg>
                </span>
              )}
              <span className="drop-text">
                <strong>{shot ? "replace screenshot" : "drop a screenshot"}</strong>
                <span>or click to choose · stays on your device</span>
              </span>
            </label>
            {error ? <p className="error">{error}</p> : null}
          </div>

          <Segmented
            name="device"
            label="device"
            value={device}
            onChange={setDevice}
            options={[
              ["iphone", "iphone", "dynamic island"],
              ["android", "android", "punch-hole"],
            ]}
          />

          <fieldset className="group">
            <legend className="group-label">frame color</legend>
            <div className="swatches">
              {Object.entries(FRAMES).map(([f, [c]]) => (
                <label key={f} className="swatch">
                  <input
                    className="sr-only"
                    type="radio"
                    name="frame"
                    value={f}
                    checked={frame === f}
                    onChange={() => setFrame(f)}
                  />
                  <span className="dot" style={{ background: c }} />
                  {f}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="group">
            <label className="group-label" htmlFor="bg">
              background
            </label>
            <div className="bg-row">
              <input
                id="bg"
                type="color"
                value={bg}
                disabled={transparent}
                onChange={(e) => setBg(e.target.value)}
              />
              <span className="hex">{transparent ? "none" : bg}</span>
              <label className="check">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(e) => setTransparent(e.target.checked)}
                />
                transparent
              </label>
            </div>
          </div>

          <div className="group">
            <label className="group-label" htmlFor="caption">
              caption <span className="optional">optional</span>
            </label>
            <input
              id="caption"
              className="text-input"
              type="text"
              maxLength={80}
              placeholder="track every habit"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <Segmented
            name="size"
            label="export size"
            value={size}
            onChange={setSize}
            options={Object.entries(SIZES).map(([k, s]) => [k, s.label.split(" ").slice(0, 2).join(" "), `${s.w}×${s.h}`])}
          />
        </aside>

        <section className="stage" aria-label="preview">
          <div className="stage-bar">
            <span className="stage-title">
              artboard <span>{SIZES[size].w} × {SIZES[size].h}</span>
            </span>
            <button className="btn-primary" type="button" onClick={download}>
              download png
            </button>
          </div>
          <div className="stage-canvas">
            <canvas ref={canvasRef} className="checker" role="img" aria-label="phone mockup preview" />
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Segmented({ name, label, value, onChange, options }) {
  return (
    <fieldset className="group">
      <legend className="group-label">{label}</legend>
      <div className="segmented">
        {options.map(([v, text, sub]) => (
          <label key={v} className="segment">
            <input
              className="sr-only"
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span>{text}</span>
            <small>{sub}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
