import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { FirebaseService } from '../firebase/firebase';
import { friendlyAuthError } from './auth-error';

/** Minimal profile Budgee keeps in memory. Credentials are never stored by us. */
export interface AuthUser {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

export type AuthStatus = 'initialising' | 'authenticated' | 'anonymous';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FirebaseService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);

  private readonly auth: Auth | null = this.browser ? getAuth(this.firebase.app) : null;

  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly statusSignal = signal<AuthStatus>('initialising');
  private readonly errorSignal = signal<string | null>(null);
  private readonly busySignal = signal(false);
  private readonly noticeSignal = signal<string | null>(null);

  readonly user = this.userSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly busy = this.busySignal.asReadonly();
  readonly notice = this.noticeSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.statusSignal() === 'authenticated');

  constructor() {
    if (!this.auth) {
      // On the server there is no session to restore.
      this.statusSignal.set('anonymous');
      return;
    }
    void setPersistence(this.auth, browserLocalPersistence).catch(() => undefined);
    onAuthStateChanged(this.auth, (user) => {
      this.userSignal.set(user ? toAuthUser(user) : null);
      this.statusSignal.set(user ? 'authenticated' : 'anonymous');
    });
    // Completes a redirect based Google sign in when pop-ups were unavailable.
    void getRedirectResult(this.auth).catch(() => undefined);
  }

  clearMessages(): void {
    this.errorSignal.set(null);
    this.noticeSignal.set(null);
  }

  async signInWithGoogle(): Promise<boolean> {
    if (!this.auth) return false;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return this.run(async () => {
      try {
        await signInWithPopup(this.auth as Auth, provider);
      } catch (error) {
        if (isPopupProblem(error)) {
          await signInWithRedirect(this.auth as Auth, provider);
          return;
        }
        throw error;
      }
    });
  }

  async signInWithEmail(email: string, password: string): Promise<boolean> {
    if (!this.auth) return false;
    return this.run(async () => {
      await signInWithEmailAndPassword(this.auth as Auth, email.trim(), password);
    });
  }

  async signUpWithEmail(name: string, email: string, password: string): Promise<boolean> {
    if (!this.auth) return false;
    return this.run(async () => {
      const credential = await createUserWithEmailAndPassword(
        this.auth as Auth,
        email.trim(),
        password,
      );
      const displayName = name.trim();
      if (displayName) {
        await updateProfile(credential.user, { displayName });
        this.userSignal.set(toAuthUser(credential.user));
      }
    });
  }

  async sendPasswordReset(email: string): Promise<boolean> {
    if (!this.auth) return false;
    const ok = await this.run(async () => {
      await sendPasswordResetEmail(this.auth as Auth, email.trim());
    });
    if (ok) {
      this.noticeSignal.set('Check your inbox for a link to choose a new password.');
    }
    return ok;
  }

  async signOut(): Promise<void> {
    if (!this.auth) return;
    await signOut(this.auth);
    this.clearMessages();
  }

  private async run(action: () => Promise<void>): Promise<boolean> {
    this.clearMessages();
    this.busySignal.set(true);
    try {
      await action();
      return true;
    } catch (error) {
      this.errorSignal.set(friendlyAuthError(error));
      return false;
    } finally {
      this.busySignal.set(false);
    }
  }
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    emailVerified: user.emailVerified,
  };
}

function isPopupProblem(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/cancelled-popup-request'
  );
}
