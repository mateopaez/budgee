import { Injectable, inject } from '@angular/core';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { FirebaseService } from './firebase';

/** Thin accessor so feature code never imports the Firestore SDK entry point. */
@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private readonly firebase = inject(FirebaseService);
  readonly db: Firestore = getFirestore(this.firebase.app);
}
