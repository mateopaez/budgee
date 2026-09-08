import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { WorkspaceRepository } from './repository';
import { WORKSPACE_VERSION, type Workspace } from './workspace';

/**
 * Browser local storage adapter, scoped by Firebase Auth uid.
 *
 * Every key is namespaced with the uid so two accounts on the same device can
 * never read each other's data, mirroring the users/{uid} Firestore shape that
 * the future adapter will use.
 */
@Injectable({ providedIn: 'root' })
export class LocalWorkspaceRepository implements WorkspaceRepository {
  private readonly platformId = inject(PLATFORM_ID);

  private key(uid: string): string {
    return `budgee:v${WORKSPACE_VERSION}:workspace:${uid}`;
  }

  private get available(): boolean {
    return isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined';
  }

  async load(uid: string): Promise<Workspace | null> {
    if (!this.available) return null;
    try {
      const raw = localStorage.getItem(this.key(uid));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Workspace;
      if (parsed.version !== WORKSPACE_VERSION || parsed.uid !== uid) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async save(workspace: Workspace): Promise<void> {
    if (!this.available) return;
    try {
      localStorage.setItem(this.key(workspace.uid), JSON.stringify(workspace));
    } catch {
      // Storage can be full or blocked. The in memory workspace stays usable.
    }
  }

  async clear(uid: string): Promise<void> {
    if (!this.available) return;
    try {
      localStorage.removeItem(this.key(uid));
    } catch {
      // Ignore: nothing to clean up if storage is unavailable.
    }
  }
}
