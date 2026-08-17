import { ShotDockError, toErrorInfo } from '../shared/errors';
import type {
  CaptureErrorInfo,
  CaptureResult,
  CaptureStatus,
  CaptureType,
  SessionState,
} from '../shared/types';

/**
 * The capture state machine:
 *
 *   idle → analyzing → preparing → capturing ⇄ paused → stitching → ready
 *                                      ↓
 *                            cancelled / error
 *
 * Long-running work calls {@link checkpoint} between steps, which is where pause
 * blocks and cancellation throws. Keeping both in one place is what makes
 * "stop cleanly at any point" a property of the design rather than a scattering
 * of flag checks.
 */
export class CaptureSession {
  private status: CaptureStatus = 'idle';
  private type: CaptureType | null = null;
  private completed = 0;
  private total = 0;
  private detail = '';
  private result: CaptureResult | null = null;
  private error: CaptureErrorInfo | null = null;

  /** Set to unwind a running capture; thrown from the next checkpoint. */
  private abortError: ShotDockError | null = null;
  private resumeSignal: (() => void) | null = null;
  private readonly listeners = new Set<(state: SessionState) => void>();

  onChange(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isActive(): boolean {
    return (
      this.status === 'analyzing' ||
      this.status === 'preparing' ||
      this.status === 'capturing' ||
      this.status === 'paused' ||
      this.status === 'stitching'
    );
  }

  get currentStatus(): CaptureStatus {
    return this.status;
  }

  start(type: CaptureType): void {
    this.type = type;
    this.status = 'analyzing';
    this.completed = 0;
    this.total = 0;
    this.detail = 'Analyzing page…';
    this.result = null;
    this.error = null;
    this.abortError = null;
    this.resumeSignal = null;
    this.emit();
  }

  setStatus(status: CaptureStatus, detail?: string): void {
    this.status = status;
    if (detail !== undefined) this.detail = detail;
    this.emit();
  }

  setTotal(total: number): void {
    this.total = total;
    this.detail = `Section 1 of ${total}`;
    this.emit();
  }

  frameCompleted(): void {
    this.completed = Math.min(this.completed + 1, this.total);
    this.detail =
      this.completed >= this.total
        ? 'Capture complete'
        : `Section ${this.completed + 1} of ${this.total}`;
    this.emit();
  }

  pause(): void {
    if (this.status !== 'capturing') return;
    this.status = 'paused';
    this.emit();
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.status = 'capturing';
    this.resumeSignal?.();
    this.resumeSignal = null;
    this.emit();
  }

  cancel(): void {
    this.abort(new ShotDockError('CANCELLED'));
  }

  /**
   * Stops a running capture with a specific reason — used when the tab it was
   * capturing navigates away or closes.
   */
  abort(error: ShotDockError): void {
    if (!this.isActive) return;
    this.abortError = error;
    // Wake a paused capture so it can observe the abort and unwind.
    this.resumeSignal?.();
    this.resumeSignal = null;
  }

  /**
   * The single suspension point of a capture. Throws to unwind on abort; blocks
   * while paused. Callers must run their page-restore logic in a `finally`.
   */
  async checkpoint(): Promise<void> {
    if (this.abortError) throw this.abortError;
    if (this.status === 'paused') {
      await new Promise<void>((resolve) => {
        this.resumeSignal = resolve;
      });
    }
    if (this.abortError) throw this.abortError;
  }

  succeed(result: CaptureResult): void {
    this.result = result;
    this.status = 'ready';
    this.detail = 'Ready';
    this.completed = this.total;
    this.emit();
  }

  updateResult(result: CaptureResult): void {
    this.result = result;
    this.emit();
  }

  failWith(error: unknown): void {
    if (error instanceof ShotDockError && error.code === 'CANCELLED') {
      this.status = 'cancelled';
      this.error = null;
      this.detail = 'Cancelled';
    } else {
      this.status = 'error';
      this.error = toErrorInfo(error);
      this.detail = '';
    }
    this.emit();
  }

  reset(): void {
    this.status = 'idle';
    this.type = null;
    this.completed = 0;
    this.total = 0;
    this.detail = '';
    this.result = null;
    this.error = null;
    this.abortError = null;
    this.resumeSignal = null;
    this.emit();
  }

  /** Re-adopts a persisted finished capture after a worker restart. */
  restore(state: SessionState): void {
    this.status = state.status;
    this.type = state.type;
    this.completed = state.progress.completed;
    this.total = state.progress.total;
    this.detail = state.progress.detail;
    this.result = state.result;
    this.error = state.error;
    this.abortError = null;
    this.resumeSignal = null;
  }

  snapshot(): SessionState {
    return {
      status: this.status,
      type: this.type,
      progress: { completed: this.completed, total: this.total, detail: this.detail },
      result: this.result,
      error: this.error,
    };
  }

  private emit(): void {
    const state = this.snapshot();
    for (const listener of this.listeners) listener(state);
  }
}
