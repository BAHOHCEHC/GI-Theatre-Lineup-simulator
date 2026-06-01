import { computed, effect, Injectable, signal } from '@angular/core';
import { LineUpConfig, ModeConfiguration } from '@models/models';

@Injectable({ providedIn: 'root' })
export class LineupStore {
    /** Map of Mode ID -> Configuration */
    readonly configurations = signal<LineUpConfig>({});

    /** Id active mode */
    readonly activeModeId = signal<string | null>(null);

    /** Active config */
    readonly currentConfig = computed(() => {
        const modeId = this.activeModeId();
        const configs = this.configurations();
        if (!modeId) return null;
        return configs[modeId] || this.createEmptyConfig();
    });

    /** Selected characters in active mode */
    readonly selectedCharacterIds = computed(() => {
        return this.currentConfig()?.selectedCharacters || [];
    });

    /** Placemenets in active mode (ActID -> CharIDs[]) */
    readonly placements = computed(() => {
        return this.currentConfig()?.placements || {};
    });

    /** Energy in active mode (CharID -> Energy) */
    readonly energyState = computed(() => {
        return this.currentConfig()?.energyState || {};
    });

    /** Selected enemies in active mode (ActID -> Index) */
    readonly selectedEnemyIndices = computed(() => {
        return this.currentConfig()?.selectedEnemies || {};
    });

    constructor() {
        this.loadFromLocalStorage();

        // Auto-save on change
        effect(() => {
            this.saveToLocalStorage();
        });
    }

    private createEmptyConfig(): ModeConfiguration {
        return {
            selectedCharacters: [],
            placements: {},
            energyState: {},
            selectedEnemies: {}
        };
    }

    // --- Actions ---

    setActiveMode(modeId: string) {
        this.activeModeId.set(modeId);
        // Init config if missing
        this.configurations.update(current => {
            if (!current[modeId]) {
                return {
                    ...current,
                    [modeId]: this.createEmptyConfig()
                };
            }
            return current;
        });
    }

    /** Update selected characters for current mode */
    updateSelectedCharacters(charIds: string[]) {
        const modeId = this.activeModeId();
        if (!modeId) return;

        this.configurations.update(configs => {
            const modeConfig = configs[modeId] || this.createEmptyConfig();
            // Only keep energy for characters that remain selected or are defaults?
            // For now, simpler: just update the list.
            return {
                ...configs,
                [modeId]: {
                    ...modeConfig,
                    selectedCharacters: charIds
                }
            };
        });
    }

    /** Clear all characters and their configuration/placements/energy in active mode */
    clearActiveModeCharacters(): void {
        const modeId = this.activeModeId();
        if (!modeId) return;

        this.configurations.update(configs => {
            const config = configs[modeId] || this.createEmptyConfig();
            return {
                ...configs,
                [modeId]: {
                    ...config,
                    selectedCharacters: [],
                    placements: {},
                    energyState: {}
                }
            };
        });
    }

    /**
     * Register a character placement in an act
     * @param actId Act ID
     * @param charId Character ID
     * @param maxEnergy Max energy for this character (usually 2)
     */
    placeCharacter(actId: string, charId: string, maxEnergy: number = 2) {
        const modeId = this.activeModeId();
        if (!modeId) return;

        this.configurations.update(configs => {
            const config = configs[modeId] || this.createEmptyConfig();
            const currentPlacements = { ...config.placements };
            const currentEnergy = { ...config.energyState };

            // 1. Check if already in this act (prevent double place if needed, though drag logic handles it)
            const actList = currentPlacements[actId] || [];
            if (actList.includes(charId)) return configs; // Already here

            // 2. Consume energy
            const usedEnergy = currentEnergy[charId] || 0;
            if (usedEnergy >= maxEnergy) return configs; // No energy

            // 3. Update
            currentPlacements[actId] = [...actList, charId];
            currentEnergy[charId] = usedEnergy + 1;

            return {
                ...configs,
                [modeId]: {
                    ...config,
                    placements: currentPlacements,
                    energyState: currentEnergy
                }
            };
        });
    }

    /**
     * Remove character from an act
     */
    removeCharacter(actId: string, charId: string) {
        const modeId = this.activeModeId();
        if (!modeId) return;

        this.configurations.update(configs => {
            const config = configs[modeId];
            if (!config) return configs;

            const currentPlacements = { ...config.placements };
            const currentEnergy = { ...config.energyState };

            // 1. Remove from act
            const actList = currentPlacements[actId] || [];
            if (!actList.includes(charId)) return configs;

            currentPlacements[actId] = actList.filter(id => id !== charId);

            // 2. Restore energy
            const usedEnergy = currentEnergy[charId] || 0;
            if (usedEnergy > 0) {
                currentEnergy[charId] = usedEnergy - 1;
            }

            return {
                ...configs,
                [modeId]: {
                    ...config,
                    placements: currentPlacements,
                    energyState: currentEnergy
                }
            };
        });
    }

    /**
     * Get current energy for a specific character (0 if unset)
     */
    getCharacterEnergy(charId: string): number {
        return this.energyState()[charId] || 0;
    }

    /**
     * Select an enemy for a specific act
     */
    selectEnemy(actId: string, enemyIndex: number) {
        const modeId = this.activeModeId();
        if (!modeId) return;

        this.configurations.update(configs => {
            const config = configs[modeId] || this.createEmptyConfig();
            const currentSelectedEnemies = { ...config.selectedEnemies };

            currentSelectedEnemies[actId] = enemyIndex;

            return {
                ...configs,
                [modeId]: {
                    ...config,
                    selectedEnemies: currentSelectedEnemies
                }
            };
        });
    }

    // --- Persistence ---

    private saveToLocalStorage() {
        const data = this.configurations();
        localStorage.setItem('LineUpConfig', JSON.stringify(data));
    }

    private loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem('LineUpConfig');
            if (stored) {
                this.configurations.set(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load LineUpConfig', e);
        }
    }
}
