"use client";

/**
 * Renders today's fate as a 1080×1350 shareable PNG (canvas, fully offline)
 * and hands it to the Web Share API, falling back to a download.
 */
import type { DailyDraw } from "@/lib/fate";
import { prettyDate } from "@/lib/fate";

const BG = "#0c0a09";
const GOLD = "#f5b84a";
const GOLD_DIM = "#926826";
const CREAM = "#fff4e0";
const MUTED = "#d6c9a8";

function drawWheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = R * 0.055;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  const r2 = R * 0.78;
  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = R * 0.02;
  ctx.beginPath();
  ctx.arc(cx, cy, r2, 0, Math.PI * 2);
  ctx.stroke();

  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + r2 * 0.12 * Math.cos(ang), cy + r2 * 0.12 * Math.sin(ang));
    ctx.lineTo(cx + r2 * Math.cos(ang), cy + r2 * Math.sin(ang));
    ctx.stroke();
  }

  // center gem
  const gr = R * 0.22;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(cx, cy - gr);
  ctx.lineTo(cx + gr, cy);
  ctx.lineTo(cx, cy + gr);
  ctx.lineTo(cx - gr, cy);
  ctx.closePath();
  ctx.fill();

  // orbit dots
  ctx.fillStyle = CREAM;
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4 + Math.PI / 8;
    const px = cx + R * Math.cos(ang);
    const py = cy + R * Math.sin(ang);
    ctx.beginPath();
    ctx.arc(px, py, R * 0.028, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function shareFateCard(draw: DailyDraw, dateKey: string): Promise<"shared" | "downloaded"> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const SERIF = "Georgia, 'Times New Roman', serif";

  // background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // frame
  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 8;
  ctx.strokeRect(56, 56, W - 112, H - 112);

  // header
  ctx.textAlign = "center";
  ctx.fillStyle = GOLD;
  ctx.font = `600 34px ${SERIF}`;
  ctx.fillText("F A T E   V 6", W / 2, 150);

  // wheel
  drawWheel(ctx, W / 2, 380, 150);

  // card name
  ctx.fillStyle = CREAM;
  ctx.font = `bold 76px ${SERIF}`;
  const nameLines = wrapText(ctx, draw.card.name, W - 240);
  let y = 650;
  for (const line of nameLines) {
    ctx.fillText(line, W / 2, y);
    y += 88;
  }

  // aspect
  ctx.fillStyle = GOLD;
  ctx.font = `italic 44px ${SERIF}`;
  ctx.fillText(`${draw.aspect}`, W / 2, y + 26);
  y += 96;

  // motto
  ctx.fillStyle = MUTED;
  ctx.font = `36px ${SERIF}`;
  for (const line of wrapText(ctx, `“${draw.card.motto}”`, W - 300)) {
    ctx.fillText(line, W / 2, y);
    y += 52;
  }

  // chips: window + number
  y += 40;
  const chipY = y;
  ctx.font = `30px ${SERIF}`;
  const chips = [`Lucky window: ${draw.window}`, `Number: ${draw.number}`];
  const widths = chips.map((c) => ctx.measureText(c).width + 56);
  let totalW = widths.reduce((a, b) => a + b, 0) + 24;
  let x = (W - totalW) / 2;
  for (let i = 0; i < chips.length; i++) {
    ctx.strokeStyle = GOLD_DIM;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, chipY, widths[i], 66, 33);
    ctx.stroke();
    ctx.fillStyle = CREAM;
    ctx.textBaseline = "middle";
    ctx.fillText(chips[i], x + widths[i] / 2, chipY + 35);
    ctx.textBaseline = "alphabetic";
    x += widths[i] + 24;
  }

  // footer
  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = `30px ${SERIF}`;
  ctx.fillText(prettyDate(dateKey), W / 2, H - 150);
  ctx.fillStyle = GOLD_DIM;
  ctx.font = `26px ${SERIF}`;
  ctx.fillText("Fate v6 · local-first PWA · offline forever", W / 2, H - 104);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Could not encode image");
  const file = new File([blob], `fate-v6-${dateKey}.png`, { type: "image/png" });

  const nav = navigator as Navigator;
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Fate v6 — today's draw", text: `${draw.card.name}, ${draw.aspect}` });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "shared"; // user closed the sheet
    }
  }
  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
