import { Injectable, inject, signal, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
  setDoc,
  onSnapshot
} from '@angular/fire/firestore';
import {
  Region,
  Region_task
} from '../../../models/models';
@Injectable({
  providedIn: 'root',
})


export class TasksService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  // State signals
  private _regions = signal<Region[]>([]);
  private _tasks = signal<Region_task[]>([]);

  // Public readonly signals
  public regions = this._regions.asReadonly();
  public tasks = this._tasks.asReadonly();

  constructor() {
    this.subscribeToData();
  }

  private subscribeToData() {
    const regionsRef = collection(this.firestore, 'regions');
    onSnapshot(query(regionsRef, orderBy('createdAt', 'desc')), (snapshot) => {
        const regions = snapshot.docs.map(doc => this.convertToRegion(doc)).reverse();
        this._regions.set(regions);
    });

    const tasksRef = collection(this.firestore, 'region_tasks');
    onSnapshot(query(tasksRef, orderBy('createdAt', 'desc')), (snapshot) => {
        const tasks = snapshot.docs.map(doc => this.convertToTaks(doc));
        this._tasks.set(tasks);
    });
  }


  // ========== LOAD ALL DATA ==========
  async loadAllData(): Promise<void> {
    try {
      await Promise.all([
        this.loadRegions(),
        this.loadRegionTasks(),
      ]);
    } catch (error) {
      console.error('Error loading all data:', error);
      throw error;
    }
  }

  // ========== REGIONS ==========
  async loadRegions(): Promise<void> {
    try {
      const regionsRef = collection(this.firestore, 'regions');
      const q = query(regionsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await runInInjectionContext(this.injector, () => getDocs(q));

      const regions = querySnapshot.docs.map(doc =>
        this.convertToRegion(doc)
      ).reverse();

      this._regions.set(regions);
    } catch (error) {
      console.error('Error loading regions:', error);
      throw error;
    }
  }

  // ========== TASKS ==========
  async loadRegionTasks(): Promise<void> {
    try {
      const groupsRef = collection(this.firestore, 'region_tasks');
      const q = query(groupsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await runInInjectionContext(this.injector, () => getDocs(q));

      const region_tasks = querySnapshot.docs.map(doc =>
        this.convertToTaks(doc)
      );

      this._tasks.set(region_tasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      throw error;
    }
  }

  private convertToTaks(doc: any): Region_task {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.title || '',
      regionId: data.categoryId || '',
      achiviment: data.achiviment,
      youtubeLink: data.youtubeLink,
      taskSeries: data.taskSeries,
      parts: data.parts,
      finished: data.finished,
      updatedAt: data.updatedAt
    };
  }


  // Helper methods to convert Firestore documents
  private convertToRegion(doc: any): Region {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || '',
      tasks: []
    };
  }

  // ========== REGION CRUD ==========
  async createRegion(region: Region): Promise<void> {
    try {
      const regionData = {
        name: region.name,
        createdAt: new Date().toISOString()
      };

      if (region.id) {
        await setDoc(doc(this.firestore, 'regions', region.id), regionData);
      } else {
        await addDoc(collection(this.firestore, 'regions'), regionData);
      }

      await this.loadRegions();
    } catch (error) {
      console.error('Error creating region:', error);
      throw error;
    }
  }

  async updateRegion(region: Region): Promise<void> {
    try {
      if (!region.id) throw new Error('Region ID is missing');
      const docRef = doc(this.firestore, 'regions', region.id);
      await updateDoc(docRef, {
        name: region.name,
        updatedAt: new Date().toISOString()
      });
      await this.loadRegions();
    } catch (error) {
      console.error('Error updating region:', error);
      throw error;
    }
  }

  async deleteRegion(id: string): Promise<void> {
    try {
      const batch = writeBatch(this.firestore);

      // Delete region
      const regionRef = doc(this.firestore, 'regions', id);
      batch.delete(regionRef);

      // Delete all tasks in this region
      const tasksRef = collection(this.firestore, 'region_tasks');
      const q = query(tasksRef, where('categoryId', '==', id));
      const snapshot = await runInInjectionContext(this.injector, () => getDocs(q));

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      await Promise.all([
        this.loadRegions(),
        this.loadRegionTasks()
      ]);
    } catch (error) {
      console.error('Error deleting region:', error);
      throw error;
    }
  }

  // ========== TASK CRUD ==========
  async createTask(task: Region_task): Promise<void> {
    try {
      const taskData = {
        title: task.name,
        categoryId: task.regionId,
        achiviment: task.achiviment || '',
        youtubeLink: task.youtubeLink || '',
        taskSeries: task.taskSeries || false,
        parts: task.parts || [],
        finished: task.finished || false,
        createdAt: new Date().toISOString()
      };

      if (task.id) {
        await setDoc(doc(this.firestore, 'region_tasks', task.id), taskData);
      } else {
        await addDoc(collection(this.firestore, 'region_tasks'), taskData);
      }

      await this.loadRegionTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async updateTask(task: Region_task): Promise<void> {
    try {
      if (!task.id) throw new Error('Task ID is missing');
      const docRef = doc(this.firestore, 'region_tasks', task.id);

      const taskData = {
        title: task.name,
        categoryId: task.regionId,
        achiviment: task.achiviment || '',
        youtubeLink: task.youtubeLink || '',
        taskSeries: task.taskSeries || false,
        parts: task.parts || [],
        finished: task.finished || false,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(docRef, taskData);
      await this.loadRegionTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async deleteTask(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'region_tasks', id);
      await deleteDoc(docRef);
      await this.loadRegionTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }
}
