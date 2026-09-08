import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly destructive: boolean;
}

interface PendingConfirm extends ConfirmRequest {
  readonly resolve: (value: boolean) => void;
}

/** Promise based confirmation used before every destructive action. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pendingSignal = signal<PendingConfirm | null>(null);
  readonly pending = this.pendingSignal.asReadonly();

  ask(request: Partial<ConfirmRequest> & Pick<ConfirmRequest, 'title' | 'message'>): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pendingSignal.set({
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        destructive: true,
        ...request,
        resolve,
      });
    });
  }

  answer(value: boolean): void {
    const pending = this.pendingSignal();
    this.pendingSignal.set(null);
    pending?.resolve(value);
  }
}
