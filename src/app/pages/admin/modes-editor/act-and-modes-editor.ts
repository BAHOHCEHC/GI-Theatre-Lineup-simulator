import { ChangeDetectionStrategy, Component, effect, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActModal } from './acts/act-modal/act-modal';
import { ActsTable } from './acts/acts-table/acts-table';
import { ModesTable } from './modes/modes-table/modes-table';
import { ModeModal } from './modes/modes-modal/modes-modal';
import { ActModsService } from '@shared/services/_index';
// Update imports to include Mode
import { Act, Mode } from '@models/models';
import { ConfirmModal } from '@core/components/_index';
import { ActModesStore, SKIP_ACT_MODES_LOAD } from '@store/_index';

@Component({
  selector: 'app-act-and-modes-editor',
  standalone: true,
  imports: [
    CommonModule,
    ActsTable,
    ModesTable,
    ActModal,
    ModeModal,
    ConfirmModal
  ],
  providers: [
    ActModesStore,
    { provide: SKIP_ACT_MODES_LOAD, useValue: true }
  ],
  templateUrl: './act-and-modes-editor.html',
  styleUrls: ['./act-and-modes-editor.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActAndModesEditor implements OnInit {
  private service = inject(ActModsService);

  loading = signal(false);
  loadingModes = signal(false); // New signal for modes loading state
  acts: Act[] = [];
  modes: Mode[] = []; // Property to hold modes
  error: string | null = null;
  errorModes: string | null = null; // Property for modes error

  readonly showActModal = signal(false);
  readonly showModeModal = signal(false);
  readonly showConfirmModal = signal(false);
  readonly editingAct = signal<Act | null>(null);
  readonly editingMode = signal<Mode | null>(null);
  readonly deletingItem = signal<{ type: 'act' | 'mode', data: any } | null>(null);

  constructor() {
    effect(() => {
      const showActModalValue = this.showActModal();

      // Завантажуємо акти тільки після закриття модалки
      if (!showActModalValue) {
        // Додаємо невелику затримку, щоб уникнути конфліктів
        setTimeout(() => {
          this.loadActs();
        }, 100);
        this.editingAct.set(null);
      }
    });

    // Effect for Mode modal
    effect(() => {
      const showModeModalValue = this.showModeModal();
      if (!showModeModalValue) {
        setTimeout(() => {
          this.loadModes();
        }, 100);
        this.editingMode.set(null);
      }
    });
  }

  ngOnInit(): void {
    // Завантажуємо дані при ініціалізації
    this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    await Promise.all([
      this.loadActs(),
      this.loadModes()
    ]);
  }

  private async loadModes(): Promise<void> {
    if (this.loadingModes()) return;
    this.loadingModes.set(true);
    this.errorModes = null;
    try {
      this.modes = await this.service.getAllModes();
      console.log('Loaded modes:', this.modes.length);
    } catch (error: any) {
      console.error('Error loading modes:', error);
      this.errorModes = error.message || 'Error loading modes';
    } finally {
      this.loadingModes.set(false);
    }
  }

  async loadActs(): Promise<void> {
    // Перевіряємо, чи вже завантажується
    if (this.loading()) {
      console.log('Завантаження вже виконується, пропускаємо');
      return;
    }
    this.loading.set(true);
    this.error = null;

    try {
      this.acts = await this.service.getAllActsSorted();
      console.log('Loaded acts:', this.acts.length);
    } catch (error: any) {
      this.error = error.message;
      console.error('Error loading acts:', error);
    } finally {
      this.loading.set(false);
    }
  }

  openActModal(): void {
    this.showActModal.set(true);
    this.showModeModal.set(false);
  }

  openModeModal(): void {
    this.showModeModal.set(true);
    this.showActModal.set(false);
  }

  closeActModal(): void {
    this.showActModal.set(false);
  }

  closeModeModal(): void {
    this.showModeModal.set(false);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.deletingItem.set(null);
  }

  // Обробка видалення акта
  onDeleteAct(act: Act): void {
    this.deletingItem.set({
      type: 'act',
      data: act
    });
    this.showConfirmModal.set(true);
  }

  // Обробка видалення мода
  onDeleteMode(mode: any): void {
    this.deletingItem.set({
      type: 'mode',
      data: mode
    });
    this.showConfirmModal.set(true);
  }

  // Підтвердження видалення
  async onConfirmDelete(): Promise<void> {
    const item = this.deletingItem();
    if (!item) return;
    try {
      if (item.type === 'act') {
        // Видалити акт
        await this.service.deleteAct(item.data.id);
        console.log('Act deleted:', item.data.id);
      } else if (item.type === 'mode') {
        // Видалити мод
        await this.service.deleteMode(item.data.id);
        console.log('Mode deleted:', item.data.id);
      }

      // Оновити дані
      if (item.type === 'act') {
        await this.loadActs();
      } else {
        await this.loadModes();
      }

      // Закрити модалку
      this.closeConfirmModal();
    } catch (error) {
      console.error('Error deleting item:', error);
      // Можна додати повідомлення про помилку
    }
  }
  // Додайте ці методи в ActAndModesEditor

  // Допоміжний метод для отримання назви елемента
  private getItemDisplayName(item: Act | any, type: 'act' | 'mode'): string {
    if (type === 'act') {
      const act = item as Act;
      return act.type === 'Arcana_fight'
        ? `Arcana ${act.name}`
        : `Act ${act.name}`;
    } else {
      return `Mode ${item.name || ''}`.trim();
    }
  }

  // Тепер методи стають простішими
  getConfirmTitle(): string {
    const item = this.deletingItem();
    if (!item) return 'Confirm Delete';

    const displayName = this.getItemDisplayName(item.data, item.type);
    return `Delete ${displayName}`;
  }

  getConfirmMessage(): string {
    const item = this.deletingItem();
    if (!item) return 'Are you sure you want to delete this item?';

    const displayName = this.getItemDisplayName(item.data, item.type);
    return `Are you sure you want to delete ${displayName}? This action cannot be undone.`;
  }

  // Допоміжний метод для відображення типу акта
  private getActTypeDisplay(type: string): string {
    switch (type) {
      case 'Boss_fight': return 'Boss';
      case 'Variation_fight': return 'Variation';
      case 'Arcana_fight': return 'Arcana';
      default: return type;
    }
  }


  onEditAct(act: Act): void {
    this.editingAct.set(act);
    this.showActModal.set(true);
  }

  onEditMode(mode: Mode): void {
    this.editingMode.set(mode);
    this.showModeModal.set(true);
  }

  // Метод для ручного оновлення (через кнопку Refresh)
  async onRefresh(): Promise<void> {
    await this.loadInitialData();
  }
}
