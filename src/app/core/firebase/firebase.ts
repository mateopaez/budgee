import { Injectable } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase.config';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  readonly app: FirebaseApp =
    getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
}
