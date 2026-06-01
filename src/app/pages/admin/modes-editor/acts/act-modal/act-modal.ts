import { Component, EventEmitter, Output, inject, computed, signal, effect, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidatorFn
} from '@angular/forms';
import { Fight_type, Act, Enemy_options, Variation_fight } from '@models/models';
import { ActModsService } from '@shared/services/_index';
import { toSignal } from '@angular/core/rxjs-interop';
import { generateUUID } from '@shared/utils/uuid';

@Component({
  selector: 'app-act-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './act-modal.html',
  styleUrls: ['./act-modal.scss'],
})
export class ActModal implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  // Додаємо Input для передачі акта для редагування
  @Input() actToEdit: Act | null = null;

  private fb = inject(FormBuilder);
  private service = inject(ActModsService);

  // Стани
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);
  isEditMode = signal(false);
  originalActName = signal<number | null>(null); // Зберігаємо оригінальне ім'я для перевірки

  // ---------- FORM ----------
  readonly form = this.fb.group({
    type: this.fb.nonNullable.control<Fight_type>('Variation_fight'),

    name: this.fb.control<number | null>(null, {
      validators: [],
      updateOn: 'blur'
    }),

    options: this.fb.group({
      amount: false,
      timerEnable: false,
      defeat: false,
      special_type: false,
    }),
  });

  readonly typeSignal = toSignal(
    this.form.controls.type.valueChanges,
    { initialValue: this.form.controls.type.value }
  );

  // Визначаємо заголовок модалки
  readonly modalTitle = computed(() =>
    this.isEditMode() ? 'Edit Act' : 'Add Act'
  );

  // ---------- LIFECYCLE ----------
  ngOnInit(): void {
    if (this.actToEdit) {
      this.isEditMode.set(true);
      this.originalActName.set(this.actToEdit.name);
      this.patchFormWithAct(this.actToEdit);
    }
  }

  private patchFormWithAct(act: Act): void {
    this.form.patchValue({
      type: act.type,
      name: act.name,
      options: {
        amount: act.options.amount,
        timerEnable: act.options.timerEnable,
        defeat: act.options.defeat,
        special_type: act.options.special_type,
      }
    });
  }

  // ---------- EFFECT ДЛЯ ДИНАМІЧНОЇ ВАЛІДАЦІЇ ----------
  constructor() {
    effect(() => {
      const type = this.typeSignal();
      const nameControl = this.form.controls.name;
      const maxVal = type === 'Arcana_fight' ? 2 : 14;

      // Видаляємо старі валідатори
      nameControl.clearValidators();
      nameControl.setErrors(null);

      // Створюємо кастомний валідатор для перевірки діапазону
      const rangeValidator = this.createRangeValidator(1, maxVal, type);

      if (type === 'Arcana_fight') {
        // Для Arcana_fight: максимум 2, не обов'язкове
        nameControl.setValidators([
          rangeValidator,
          Validators.pattern('^[0-9]*$')
        ]);
      } else {
        // Для інших типів: від 1 до 14, обов'язкове
        nameControl.setValidators([
          Validators.required,
          rangeValidator,
          Validators.pattern('^[0-9]*$')
        ]);
      }


      if (type === 'Variation_fight') {
        this.form.controls.options.controls.defeat.disable({ emitEvent: false });
      } else {
        this.form.controls.options.controls.defeat.enable({ emitEvent: false });
      }

      nameControl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    });
  }

  // ---------- COMPUTED ----------
  readonly actLabel = computed(() =>
    this.typeSignal() === 'Arcana_fight' ? 'Arcana' : 'Act'
  );

  readonly maxValue = computed(() => {
    return this.typeSignal() === 'Arcana_fight' ? 2 : 14;
  });

  // Перевірка, чи значення в діапазоні
  readonly isNameInRange = computed(() => {
    const value = this.form.controls.name.value;
    const maxVal = this.maxValue();

    if (value === null || value === undefined) {
      return true;
    }

    return value >= 1 && value <= maxVal;
  });

  // Додаткова перевірка для кнопки
  readonly isNameValidForSave = computed(() => {
    const control = this.form.controls.name;
    const value = control.value;

    if (value === null || value === undefined) {
      return this.typeSignal() === 'Arcana_fight';
    }

    const maxVal = this.maxValue();
    return value >= 1 && value <= maxVal && !control.errors?.['pattern'];
  });

  // Чи змінилося ім'я акта при редагуванні
  readonly isNameChanged = computed(() => {
    if (!this.isEditMode() || !this.originalActName()) return false;
    const currentName = this.form.controls.name.value;
    return currentName !== null && currentName !== this.originalActName();
  });

  // ---------- КАСТОМНІ ВАЛІДАТОРИ ----------
  private createRangeValidator(min: number, max: number, type: Fight_type): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const value = control.value;

      if (value === null || value === undefined || value === '') {
        return null;
      }

      const numValue = Number(value);

      if (isNaN(numValue)) {
        return { 'notANumber': true };
      }

      if (!Number.isInteger(numValue)) {
        return { 'notInteger': true };
      }

      if (numValue < min) {
        return { 'min': { requiredMin: min, actual: numValue } };
      }

      if (numValue > max) {
        return { 'max': { requiredMax: max, actual: numValue } };
      }

      return null;
    };
  }

  // ---------- МЕТОДИ ----------
  onNameChange(): void {
    this.errorMessage.set(null);

    const value = this.form.controls.name.value;
    const maxVal = this.maxValue();

    if (value !== null && value < 1) {
      this.form.controls.name.setErrors({ 'min': { requiredMin: 1, actual: value } });
    } else if (value !== null && value > maxVal) {
      this.form.controls.name.setErrors({ 'max': { requiredMax: maxVal, actual: value } });
    } else {
      const currentErrors = this.form.controls.name.errors;
      if (currentErrors) {
        const { min, max, ...otherErrors } = currentErrors;
        this.form.controls.name.setErrors(Object.keys(otherErrors).length ? otherErrors : null);
      }
    }
  }

  // ---------- SAVE ----------
  async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.errorMessage.set(null);

    // Перевіряємо валідність форми
    if (this.form.invalid) {
      this.showFormErrors();
      return;
    }

    const { type, name } = this.form.getRawValue();

    // Додаткова перевірка діапазону
    if (name !== null) {
      const maxVal = type === 'Arcana_fight' ? 2 : 14;

      if (name < 1) {
        this.errorMessage.set('Значення не може бути менше 1');
        this.form.controls.name.setErrors({ 'min': true });
        return;
      }

      if (name > maxVal) {
        this.errorMessage.set(`Значення не може бути більше ${maxVal}`);
        this.form.controls.name.setErrors({ 'max': true });
        return;
      }
    }

    // Встановлюємо стан завантаження
    this.isLoading.set(true);

    try {
      // Якщо це редагування і ім'я змінилося - перевіряємо унікальність
      // Або якщо це створення нового акта
      if ((this.isEditMode() && this.isNameChanged()) || !this.isEditMode()) {
        if (name !== null) {
          const validationResult = await this.service.canAddAct(name, type!);

          if (!validationResult.canAdd) {
            this.errorMessage.set(validationResult.message!);
            this.form.controls.name.setErrors({ duplicate: true });
            return;
          }
        }
      }

      // Створюємо або оновлюємо акт
      const value = this.form.getRawValue();

      // Визначаємо defeat: для Variation_fight завжди false
      const defeatValue: boolean = type === 'Variation_fight'
        ? false
        : (value.options.defeat ? true : false);

      const act: Act = {
        id: this.actToEdit?.id ?? generateUUID(), // Використовуємо існуючий ID при редагуванні
        name: value.name ?? 1,
        type: type!,
        options: {
          amount: value.options.amount ? true : false,
          timerEnable: value.options.timerEnable ? true : false,
          defeat: defeatValue,
          special_type: value.options.special_type ? true : false,
        },
        variation_fight_settings: this.actToEdit?.variation_fight_settings || {} as Variation_fight,
        enemy_selection: this.actToEdit?.enemy_selection || [],
        variations: this.actToEdit?.variations || [],
        enemy_options: this.actToEdit?.enemy_options || {} as Enemy_options,
      };

      // Викликаємо відповідний метод сервісу
      if (this.isEditMode()) {
        await this.updateAct(act);
      } else {
        await this.service.createAct(act);
      }

      this.saved.emit();
      this.close.emit();

    } catch (error: any) {
      console.error('Помилка при збереженні:', error);

      if (error.message.includes('вже існує') || error.message.includes('конфліктує')) {
        this.errorMessage.set(error.message);
        this.form.controls.name.setErrors({ duplicate: true });
      } else {
        this.errorMessage.set('Сталася помилка при збереженні. Спробуйте ще раз.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private async updateAct(act: Act): Promise<void> {
    try {
      // Якщо сервіс має метод updateAct - використовуємо його
      // Альтернатива: видалити старий і додати новий
      await this.service.updateAct(act.id, act)
    } catch (error) {
      throw error;
    }
  }

  private showFormErrors(): void {
    const nameControl = this.form.controls.name;

    if (nameControl.errors) {
      if (nameControl.errors['required']) {
        this.errorMessage.set('Act number обов\'язковий');
      } else if (nameControl.errors['min']) {
        const minVal = nameControl.errors['min'].requiredMin || 1;
        this.errorMessage.set(`Значення має бути не менше ${minVal}`);
      } else if (nameControl.errors['max']) {
        const maxVal = nameControl.errors['max'].requiredMax || this.maxValue();
        this.errorMessage.set(`Значення має бути не більше ${maxVal}`);
      } else if (nameControl.errors['pattern'] || nameControl.errors['notANumber']) {
        this.errorMessage.set('Введіть тільки цифри');
      } else if (nameControl.errors['notInteger']) {
        this.errorMessage.set('Введіть ціле число');
      } else if (nameControl.errors['duplicate']) {
        this.errorMessage.set('Акт з таким номером вже існує');
      }
    }
  }

  cancel(): void {
    this.close.emit();
  }

  // Допоміжний метод для отримання типу у читабельному форматі
  getTypeDisplay(type: Fight_type): string {
    switch (type) {
      case 'Boss_fight': return 'Boss';
      case 'Variation_fight': return 'Variation';
      case 'Arcana_fight': return 'Arcana';
      default: return type;
    }
  }
}
