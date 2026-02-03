import { Injectable, inject, signal } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  or,
  and,
  CollectionReference,
  DocumentData,
  updateDoc,
  doc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  orderBy
} from '@angular/fire/firestore';
import { Act, Fight_type, Mode, Season_details } from '../../../models/models';

@Injectable({
  providedIn: 'root',
})
export class ActModsService {
  private actsCollection: CollectionReference<DocumentData>;
  private modesCollection: CollectionReference<DocumentData>;

  public acts = signal<Act[]>([]);
  public modes = signal<Mode[]>([]);

  constructor(private firestore: Firestore) {
    this.actsCollection = collection(this.firestore, 'acts');
    this.modesCollection = collection(this.firestore, 'modes');
    this.subscribeToData();
  }

  private subscribeToData() {
    // Listen for Acts
    onSnapshot(this.actsCollection, (snapshot) => {
      const acts = snapshot.docs.map(doc => this.convertToAct(doc));
      this.acts.set(acts);
    });

    // Listen for Modes
    onSnapshot(this.modesCollection, (snapshot) => {
      const modes = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data } as Mode;
      });
      this.modes.set(modes);
    });
  }

  async createAct(act: Act): Promise<void> {
    try {
      // Перевіряємо, чи існує акт згідно нових правил
      const existingAct = await this.checkActExists(act.name, act.type);

      if (existingAct) {
        const typeDisplay = this.getTypeDisplayName(act.type);
        const conflictTypes = this.getConflictTypes(act.type);
        throw new Error(`Акт з номером ${act.name} вже існує, конфлікт з ${conflictTypes}`);
      }

      // Готуємо дані для збереження (без id, якщо він є)
      const { id: actId, ...actData } = act;

      // Додаємо новий акт
      await addDoc(this.actsCollection, {
        ...actData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

    } catch (error: any) {
      console.error('Помилка при додаванні акта:', error);
      throw error;
    }
  }

  async getAllActs(): Promise<Act[]> {
    try {
      const querySnapshot = await getDocs(this.actsCollection);
      const acts: Act[] = [];

      querySnapshot.forEach((doc) => {
        // Конвертуємо документ Firestore в об'єкт Act
        const act = this.convertToAct(doc);
        acts.push(act);
      });

      return acts;
    } catch (error) {
      console.error('Помилка при отриманні актів:', error);
      throw error;
    }
  }

  async checkActExists(name: number, type: Fight_type): Promise<boolean> {
    try {
      if (type === 'Arcana_fight') {
        return await this.checkArcanaActExists(name);
      } else {
        return await this.checkBossOrVariationActExists(name, type);
      }
    } catch (error) {
      console.error('Помилка при перевірці існування акта:', error);
      throw error;
    }
  }

  private async checkArcanaActExists(name: number): Promise<boolean> {
    try {
      const q = query(
        this.actsCollection,
        where('name', '==', name),
        where('type', '==', 'Arcana_fight')
      );

      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Помилка при перевірці Arcana акта:', error);
      throw error;
    }
  }

  private async checkBossOrVariationActExists(name: number, currentType: Fight_type): Promise<boolean> {
    if (currentType !== 'Boss_fight' && currentType !== 'Variation_fight') {
      return false;
    }

    try {
      // Варіант 1: Використання оператора 'in' (найпростіший)
      const q = query(
        this.actsCollection,
        where('name', '==', name),
        where('type', 'in', ['Boss_fight', 'Variation_fight'])
      );

      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;

    } catch (error) {
      console.error('Помилка при перевірці Boss/Variation акта:', error);
      // Якщо 'in' не працює, використовуємо альтернативний підхід
      return await this.checkBossOrVariationActExistsAlternative(name);
    }
  }

  // Альтернативний метод, якщо оператор 'in' не підтримується
  private async checkBossOrVariationActExistsAlternative(name: number): Promise<boolean> {
    try {
      // Перевіряємо окремо для кожного типу
      const bossQuery = query(
        this.actsCollection,
        where('name', '==', name),
        where('type', '==', 'Boss_fight')
      );

      const variationQuery = query(
        this.actsCollection,
        where('name', '==', name),
        where('type', '==', 'Variation_fight')
      );

      const [bossSnapshot, variationSnapshot] = await Promise.all([
        getDocs(bossQuery),
        getDocs(variationQuery)
      ]);

      return !bossSnapshot.empty || !variationSnapshot.empty;

    } catch (error) {
      console.error('Помилка в альтернативній перевірці акта:', error);
      throw error;
    }
  }

  // Альтернативний метод з використанням or() та and()
  private async checkBossOrVariationActExistsWithOr(name: number): Promise<boolean> {
    try {
      // Правильний синтаксис з v9 Firestore для or() та and()
      const q = query(
        this.actsCollection,
        and(
          where('name', '==', name),
          or(
            where('type', '==', 'Boss_fight'),
            where('type', '==', 'Variation_fight')
          )
        )
      );

      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;

    } catch (error) {
      console.error('Помилка при перевірці з or():', error);
      throw error;
    }
  }

  // Допоміжний метод для конвертації документа Firestore в Act
  private convertToAct(doc: any): Act {
    try {
      const data = doc.data();

      // Видаляємо потенційне поле id з даних
      const { id: dataId, ...cleanData } = data;

      return {
        id: doc.id, // Використовуємо id документа Firestore
        ...cleanData,
      } as Act;
    } catch (error) {
      console.error('Помилка при конвертації документа:', error);
      throw error;
    }
  }

  private getTypeDisplayName(type: Fight_type): string {
    switch (type) {
      case 'Arcana_fight':
        return 'Arcana';
      case 'Boss_fight':
        return 'Boss акт';
      case 'Variation_fight':
        return 'Variation акт';
      default:
        return 'акт';
    }
  }

  private getConflictTypes(type: Fight_type): string {
    switch (type) {
      case 'Arcana_fight':
        return 'іншою Arcana';
      case 'Boss_fight':
        return 'Boss або Variation актом';
      case 'Variation_fight':
        return 'Boss або Variation актом';
      default:
        return 'іншим актом';
    }
  }

  async getActsByType(type: Fight_type): Promise<Act[]> {
    try {
      const q = query(this.actsCollection, where('type', '==', type));
      const querySnapshot = await getDocs(q);
      const acts: Act[] = [];

      querySnapshot.forEach((doc) => {
        acts.push(this.convertToAct(doc));
      });

      // Сортуємо за номером (опціонально)
      return acts.sort((a, b) => a.name - b.name);

    } catch (error) {
      console.error(`Помилка при отриманні актів типу ${type}:`, error);
      throw error;
    }
  }

  async getActsByNameAndTypes(name: number): Promise<Act[]> {
    try {
      // Отримуємо всі акти з заданим номером
      const q = query(this.actsCollection, where('name', '==', name));
      const querySnapshot = await getDocs(q);
      const acts: Act[] = [];

      querySnapshot.forEach((doc) => {
        acts.push(this.convertToAct(doc));
      });

      return acts;

    } catch (error) {
      console.error(`Помилка при отриманні актів з номером ${name}:`, error);
      throw error;
    }
  }

  async canAddAct(name: number, type: Fight_type): Promise<{ canAdd: boolean; message?: string }> {
    try {
      const exists = await this.checkActExists(name, type);

      if (exists) {
        const typeDisplay = this.getTypeDisplayName(type);
        const conflictTypes = this.getConflictTypes(type);
        return {
          canAdd: false,
          message: `Акт з номером ${name} вже існує конфлікт з ${conflictTypes}`
        };
      }

      // Додаткова перевірка на діапазон значень
      if (type === 'Arcana_fight' && (name < 1 || name > 2)) {
        return {
          canAdd: false,
          message: `Arcana має бути в діапазоні від 1 до 2`
        };
      }

      if ((type === 'Boss_fight' || type === 'Variation_fight') && (name < 1 || name > 14)) {
        return {
          canAdd: false,
          message: `Акт має бути в діапазоні від 1 до 14`
        };
      }

      return { canAdd: true };

    } catch (error) {
      console.error('Помилка при перевірці можливості додавання:', error);
      return {
        canAdd: false,
        message: 'Сталася помилка при перевірці. Спробуйте ще раз.'
      };
    }
  }

  // Метод для отримання унікальних номерів актів за типом
  async getUniqueActNumbersByType(type: Fight_type): Promise<number[]> {
    try {
      const acts = await this.getActsByType(type);
      const numbers = acts.map(act => act.name);
      // Повертаємо унікальні відсортовані номери
      return [...new Set(numbers)].sort((a, b) => a - b);

    } catch (error) {
      console.error(`Помилка при отриманні номерів актів типу ${type}:`, error);
      throw error;
    }
  }

  // Метод для перевірки, чи номер доступний для конкретного типу
  async isActNumberAvailable(name: number, type: Fight_type): Promise<boolean> {
    try {
      if (type === 'Arcana_fight') {
        // Для Arcana перевіряємо тільки Arcana акти
        const q = query(
          this.actsCollection,
          where('name', '==', name),
          where('type', '==', 'Arcana_fight')
        );
        const snapshot = await getDocs(q);
        return snapshot.empty;

      } else {
        // Для Boss/Variation перевіряємо обидва типи
        const q = query(
          this.actsCollection,
          where('name', '==', name),
          where('type', 'in', ['Boss_fight', 'Variation_fight'])
        );
        const snapshot = await getDocs(q);
        return snapshot.empty;
      }

    } catch (error) {
      console.error('Помилка при перевірці доступності номера:', error);
      throw error;
    }
  }

  // Метод для отримання акта за ID
  async getActById(id: string): Promise<Act | null> {
    try {
      // Отримуємо всі акти і шукаємо за ID
      const acts = await this.getAllActs();
      return acts.find(act => act.id === id) || null;

    } catch (error) {
      console.error(`Помилка при отриманні акта з ID ${id}:`, error);
      throw error;
    }
  }

  // Метод для видалення акта
  async deleteAct(id: string): Promise<void> {
    try {
      const actDoc = doc(this.firestore, 'acts', id);
      await deleteDoc(actDoc);
    } catch (error) {
      console.error('Помилка при видаленні акта:', error);
      throw error;
    }
  }

  // Метод для оновлення акта
  async updateAct(id: string, updates: Partial<Act>): Promise<void> {
    try {
      const actDoc = doc(this.firestore, 'acts', id);
      await updateDoc(actDoc, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Помилка при оновленні акта:', error);
      throw error;
    }
  }

  // У ActModsService
  getAllActsSorted(): Promise<Act[]> {
    return this.getAllActs().then(acts => {
      // Порядок типів
      const typeOrder = ['Variation_fight', 'Boss_fight', 'Arcana_fight'];

      // Групуємо за типами
      const actsByType: Record<string, Act[]> = {};

      acts.forEach(act => {
        if (!actsByType[act.type]) {
          actsByType[act.type] = [];
        }
        actsByType[act.type].push(act);
      });

      // Сортуємо всередині груп
      Object.values(actsByType).forEach(group => {
        group.sort((a, b) => a.name - b.name);
      });

      // Об'єднуємо в правильному порядку
      const sortedActs: Act[] = [];

      typeOrder.forEach(type => {
        if (actsByType[type]) {
          sortedActs.push(...actsByType[type]);
        }
      });

      return sortedActs;
    });
  }

  async createMode(mode: Mode): Promise<void> {
    try {
      const existingMode = await this.checkModeExists(mode.name);
      if (existingMode) {
        throw new Error(`Режим з назвою ${mode.name} вже існує`);
      }

      const modesCollection = collection(this.firestore, 'modes');
      const { id: modeId, ...modeData } = mode;

      await addDoc(modesCollection, {
        ...modeData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

    } catch (error) {
      console.error('Помилка при створенні режиму:', error);
      throw error;
    }
  }

  async checkModeExists(name: string): Promise<boolean> {
    try {
      const modesCollection = collection(this.firestore, 'modes');
      const q = query(modesCollection, where('name', '==', name));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Помилка при перевірці режиму:', error);
      throw error;
    }
  }

  async getAllModes(): Promise<Mode[]> {
    try {
      const modesCollection = collection(this.firestore, 'modes');
      const querySnapshot = await getDocs(modesCollection);
      const modes: Mode[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const { id: dataId, ...cleanData } = data;
        modes.push({
          id: doc.id,
          ...cleanData as any
        } as Mode);
      });

      return modes;
      return modes;
    } catch (error) {
      console.error('Помилка при отриманні режимів:', error);
      throw error;
    }
  }

  async deleteMode(id: string): Promise<void> {
    try {
      const modeDoc = doc(this.firestore, 'modes', id);
      await deleteDoc(modeDoc);
    } catch (error) {
      console.error('Помилка при видаленні режиму:', error);
      throw error;
    }
  }

  async updateMode(mode: Mode): Promise<void> {
    try {
      const modeDoc = doc(this.firestore, 'modes', mode.id);
      const { id: modeId, ...modeData } = mode;
      await updateDoc(modeDoc, {
        ...modeData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Помилка при оновленні режиму:', error);
      throw error;
    }
  }
  async updateModesByEnemyOptions(seasonDetails: Season_details): Promise<void> {
    try {
      const modes = await this.getAllModes();
      const seasonActsMap = new Map(seasonDetails.acts.map(act => [act.id, act]));
      const batch = writeBatch(this.firestore);
      let updatesCount = 0;

      for (const mode of modes) {
        let modeUpdated = false;
        // Check if any chamber in this mode needs updating
        const updatedChambers = mode.chambers.map(chamber => {
          if (chamber.id && seasonActsMap.has(chamber.id)) {
            const updatedAct = seasonActsMap.get(chamber.id)!;
            // Check for actual changes to avoid unnecessary writes? 
            // For now, assuming if it's in seasonDetails, we trust the sync request.
            // But strict equality check might be complex for objects.
            // Let's just update if ID matches as requested.
            modeUpdated = true;
            return { ...chamber, ...updatedAct };
          }
          return chamber;
        });

        if (modeUpdated) {
          const modeRef = doc(this.firestore, 'modes', mode.id);
          batch.update(modeRef, { 
            chambers: updatedChambers,
            updatedAt: new Date()
           });
          updatesCount++;
        }
      }

      if (updatesCount > 0) {
        await batch.commit();
        console.log(`Updated ${updatesCount} modes with new act data.`);
      }
    } catch (error) {
      console.error('Error updating modes by enemy options:', error);
      throw error;
    }
  }
}
