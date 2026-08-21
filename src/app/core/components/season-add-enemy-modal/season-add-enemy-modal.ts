import { ChangeDetectionStrategy, Component, EventEmitter, Output, signal, inject, computed, effect, OnInit, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Act_options, Enemy, EnemyCategory, EnemyGroup, ElementTypeName, Enemy_options, Wave, Act, Variation } from '../../../../models/models';

@Component({
  selector: 'app-season-add-enemy-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './season-add-enemy-modal.html',
  styleUrl: './season-add-enemy-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonAddEnemyModal implements OnInit {
  public actOptions = input<Act_options>({});
  public categories = input<EnemyCategory[]>([]);
  public allEnemies = input<Enemy[]>([]);
  public initialEnemies = input<Enemy[]>([]);
  public initialOptions = input<Enemy_options>({});
  public currentAct = input<Act | null>(null);
  public currentVariation = input<Variation | null>(null);
  public currentWave = input<Wave | null>(null);

  @Output() public close = new EventEmitter<void>();
  @Output() public save = new EventEmitter<{
    enemies: Enemy[];
    options: {
      amount?: string;
      timer?: string;
      defeat?: string;
      special_type?: boolean;
    };
  }>();

  private fb = inject(FormBuilder);
  private initialized = signal(false);

  // Стан вибору
  public selectedCategoryId = signal<string | null>(null);

  public filteredGroups = computed(() => {
    const catId = this.selectedCategoryId();
    if (!catId) return [];
    const cat = this.categories().find(c => c.id === catId);
    return cat?.groups ?? [];
  });

  // Множинний вибір ворогів
  public selectedEnemies = signal<Enemy[]>([]);
  public hasSelectedEnemies = computed(() => this.selectedEnemies().length > 0);

  public ngOnInit(): void {
    console.log('--- SeasonAddEnemyModal Opened (Clean State) ---');

    // Always start fresh, just select the first valid category
    if (this.categories()?.length > 0) {
      const firstValid = this.categories().find(cat => !this.isCategoryEmpty(cat.id));
      if (firstValid) {
        this.selectedCategoryId.set(firstValid.id);
        this.initialized.set(true);
      }
    }

    // Lock timer if it exists in current variation
    const currentVar = this.currentVariation();
    const timerControl = this.form.get('timer');
    const defeatControl = this.form.get('defeat');


    if (currentVar?.timer && timerControl) {
      timerControl.setValue(currentVar.timer);
      timerControl.disable(); // 🔒 стартово заблокований
    }

    if (currentVar?.defeat && defeatControl) {
      defeatControl.setValue(currentVar.defeat);
      defeatControl.disable(); // 🔒 стартово заблокований
    }

  }

  constructor() { }

  // Форма для опцій (amount, timer тощо)
  public form = this.fb.group({
    amount: [''],
    timer: [this.currentVariation()?.timer],
    defeat: [this.currentVariation()?.defeat],
    special_type: [false],
  });

  // Чи категорія порожня
  public isCategoryEmpty(catId: string): boolean {
    const cat = this.categories().find(c => c.id === catId);
    if (!cat || !cat.groups || cat.groups.length === 0) return true;

    return !cat.groups.some(group =>
      this.allEnemies().some(e => e.groupId === group.id)
    );
  }

  public onSelectCategory(categoryId: string): void {
    if (this.isCategoryEmpty(categoryId)) return;
    this.selectedCategoryId.set(categoryId);
  }

  // Множинний вибір ворога
  // Одиничний вибір ворога
  public toggleEnemy(enemy: Enemy): void {
    this.selectedEnemies.update(current => {
      const exists = current.some(e => e.id === enemy.id);
      return exists ? [] : [enemy];
    });
  }

  // Чи вибраний конкретний ворог
  public isEnemySelected(enemy: Enemy): boolean {
    return this.selectedEnemies().some(e => e.id === enemy.id);
  }

  // Вороги в групі
  public enemiesByGroup(groupId: string): Enemy[] {
    return this.allEnemies().filter(e => e.groupId === groupId);
  }

  public getElementIconPath(type: ElementTypeName): string {
    return `assets/images/ElementType_${type}.png`;
  }

  public onSave(): void {
    this.form.markAllAsTouched();
    if (this.selectedEnemies().length === 0) return;

    const formValue = this.form.getRawValue();

    const opts = this.actOptions();
    const options = {
      amount: opts.amount ? formValue.amount || undefined : undefined,
      timer: opts.timerEnable ? formValue.timer || undefined : undefined,
      defeat: opts.defeat ? formValue.defeat || undefined : undefined,
      special_type: opts.special_type !== undefined
        ? !!formValue.special_type
        : undefined,
    };


    this.save.emit({
      enemies: this.selectedEnemies(),
      options,
    });
  }

  public onClose(): void {
    this.close.emit();
  }

  enableEditTimer(): void {
    const timerControl = this.form.get('timer');

    if (!timerControl) return;

    timerControl.enable();          // ✅ розблокувати
    timerControl.markAsTouched();
    timerControl.markAsDirty();
  }

}

