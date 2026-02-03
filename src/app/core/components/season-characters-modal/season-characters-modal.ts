import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Character, ElementTypeName, Enemy } from '../../../../models/models';
import { sortCharacters } from '../../../../utils/sorting-characters';
import { CharacterStore } from '@store/_index';

@Component({
  selector: 'app-season-characters-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './season-characters-modal.html',
  styleUrl: './season-characters-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonCharactersModal {
  private characterStore = inject(CharacterStore);
  @Input() public title: string = 'Select this season Characters';
  @Input() public type: string = 'season';
  @Input() public specialGuest: Character[] = [];

  // Dynamic limits
  @Input() public min: number = 0;
  @Input() public max: number = 0;
  @Input() public mode: string = 'lineup';

  @Input() public allCharacters: Character[] = [];

  // Forced filters (e.g. from Season settings)
  @Input() public forcedElements: ElementTypeName[] = [];

  @Input() public set startSelection(value: Character[]) {
    this.currentSelection.set(new Set(value.map((c) => c.id)));
  }

  @Output() public close = new EventEmitter<void>();
  @Output() public save = new EventEmitter<Character[]>();

  public readonly elementTypes: ElementTypeName[] = [
    'pyro',
    'hydro',
    'electro',
    'cryo',
    'dendro',
    'anemo',
    'geo',
  ];

  public activeElementFilters = signal<Set<ElementTypeName>>(new Set());
  public currentSelection = signal<Set<string>>(new Set());

  // Комп'ютед властивість для визначення, чи потрібно затемнювати неактивні фільтри
  public shouldDimInactiveFilters = computed(() => {
    const filtersCount = this.activeElementFilters().size;
    // Затемнюємо тільки якщо є хоча б один активний фільтр
    return filtersCount > 0;
  });

  // Комп'ютед властивість для визначення, чи потрібно затемнювати неактивних персонажів
  public shouldDimInactiveCharacters = computed(() => {
    const selectionCount = this.currentSelection().size;
    // Затемнюємо всіх персонажів, якщо є хоча б один обраний
    return selectionCount > 0;
  });

  public effectiveMax = computed(() => {
    if (this.mode === 'opening') return 6;
    if (this.mode === 'special') return 4;
    return this.max;
  });

  public effectiveMin = computed(() => {
    if (this.mode === 'opening') return 6;
    if (this.mode === 'special') return 4;
    return this.min;
  });

  public filteredCharacters = computed(() => {
    let filters = this.activeElementFilters();

    // Merge with forced filters if any
    if (this.forcedElements.length > 0) {
      // If user filters are empty, show only forced? Or intersect?
      // Logic: User can select subsets of forced elements, or if no user filter, show all forced.
      // Usually forced means "Only these allowed".
      // Let's assume forcedElements restricts the pool.

      const forcedSet = new Set(this.forcedElements);
      if (filters.size === 0) {
        filters = forcedSet;
      } else {
        // Intersect
        const intersected = new Set<ElementTypeName>();
        for (const f of filters) {
          if (forcedSet.has(f)) intersected.add(f);
        }
        filters = intersected;
      }
    }

    if (filters.size === 0) {
      if (this.forcedElements.length > 0) {
        return sortCharacters(
          this.allCharacters.filter(
            (c) => c.element && this.forcedElements.includes(c.element.name),
          ),
        );
      }
      return sortCharacters(this.allCharacters);
    }
    return sortCharacters(
      this.allCharacters.filter((c) => c.element && c.element.name && filters.has(c.element.name)),
    );
  });

  public selectionCount = computed(() => this.currentSelection().size);

  public isSaveDisabled = computed(() => {
    if (this.type === 'lineup') {
      return this.selectionCount() < this.min;
    }
    return false;
  });

  public toggleElementFilter(type: ElementTypeName): void {
    // If forced elements exist, only allow toggling those?
    // For now, let's just let the computed property handle the actual filtering of characters.
    const filters = new Set(this.activeElementFilters());
    if (filters.has(type)) {
      filters.delete(type);
    } else {
      filters.add(type);
    }
    this.activeElementFilters.set(filters);
  }

  public toggleCharacter(charId: string): void {
    const current = new Set(this.currentSelection());
    const limit = this.effectiveMax();

    if (current.has(charId)) {
      current.delete(charId);
    } else {
      // Check if limit applies
      if (this.mode === 'season' || current.size < limit) {
        current.add(charId);
      } else {
        console.warn(`Cannot select character ${charId}: max limit of ${limit} reached for mode ${this.mode}.`);
      }
    }

    this.currentSelection.set(current);
  }

  public isCharacterSelected(charId: string): boolean {
    return this.currentSelection().has(charId);
  }

  public getElementIconPath(type: ElementTypeName): string {
    return `assets/images/ElementType_${type}.png`;
  }

  public resolveAvatarUrl(item: string | Character | Enemy | null | undefined): string {
    if (!item) return 'assets/images/avatar_placeholder.png';

    // Priority: 1. Direct URL on object, 2. Map lookup by ID
    if (typeof item !== 'string' && item.avatarUrl) {
      return item.avatarUrl;
    }

    const id = typeof item === 'string' ? item : item.id;

    return (
      this.charactersMap().get(id) ||
      'assets/images/avatar_placeholder.png'
    );
  }
  // --- Helpers ---
  private charactersMap = computed(
    () => new Map(this.characterStore.allCharacters().map((c) => [c.id, c.avatarUrl])),
  );

  public onSave(): void {
    const selectedIds = this.currentSelection();
    const charMap = new Map([
      ...this.allCharacters.map((c) => [c.id, c] as [string, Character]),
      ...this.specialGuest.map((c) => [c.id, c] as [string, Character]),
    ]);
    const selectedChars: Character[] = [];

    for (const id of selectedIds) {
      const char = charMap.get(id);
      if (char) {
        selectedChars.push(char);
      }
    }

    this.save.emit(selectedChars);
  }

  public onClose(): void {
    this.close.emit();
  }
}
