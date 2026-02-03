import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Act, Season_details } from '@models/models';
import { SeasonService } from '@shared/services/_index';

@Injectable({ providedIn: 'root' })
export class SeasonDetailsStore {
  private seasonService = inject(SeasonService);
  private _isRefreshing = false;

  readonly seasonDetails = signal<Season_details | null>(null);

  readonly hasData = computed(() => !!this.seasonDetails());

  constructor() {
    this.loadFromLocalStorage();

    // Слухаємо реальний час з сервісу
    effect(() => {
      const liveData = this.seasonService.seasonDetails();
      if (liveData && !this._isRefreshing) {
        // Ми не можемо просто завантажити liveData, бо в сервісі акти не змержені
        // тому запускаємо refreshDetails при зміні даних на сервері
        this.refreshDetails();
      }
    });

    // Auto-save on change
    effect(() => {
      this.saveToLocalStorage();
    });
  }

  // --- Actions ---

  setDetails(details: Season_details) {
    this.seasonDetails.set(details);
  }

  async loadDetailsIfNeeded() {
    // Показати кеш відразу (вже завантажений в constructor), 
    // але ЗАВЖДИ оновити з сервера у фоні
    await this.refreshDetails();
  }

  async refreshDetails() {
    if (this._isRefreshing) return;
    this._isRefreshing = true;
    try {
      const details = await this.seasonService.loadSeasonDetails();
      const allActs = await this.seasonService.getAllActs();

    let finalDetails: Season_details;

    if (details) {
      if (details.acts && details.acts.length > 0) {
        const mergedActs = allActs.map((dbAct) => {
          const savedAct = details.acts.find((a) => a.id === dbAct.id);
          if (savedAct) {
            return { ...dbAct, ...savedAct };
          }
          return dbAct;
        });
        finalDetails = { ...details, acts: mergedActs };
      } else {
        finalDetails = { ...details, acts: allActs };
      }
    } else {
      finalDetails = {
        elemental_type_limided: [],
        opening_characters: [],
        special_guests: [],
        acts: allActs
      };
    }

    this.seasonDetails.set(finalDetails);
    this._isRefreshing = false;
    } catch (e) {
      console.error('Failed to refresh details', e);
      this._isRefreshing = false;
    }
  }

  // --- Persistence ---

  private saveToLocalStorage() {
    const data = this.seasonDetails();
    if (data) {
      localStorage.setItem('SeasonDetails', JSON.stringify(data));
    }
  }

  private loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('SeasonDetails');
      if (stored) {
        this.seasonDetails.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load SeasonDetails from LS', e);
    }
  }
}
