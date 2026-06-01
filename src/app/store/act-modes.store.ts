import { signal, computed, Injectable, inject, effect, InjectionToken } from '@angular/core';
import { Act, Mode } from '../../models/models';
import { IndexedDbUtil } from '@utils/indexed-db';
import { ActModsService } from '@shared/services/_index';

export const SKIP_ACT_MODES_LOAD = new InjectionToken<boolean>('SKIP_ACT_MODES_LOAD', {
  providedIn: 'root',
  factory: (): boolean => false,
});

@Injectable({
  providedIn: 'root',
})
export class ActModesStore {
  private actModsService = inject(ActModsService);
  private skipLoad = inject(SKIP_ACT_MODES_LOAD);
  private _isProcessingActs = false;
  private _isProcessingModes = false;

  /** ACTS */
  readonly acts = signal<Act[]>([]);
  /** MODES */
  readonly modes = signal<Mode[]>([]);

  constructor() {
    if (this.skipLoad) {
      return;
    }

    this.loadFromIndexedDb();

    // Listen for live updates
    effect(() => {
      const liveActs = this.actModsService.acts();
      if (liveActs.length > 0 && !this._isProcessingActs) {
        this._isProcessingActs = true;
        this.processActImages(liveActs).then(processed => {
          this.acts.set(processed);
          this._isProcessingActs = false;
        }).catch(() => {
          this._isProcessingActs = false;
        });
      }
    });

    effect(() => {
      const liveModes = this.actModsService.modes();
      if (liveModes.length > 0 && !this._isProcessingModes) {
        this._isProcessingModes = true;
        this.processModeImages(liveModes).then(processed => {
          this.modes.set(processed);
          this._isProcessingModes = false;
        }).catch(() => {
          this._isProcessingModes = false;
        });
      }
    });

    // Auto-persist to IDB
    effect(() => {
        this.saveToIndexedDb();
    });
  }

  private async saveToIndexedDb() {
    try {
      await IndexedDbUtil.set('ActsData', this.acts());
      await IndexedDbUtil.set('ModesData', this.modes());
    } catch (e) {
      console.error('Failed to save acts/modes to IndexedDB', e);
    }
  }

  private async loadFromIndexedDb() {
    try {
      const storedActs = await IndexedDbUtil.get<Act[]>('ActsData');
      if (storedActs) {
        this.acts.set(storedActs);
        // Фонове завантаження зображень
        this.processActImages(storedActs).then(processed => this.acts.set(processed));
      }
      const storedModes = await IndexedDbUtil.get<Mode[]>('ModesData');
      if (storedModes) {
        this.modes.set(storedModes);
        // Фонове завантаження зображень
        this.processModeImages(storedModes).then(processed => this.modes.set(processed));
      }
    } catch (e) {
      console.error('Failed to load acts/modes from IndexedDB', e);
    }
  }

  /** Process acts to cache enemy images */
  private async processActImages(acts: Act[]): Promise<Act[]> {
    return Promise.all(acts.map(async (act) => {
      const processedAct = { ...act };

      // Helper to process enemies
      const processEnemies = async (enemies: any[]) => {
        return Promise.all(enemies.map(async (enemy) => {
          const e = { ...enemy };
          const version = e.updatedAt;

          if (e.avatarUrl && !e.avatarUrl.startsWith('data:')) {
            try {
              e.avatarUrl = await IndexedDbUtil.loadImage(e.avatarUrl, `enemy_avatar:${e.id}`, version);
            } catch (err) {
              console.error(`Failed to cache avatar for enemy ${e.name}`, err);
            }
          }
          if (e.element?.iconUrl && !e.element.iconUrl.startsWith('data:')) {
             try {
               const newUrl = await IndexedDbUtil.loadImage(e.element.iconUrl, `element:${e.element.name}`, 'v1');
               e.element = { ...e.element, iconUrl: newUrl };
             } catch (err) {
               console.error(`Failed to cache element for enemy ${e.name}`, err);
             }
          }
           return e;
        }));
      };

      // 1. Enemy Selection
      if (processedAct.enemy_selection?.length) {
         processedAct.enemy_selection = await processEnemies(processedAct.enemy_selection);
      }

      // 2. Variations -> Waves -> Included Enemy
      if (processedAct.variations?.length) {
        processedAct.variations = await Promise.all(processedAct.variations.map(async (v) => {
           const processedVar = { ...v };
           if (processedVar.waves?.length) {
              processedVar.waves = await Promise.all(processedVar.waves.map(async (w) => {
                 const processedWave = { ...w };
                 if (processedWave.included_enemy?.length) {
                    processedWave.included_enemy = await processEnemies(processedWave.included_enemy);
                 }
                 return processedWave;
              }));
           }
           return processedVar;
        }));
      }

      return processedAct;
    }));
  }

  async setActs(acts: Act[]) {
    await IndexedDbUtil.set('ActsData', acts);
    this.acts.set(acts);
    const processed = await this.processActImages(acts);
    this.acts.set(processed);
  }

  async addAct(act: Act) {
    const [processed] = await this.processActImages([act]);
    this.acts.set([...this.acts(), processed]);
    this.saveToIndexedDb();
  }

  removeAct(id: string) {
    this.acts.set(this.acts().filter(a => a.id !== id));
    this.saveToIndexedDb();
  }

  async updateAct(act: Act) {
    const [processed] = await this.processActImages([act]);
    this.acts.set(
      this.acts().map(a => a.id === processed.id ? processed : a)
    );
    this.saveToIndexedDb();
  }

  /** MODES */

  /** Process modes to ensure their chambers (acts) have cached images */
  private async processModeImages(modes: Mode[]): Promise<Mode[]> {
      return Promise.all(modes.map(async (mode) => {
          const m = { ...mode };
          if (m.chambers?.length) {
              m.chambers = await this.processActImages(m.chambers);
          }
          return m;
      }));
  }

  async setModes(modes: Mode[]) {
    await IndexedDbUtil.set('ModesData', modes);
    this.modes.set(modes);
    const processed = await this.processModeImages(modes);
    this.modes.set(processed);
  }

  async addMode(mode: Mode) {
    const [processed] = await this.processModeImages([mode]);
    this.modes.set([...this.modes(), processed]);
    this.saveToIndexedDb();
  }

  removeMode(id: string) {
    this.modes.set(this.modes().filter(m => m.id !== id));
    this.saveToIndexedDb();
  }

  async updateMode(mode: Mode) {
    const [processed] = await this.processModeImages([mode]);
    this.modes.set(
      this.modes().map(m => m.id === processed.id ? processed : m)
    );
    this.saveToIndexedDb();
  }

  readonly hasActs = computed(() => this.acts().length > 0);
  readonly hasModes = computed(() => this.modes().length > 0);
}
