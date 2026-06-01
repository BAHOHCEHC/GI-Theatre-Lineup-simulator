import {
  Component,
  computed,
  Input,
  Signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Character, ElementTypeName } from '@models/models';
import { CharacterStore } from '@store/_index';

@Component({
  standalone: true,
  selector: 'app-character-grid',
  imports: [CommonModule],
  templateUrl: './character-grid.html',
  styleUrl: './character-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterGridComponent {
  protected readonly characterStore = inject(CharacterStore);

  /** Вхідні дані */
  @Input({ required: true }) characters!: Signal<Character[]>;
  @Input() activeElements!: Signal<Set<ElementTypeName>>;

  /** ФІЛЬТРАЦІЯ ПІСЛЯ РЕНДЕРА */
  readonly visibleCharacters = computed(() => {
    const chars = this.characters();
    const filters = this.activeElements();

    if (!filters || filters.size === 0) return chars;

    return chars.filter(c => c.element && filters.has(c.element.name));
  });

  readonly hasSelection = computed(() => this.characterStore.hasSelection());

  public readonly isAllVisibleSelected = computed<boolean>(() => {
    const visible = this.visibleCharacters();
    if (visible.length === 0) return false;
    return visible.every((c) => this.isSelected(c));
  });

  public readonly isNoneVisibleSelected = computed<boolean>(() => {
    const visible = this.visibleCharacters();
    return visible.every((c) => !this.isSelected(c));
  });

  now = Date.now();

  public toggle(char: Character): void {
    this.characterStore.toggleCharacter(char);
  }

  public isSelected(char: Character): boolean {
    return this.characterStore.isSelected(char);
  }

  public onSelectAll(): void {
    const chars = this.visibleCharacters();
    this.characterStore.updateSelectedCharacters(chars.map((c) => c.id));
  }

  public onClearAll(): void {
    const chars = this.visibleCharacters();
    this.characterStore.clearSelectedCharacters(chars.map((c) => c.id));
  }
}
