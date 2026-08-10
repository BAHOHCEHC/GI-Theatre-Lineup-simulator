import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import html2canvas from 'html2canvas';
import { ElementRef } from '@angular/core';
import {
  CharacterService,
  EnemiesService,
  SeasonService,
  ActModsService,
} from '@shared/services/_index';
import { Act, Character, ElementTypeName, Enemy, Mode, Season_details } from '@models/models';
import { CharacterStore, LineupStore } from '@store/_index';
import { SeasonDetailsStore } from '@store/season-details.store';
import { sortCharacters } from '@utils/sorting-characters';
import { SeasonCharactersModal } from '@core/components/_index';
import { ReactiveFormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-lineup-simulator',
  imports: [SeasonCharactersModal, ReactiveFormsModule, JsonPipe],
  standalone: true,
  templateUrl: './lineup-simulator.html',
  styleUrl: './lineup-simulator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineupSimulator implements OnInit {
  @ViewChild(SeasonCharactersModal) seasonCharactersModal!: SeasonCharactersModal;

  private seasonService = inject(SeasonService);
  private characterService = inject(CharacterService);
  public enemiesService = inject(EnemiesService);
  private actModsService = inject(ActModsService);

  @ViewChild('screenshotRoot', { static: false })
  screenshotRoot!: ElementRef<HTMLElement>;

  public readonly store = inject(LineupStore);
  public readonly characterStore = inject(CharacterStore);
  private readonly seasonStore = inject(SeasonDetailsStore);

  public loading = signal(true);

  public allCharacters = computed(() => this.characterStore.selectedCharacters());

  // Filtered characters for the modal (only show allowed elements)
  public availableCharacters = computed(() => {
    const usersSelectedChars = this.allCharacters();
    const openingIds = new Set(this.openingCharacters().map((c) => c.id));
    const allowed = this.activeElements();

    const filtered = usersSelectedChars.filter((c) => !openingIds.has(c.id));

    if (allowed.size === 0) return filtered;
    return filtered.filter((c) => c.element && allowed.has(c.element.name));
  });

  // Users characters for the ACTIVE mode
  readonly usersCharacter = computed(() => {
    const selectedIds = new Set(this.store.selectedCharacterIds());
    if (selectedIds.size === 0) return [];

    // Efficient lookup
    const charMap = new Map<string, Character>();
    [...this.allCharacters(), ...this.specialGuestCharacters()].forEach((c) =>
      charMap.set(c.id, c),
    );
    const all = Array.from(charMap.values());

    if (all.length === 0) return [];

    const energyState = this.store.energyState();

    const chars = all
      .filter((c) => selectedIds.has(c.id))
      .map((c) => {
        const consumed = energyState[c.id] || 0;
        return { ...c, energy: Math.max(0, 2 - consumed) };
      });
    return sortCharacters(chars);
  });

  readonly openingCharacters = computed(() => {
    const opening = this.seasonDetails().opening_characters || [];
    if (opening.length === 0) return [];

    const energyState = this.store.energyState();

    return opening.map((c) => {
      const consumed = energyState[c.id] || 0;
      return { ...c, energy: Math.max(0, 2 - consumed) };
    });
  });

  public modes = signal<Mode[]>([]);
  public enemies = signal<Enemy[]>([]);
  public activeMode = computed(() => {
    const id = this.store.activeModeId();
    return this.modes().find((m) => m.id === id) || null;
  });

  // --- State Signals ---
  public seasonDetails = computed<Season_details>(() => this.seasonStore.seasonDetails() || {
    elemental_type_limided: [],
    opening_characters: [],
    special_guests: [],
    acts: [],
  });

  public specialGuestCharacters = computed(() => {
    const guests = this.seasonDetails().special_guests || [];
    const ownedIds = new Set(this.allCharacters().map((c) => c.id));
    return guests.filter((c) => ownedIds.has(c.id));
  });

  // Element helpers
  public elementTypes: ElementTypeName[] = [
    'pyro',
    'hydro',
    'electro',
    'cryo',
    'dendro',
    'anemo',
    'geo',
  ];

  public activeElements = computed(
    () => new Set(this.seasonDetails().elemental_type_limided.map((e) => e.name)),
  );

  public activeActs = computed<Act[]>(() => {
    const modeActs = this.activeMode()?.chambers || [];
    const detailsActs = this.seasonDetails().acts || [];
    const detailsMap = new Map(detailsActs.map((act) => [act.id, act]));

    return modeActs
      .map((act) => detailsMap.get(act.id) || act)
      .filter((act): act is Act => !!act)
      .sort((a, b) => a.name - b.name);
  });

  // Split acts for 2-column layout (Act 1-5 Left, Act 6-10 Right) + Arcana
  public nonArcanaActs = computed(() => {
    return this.activeActs().filter((a) => a.type !== 'Arcana_fight');
  });

  public leftActs = computed(() => {
    const all = this.nonArcanaActs();
    const mid = Math.ceil(all.length / 2);
    return all.slice(0, mid);
  });

  public rightActs = computed(() => {
    const all = this.nonArcanaActs();
    const mid = Math.ceil(all.length / 2);
    return all.slice(mid);
  });

  public arcanaActs = computed(() => {
    return this.activeActs().filter((a) => a.type === 'Arcana_fight');
  });

  /**
   * Performance optimization: Pre-resolve character objects for each act placement
   */
  public resolvedPlacements = computed<Record<string, Character[]>>(() => {
    const placements = this.store.placements();
    const allChars = this.characterStore.allCharacters();
    const resolved: Record<string, Character[]> = {};

    Object.keys(placements).forEach((actId) => {
      const ids = placements[actId] || [];
      resolved[actId] = ids
        .map((id) => allChars.find((c) => c.id === id))
        .filter((c): c is Character => !!c);
    });

    return resolved;
  });

  /**
   * Build enemy data directly from the live EnemiesService state for each render.
   */
  public actEnemiesMap = computed<Record<string, Enemy[]>>(() => {
    const acts = this.activeActs();
    const liveEnemies = this.enemiesService.enemies();
    const enemyMap = new Map(liveEnemies.map((enemy) => [enemy.id, enemy]));
    const map: Record<string, Enemy[]> = {};

    const resolveEnemy = (enemy: Enemy) => enemyMap.get(enemy.id) || enemy;

    acts.forEach((act) => {
      if (act.type === 'Variation_fight') {
        const enemies: Enemy[] = [];
        if (act.variations) {
          act.variations.forEach((variation) => {
            if (variation.waves?.[0]?.included_enemy?.[0]) {
              enemies.push(resolveEnemy(variation.waves[0].included_enemy[0]));
            }
          });
        }
        map[act.id] = enemies;
      } else {
        map[act.id] = (act.enemy_selection || []).map(resolveEnemy);
      }
    });

    return map;
  });

  public async ngOnInit(): Promise<void> {
    this.loading.set(true);
    // Init services

    // Load chars - Optimization: use store if available
    // Load chars - Always re-validate with server in background
    this.characterService.getAllCharacters().then(chars => {
      this.characterStore.setCharacters(chars);
    });
    // Load modes
    const modes = await this.actModsService.getAllModes();
    this.modes.set(modes);

    // Initial Active Mode
    if (modes.length > 0 && !this.store.activeModeId()) {
      this.store.setActiveMode(modes[0].id);
    } else if (modes.length > 0 && this.store.activeModeId()) {
      // Ensure active mode is valid
      const exists = modes.some((m) => m.id === this.store.activeModeId());
      if (!exists) this.store.setActiveMode(modes[0].id);
      else this.store.setActiveMode(this.store.activeModeId()!);
    }

    // Load Season Details through the store so the view reacts to live updates
    await this.seasonStore.loadDetailsIfNeeded();

    // Load enemies for lookups
    await this.enemiesService.loadEnemies();

    this.loading.set(false);
  }

  public getElementIconPath(type: ElementTypeName): string {
    return `assets/images/ElementType_${type}.png`;
  }

  public onModeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const modeId = select.value;
    this.store.setActiveMode(modeId);
  }

  public getActDisplayName(act: Act): string {
    const isHardMode = this.activeMode()?.name === 'Hard mode';
    if (isHardMode && act.name === 10) {
      return 'Act 8';
    }
    return `Act ${act.name}`;
  }

  /**
   * @deprecated Use actEnemiesMap() in template for better performance
   */
  public getActEnemies(act: Act): Enemy[] {
    const actEnemies = this.actEnemiesMap()[act.id] || [];
    const liveEnemies = this.enemiesService.enemies();

    return actEnemies.map((enemy) => {
      const liveEnemy = liveEnemies.find((item) => item.id === enemy.id || item.name === enemy.name);
      return liveEnemy || enemy;
    });
  }

  public isEnemyActive(actId: string, index: number): boolean {
    const selectedIndices = this.store.selectedEnemyIndices();
    // Default to index 0 if not set
    const selectedIndex = selectedIndices[actId] ?? 0;
    return selectedIndex === index;
  }

  public onSelectEnemy(actId: string, index: number): void {
    this.store.selectEnemy(actId, index);
  }

  /**
   * @deprecated Use resolvedPlacements() in template for better performance
   */
  public getPlacedCharacters(actId: string): Character[] {
    return this.resolvedPlacements()[actId] || [];
  }

  // --- Modal Logic ---
  public isModalOpen = signal(false);

  public openAlternateCastModal(): void {
    this.isModalOpen.set(true);
  }

  public closeModal(): void {
    this.isModalOpen.set(false);
  }

  public onSaveAlternateCast(selectedChars: Character[]): void {
    this.store.updateSelectedCharacters(selectedChars.map((c) => c.id));
    this.closeModal();
  }

  // --- Drag & Drop ---

  public onDragStart(event: DragEvent, char: Character): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', char.id);
      event.dataTransfer.effectAllowed = 'copy';

      // Set custom drag image using the card element itself
      // event.currentTarget is the div.char-mini-card which contains the img and background
      const dragElement = event.currentTarget as HTMLElement;
      event.dataTransfer.setDragImage(dragElement, 35, 35); // Center cursor roughly (70x70 card)
    }
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault(); // Allow drop
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  public onDrop(event: DragEvent, actId: string): void {
    event.preventDefault();
    if (event.dataTransfer) {
      const charId = event.dataTransfer.getData('text/plain');
      if (charId) {
        this.store.placeCharacter(actId, charId);
      }
    }
  }

  public onRemoveCharacter(actId: string, charId: string): void {
    this.store.removeCharacter(actId, charId);
  }

  public clearAllCharacters(): void {
    this.store.clearActiveModeCharacters();
  }

  public async saveConfiguration(): Promise<void> {
    try {
      await new Promise((r) => setTimeout(r, 100)); // трохи більше часу

      const element = this.screenshotRoot.nativeElement;

      // Зберігаємо оригінальні стилі
      const originalTransform = element.style.transform;
      const originalTransformOrigin = element.style.transformOrigin;

      // Скидаємо transform перед скріншотом
      element.style.transform = 'none';
      element.style.transformOrigin = 'top left';

      const canvas = await html2canvas(element, {
        backgroundColor: '#0b0e14',
        scale: 1, // фіксований scale
        useCORS: true,
        logging: false,
        allowTaint: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // Фіксуємо всі img у клоні — запобігаємо subpixel зміщенню
          const imgs = clonedDoc.querySelectorAll<HTMLImageElement>(
            '.act-section-enemy img, .char-mini-card img'
          );
          imgs.forEach((img) => {
            img.style.imageRendering = 'pixelated';
            img.style.transform = 'none';
          });

          // Фіксуємо enemy секції
          const enemySections = clonedDoc.querySelectorAll<HTMLElement>(
            '.act-section-enemy'
          );
          enemySections.forEach((el) => {
            el.style.overflow = 'visible';
          });
        },
      });

      // Відновлюємо стилі
      element.style.transform = originalTransform;
      element.style.transformOrigin = originalTransformOrigin;

      // Якщо треба вищий resolution — масштабуємо canvas вручну
      const targetScale = Math.min(window.devicePixelRatio || 1, 2);
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width * targetScale;
      finalCanvas.height = canvas.height * targetScale;

      const ctx = finalCanvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.scale(targetScale, targetScale);
      ctx.drawImage(canvas, 0, 0);

      const image = finalCanvas.toDataURL('image/png');
      const modeName = this.activeMode()?.name || 'Unknown';
      this.downloadImage(image, `lineup-config[${modeName}].png`);

    } catch (err) {
      console.error('Screenshot failed', err);
    }
  }

  private downloadImage(dataUrl: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  }

  public resolveAvatarUrl(item: string | Character | Enemy | null | undefined): string {
    if (!item) return 'assets/images/avatar_placeholder.png';

    const id = typeof item === 'string' ? item : item.id;
    const characterData = this.charactersMap().get(id);
    const liveEnemy = this.enemiesService.enemies().find((enemy) => enemy.id === id || enemy.name === (typeof item !== 'string' ? item.name : undefined));

    if (liveEnemy?.avatarUrl) {
      return liveEnemy.avatarUrl;
    }

    if (characterData) {
      return characterData;
    }

    return (typeof item !== 'string' ? item.avatarUrl : undefined) || 'assets/images/avatar_placeholder.png';
  }

  public resolveEnemyName(item: string | Character | Enemy | null | undefined): string {
    if (!item) return 'Unknown';

    const id = typeof item === 'string' ? item : item.id;
    const liveEnemy = this.enemiesService.enemies().find((enemy) => enemy.id === id || enemy.name === (typeof item !== 'string' ? item.name : undefined));

    if (liveEnemy?.name) {
      return liveEnemy.name;
    }

    return (typeof item !== 'string' ? item.name : undefined) || 'Unknown';
  }
  // --- Helpers ---
  private readonly charactersMap = computed(
    () => new Map(this.characterStore.allCharacters().map((c) => [c.id, c.avatarUrl])),
  );
}
