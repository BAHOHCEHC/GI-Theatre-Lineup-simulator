import { CharacterGridComponent } from '@shared/components/character-grid.component/character-grid';
import { ChangeDetectionStrategy, Component, signal, computed, OnInit, inject } from '@angular/core';
import { ElementTypeName } from '@models/models';
import { sortCharacters } from '@utils/sorting-characters';
import { CharacterStore } from '@store/_index';
import { CharacterService } from '@shared/services/_index';

@Component({
  selector: 'app-your-characters',
  standalone: true,
  imports: [CharacterGridComponent],
  templateUrl: './your-characters.html',
  styleUrls: ['./your-characters.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YourCharacters implements OnInit {
  private characterService = inject(CharacterService);
  public readonly characterStore = inject(CharacterStore);

  public isLoading = signal(true);

  readonly elementTypes = [
    'pyro', 'hydro', 'electro', 'cryo', 'dendro', 'anemo', 'geo'
  ] as const;

  readonly charactersPanelOpened = signal(false);
  readonly filtersWereUsed = signal(false);

  readonly hasSelectedCharacters = computed(() =>
    this.characterStore.selectedCharacters().length > 0
  );

  readonly charactersArrayEmpty = computed(() =>
    this.characterStore.selectedCharacters().length === 0
  );

  readonly shouldShowCharacterGrid = computed(() =>
    this.hasSelectedCharacters() || this.charactersPanelOpened()
  );

  readonly displayCharacters = computed(() => {
    if (this.charactersPanelOpened()) {
      return this.characterStore.allCharacters();
    }
    return sortCharacters(this.characterStore.selectedCharacters());
  });

  readonly shouldDimInactive = computed(() =>
    this.filtersWereUsed() && this.characterStore.activeElements().size > 0
  );

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);

    // ✅ Завжди оновлюємо дані з Firestore у фоні
    this.characterService.getAllCharacters().then(characters => {
      this.characterStore.setCharacters(sortCharacters(characters));
    });

    // localStorage — як і було
    this.characterStore.loadFromLocalStorage();
    this.isLoading.set(false);
  }

  toggleElement(type: ElementTypeName): void {
    this.filtersWereUsed.set(true);
    this.characterStore.toggleElement(type);
  }

  onAddCharacters(): void {
    this.charactersPanelOpened.set(true);
  }

  onSaveAddCharacters(): void {
    this.characterStore.saveToLocalStorage();
    this.charactersPanelOpened.set(false);
  }

  getElementIconPath(type: string): string {
    return `assets/images/ElementType_${type}.png`;
  }
}
