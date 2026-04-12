import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
  onSnapshot,
  CollectionReference,
  DocumentData,
} from '@angular/fire/firestore';
import { Character } from '@models/models';
import { signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  public characters = signal<Character[]>([]);
  private collectionRef: CollectionReference<DocumentData, DocumentData>;

  constructor() {
    this.collectionRef = collection(this.firestore, 'characters');
    this.subscribeToCharacters();
  }

  private subscribeToCharacters() {
    onSnapshot(this.collectionRef, (snapshot) => {
      const chars = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: String(doc.id),
          ...data,
          updatedAt: data.updatedAt?.toDate() || data.updatedAt
        } as Character;
      });
      this.characters.set(chars);
    });
  }

  // /** Створити персонажа */
  // create(character: Omit<Character, 'id'>): Promise<void> {
  //   return addDoc(this.collectionRef, character).then(() => { });
  // }
  /** Створити персонажа і повернути його з реальним Firestore ID */
  async create(character: Omit<Character, 'id'>): Promise<Character> {
    const docRef = await addDoc(this.collectionRef, character);
    // Повертаємо повний об’єкт з ID документа
    return { ...character, id: String(docRef.id) }; // або String(docRef.id), якщо хочеш строковий ID
  }

  /** Оновити персонажа */
  update(character: Character): Promise<void> {
    if (!character.id) throw new Error('ID required for update');
    const ref = doc(this.firestore, 'characters', String(character.id));
    return updateDoc(ref, { ...character });
  }

  /** Видалити персонажа */
  delete(id: string): Promise<void> {
    const ref = doc(this.firestore, 'characters', String(id));
    return deleteDoc(ref);
  }

  /** Отримати ВСІХ персонажів */
  async getAllCharacters(): Promise<Character[]> {
    const snapshot = await runInInjectionContext(this.injector, () => getDocs(this.collectionRef));
    return snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: String(doc.id),
        ...data,
        updatedAt: data.updatedAt?.toDate() || data.updatedAt
      } as Character;
    });
  }
}
