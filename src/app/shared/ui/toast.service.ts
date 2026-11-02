import { Injectable, signal } from '@angular/core';

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly action: ToastAction | null;
}

/** Short lived status messages, such as "Saved", with an optional action like Undo. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly currentSignal = signal<Toast | null>(null);
  readonly current = this.currentSignal.asReadonly();

  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, options: { action?: ToastAction; durationMs?: number } = {}): void {
    this.clearTimer();
    const toast: Toast = { id: this.nextId++, message, action: options.action ?? null };
    this.currentSignal.set(toast);
    this.timer = setTimeout(() => this.dismiss(toast.id), options.durationMs ?? 3000);
  }

  /** Runs the toast's action once and closes it. */
  runAction(): void {
    const toast = this.currentSignal();
    this.dismiss(toast?.id);
    toast?.action?.run();
  }

  dismiss(id = this.currentSignal()?.id): void {
    if (id === undefined || this.currentSignal()?.id !== id) return;
    this.clearTimer();
    this.currentSignal.set(null);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
