import type { WorkspaceRepository } from './repository';
import { WORKSPACE_VERSION, type Workspace } from './workspace';

/**
 * Explicitly non-persistent in-memory adapter for unit tests.
 *
 * Production runtime must use FirestoreWorkspaceRepository. This class never
 * touches localStorage, sessionStorage or IndexedDB.
 */
export class MemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly store = new Map<string, Workspace>();

  async load(uid: string): Promise<Workspace | null> {
    return this.store.get(uid) ?? null;
  }

  async save(workspace: Workspace): Promise<void> {
    if (workspace.version !== WORKSPACE_VERSION) {
      throw new Error(`Unsupported workspace version: ${workspace.version}`);
    }
    this.store.set(workspace.uid, structuredClone(workspace));
  }

  async clear(uid: string): Promise<void> {
    this.store.delete(uid);
  }
}
