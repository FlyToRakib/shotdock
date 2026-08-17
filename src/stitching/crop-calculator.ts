/**
 * Works out, for each captured frame, which slice of it belongs in the final
 * image and where it goes. All arithmetic is in device pixels.
 *
 * The invariant that keeps seams from appearing: every frame is drawn starting
 * exactly where the previous one stopped (`dy = coveredBottom`), and the source
 * offset is derived from that destination — never the other way round. Rounding
 * therefore cannot open a gap or double-draw a row.
 */

export interface FrameGeometry {
  index: number;
  row: number;
  col: number;
  /** Actual scroll offsets in CSS pixels, as reported by the page. */
  x: number;
  y: number;
}

export interface DrawOp {
  index: number;
  row: number;
  col: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
}

export interface CropOptions {
  /** Viewport size in CSS pixels. */
  viewportWidth: number;
  viewportHeight: number;
  /** Final image size in device pixels. */
  outputWidth: number;
  outputHeight: number;
  /** Device pixels per CSS pixel. */
  scale: number;
}

export class CropTracker {
  private readonly frameWidth: number;
  private readonly frameHeight: number;
  private coveredBottom = 0;
  private coveredRight = 0;
  private currentRow = -1;
  private rowTop = 0;
  private rowSourceTop = 0;
  private rowHeight = 0;

  constructor(private readonly options: CropOptions) {
    this.frameWidth = Math.round(options.viewportWidth * options.scale);
    this.frameHeight = Math.round(options.viewportHeight * options.scale);
  }

  /** Returns the draw operation for a frame, or null if it adds nothing new. */
  next(frame: FrameGeometry): DrawOp | null {
    const { outputWidth, outputHeight, scale } = this.options;
    const frameTop = Math.round(frame.y * scale);
    const frameLeft = Math.round(frame.x * scale);

    if (frame.row !== this.currentRow) {
      let dy = this.coveredBottom;
      let sy = dy - frameTop;
      if (sy < 0) {
        // The page grew (or scrolled back): trust the frame's own position.
        sy = 0;
        dy = frameTop;
      }
      const dh = Math.min(this.frameHeight - sy, outputHeight - dy);
      if (dh <= 0) return null;

      this.currentRow = frame.row;
      this.rowTop = dy;
      this.rowSourceTop = sy;
      this.rowHeight = dh;
      this.coveredBottom = dy + dh;
      this.coveredRight = 0;
    }

    let dx = this.coveredRight;
    let sx = dx - frameLeft;
    if (sx < 0) {
      sx = 0;
      dx = frameLeft;
    }
    const dw = Math.min(this.frameWidth - sx, outputWidth - dx);
    if (dw <= 0) return null;
    this.coveredRight = dx + dw;

    return {
      index: frame.index,
      row: frame.row,
      col: frame.col,
      sx,
      sy: this.rowSourceTop,
      sw: dw,
      sh: this.rowHeight,
      dx,
      dy: this.rowTop,
    };
  }

  /** Device-pixel row reached so far — used to report stitching progress. */
  get bottom(): number {
    return this.coveredBottom;
  }
}

/** Batch form of {@link CropTracker}, used by tests and by non-streaming callers. */
export function computeDrawOps(frames: FrameGeometry[], options: CropOptions): DrawOp[] {
  const tracker = new CropTracker(options);
  const ops: DrawOp[] = [];
  for (const frame of frames) {
    const op = tracker.next(frame);
    if (op) ops.push(op);
  }
  return ops;
}

/**
 * Shifts a draw op's source window by `delta` device pixels without moving its
 * destination — how a seam correction is applied. Clamped so the window stays
 * inside the source bitmap.
 */
export function shiftSource(op: DrawOp, delta: number, sourceHeight: number): DrawOp {
  const maxSy = Math.max(0, sourceHeight - op.sh);
  const sy = Math.min(Math.max(op.sy + delta, 0), maxSy);
  return sy === op.sy ? op : { ...op, sy };
}
