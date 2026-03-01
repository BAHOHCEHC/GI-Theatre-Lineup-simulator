import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnemiesService } from '@shared/services/_index';
import { EnemyEditorModal, ConfirmModal } from '@core/components/_index';
import { Enemy, EnemyGroup, ModalType } from '@models/models';

@Component({
  standalone: true,
  selector: 'app-enemy-editor',
  imports: [CommonModule, EnemyEditorModal, ConfirmModal],
  templateUrl: './enemy-editor.html',
  styleUrl: './enemy-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnemyEditor implements OnInit {
  private enemiesService = inject(EnemiesService);

  public categories = this.enemiesService.categories;
  public activeCategoryId = signal<string | null>(null);

  // Modal State
  public isEditorModalOpen = signal(false);
  public readonly editorModalType = signal<ModalType>('categories');
  public editorModalData = signal<any>(null);

  public isConfirmModalOpen = signal(false);
  public enemyToDeleteId = signal<string | null>(null);
  public groupToDeleteId = signal<string | null>(null);
  public categoryToDeleteId = signal<string | null>(null);
  public deleteContext = signal<'enemy' | 'group' | 'category' | null>(null);

  // Loading state
  public isLoading = signal(true);
  public error = signal<string | null>(null);

  // Derived state
  public activeCategory = computed(() =>
    this.categories().find((c) => c.id === this.activeCategoryId()),
  );

  public hasCategories = computed(() => this.categories().length > 0);

  public canAddGroup = computed(() => !!this.activeCategoryId());

  public canAddEnemy = computed(() => {
    const cat = this.activeCategory();
    return !!cat && cat.groups.length > 0;
  });

  public async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  public async loadData(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.enemiesService.loadAllData();

      // Auto-select first category if none is selected
      if (this.hasCategories() && !this.activeCategoryId()) {
        this.activeCategoryId.set(this.categories()[0].id);
      }
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  public openEnemiesUniversalModal(type: ModalType): void {
    this.editorModalType.set(type);

    // Очищаємо попередні дані
    this.editorModalData.set(null);

    // Підготовка даних для модалки
    const data: any = {};

    if (type === 'group' && this.activeCategoryId()) {
      data.categoryId = this.activeCategoryId();
      // Не встановлюємо title, щоб форма була порожньою
    } else if (type === 'enemy' && this.activeCategoryId()) {
      data.categoryId = this.activeCategoryId();
      // Не встановлюємо інші поля
    }

    this.editorModalData.set(data);
    this.isEditorModalOpen.set(true);
  }

  public async onSaveEditor(data: any): Promise<void> {
    try {
      const type = this.editorModalType();
      if (type === 'categories') {
        if (data.id) {
          // Edit existing category
          await this.enemiesService.updateCategory(data.id, { title: data.title });
        } else {
          // Create new category
          await this.enemiesService.addCategory(data.title);
          // Auto-select if first one
          if (this.categories().length === 1) {
            this.activeCategoryId.set(this.categories()[0].id);
          }
        }
      } else if (type === 'group') {
        if (data.id) {
          // Editing existing group
          await this.enemiesService.updateGroup(data.id, { title: data.title });
        } else {
          // Creating new group
          await this.enemiesService.addGroup(data.title, data.categoryId);
        }
      } else if (type === 'enemy') {
        await this.enemiesService.addEnemy({
          name: data.name,
          elementName: data.element,
          avatarUrl: data.avatarUrl,
          categoryId: data.categoryId,
          groupId: data.groupId,
        });
      }

      this.isEditorModalOpen.set(false);
      await this.loadData(); // Refresh data
    } catch (error) {
      console.error('Error saving data:', error);
      this.error.set('Failed to save data');
    }
  }

  public selectCategory(id: string): void {
    this.activeCategoryId.set(id);
  }

  // Edit Category
  public onEditCategory(catId: string): void {
    const category = this.categories().find((c) => c.id === catId);
    if (category) {
      this.editorModalType.set('categories');
      this.editorModalData.set({
        id: category.id,
        title: category.title,
      });
      this.isEditorModalOpen.set(true);
    }
  }
  // Edit Group
  public onEditGroup(group: EnemyGroup, categoryId: string): void {
    this.editorModalType.set('group');
    this.editorModalData.set({
      id: group.id, // Include ID for update
      title: group.title,
      categoryId: categoryId,
    });
    this.isEditorModalOpen.set(true);
  }

  // Delete Enemy
  public onDeleteEnemy(enemyId: string): void {
    this.deleteContext.set('enemy');
    this.enemyToDeleteId.set(enemyId);
    this.isConfirmModalOpen.set(true);
  }

  // Generic Delete Handler from Modal
  public onDeleteFromModal(): void {
    const data = this.editorModalData();
    const type = this.editorModalType();

    if (data && data.id) {
      this.isEditorModalOpen.set(false); // Close editor modal

      if (type === 'group') {
        this.deleteContext.set('group');
        this.groupToDeleteId.set(data.id);
        this.isConfirmModalOpen.set(true);
      } else if (type === 'categories') {
        this.deleteContext.set('category');
        this.categoryToDeleteId.set(data.id);
        this.isConfirmModalOpen.set(true);
      }
    }
  }

  public async confirmDelete(): Promise<void> {
    const context = this.deleteContext();

    try {
      if (context === 'enemy') {
        const id = this.enemyToDeleteId();
        if (id) {
          await this.enemiesService.deleteEnemy(id);
        }
      } else if (context === 'group') {
        const id = this.groupToDeleteId();
        if (id) {
          await this.enemiesService.deleteGroup(id);
        }
      } else if (context === 'category') {
        const id = this.categoryToDeleteId();
        if (id) {
          await this.enemiesService.deleteCategory(id);
          // Reset active category if deleted
          if (this.activeCategoryId() === id) {
            this.activeCategoryId.set(null);
          }
        }
      }

      this.isConfirmModalOpen.set(false);
      this.enemyToDeleteId.set(null);
      this.groupToDeleteId.set(null);
      this.deleteContext.set(null);
      await this.loadData(); // Refresh data
    } catch (error) {
      console.error(`Error deleting ${context}:`, error);
      this.error.set(`Failed to delete ${context}`);
    }
  }

  public getEnemiesForGroup(groupId: string): Enemy[] {
    return this.enemiesService.getEnemiesForGroup(groupId);
  }

  // Helper method for template
  public getCategoryGroups(categoryId: string): EnemyGroup[] {
    return this.enemiesService.getGroupsForCategory(categoryId);
  }

  // Refresh data
  public async refresh(): Promise<void> {
    await this.loadData();
  }
}
