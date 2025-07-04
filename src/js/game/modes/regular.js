/* typehints:start */
import { MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
/* typehints:end */

import { IS_MOBILE } from "../../core/config";
import { findNiceIntegerValue } from "../../core/utils";
import { MOD_SIGNALS } from "../../mods/mod_signals";
import { MetaBlockBuilding } from "../buildings/block";
import { MetaConstantProducerBuilding } from "../buildings/constant_producer";
import { MetaGoalAcceptorBuilding } from "../buildings/goal_acceptor";
import { MetaItemProducerBuilding } from "../buildings/item_producer";
import { enumGameModeIds, enumGameModeTypes, GameMode } from "../game_mode";
import { HUDConstantSignalEdit } from "../hud/parts/constant_signal_edit";
import { HUDGameMenu } from "../hud/parts/game_menu";
import { HUDInteractiveTutorial } from "../hud/parts/interactive_tutorial";
import { HUDKeybindingOverlay } from "../hud/parts/keybinding_overlay";
import { HUDLayerPreview } from "../hud/parts/layer_preview";
import { HUDLeverToggle } from "../hud/parts/lever_toggle";
import { HUDMassSelector } from "../hud/parts/mass_selector";
import { HUDMinerHighlight } from "../hud/parts/miner_highlight";
import { HUDNotifications } from "../hud/parts/notifications";
import { HUDPinnedShapes } from "../hud/parts/pinned_shapes";
import { HUDScreenshotExporter } from "../hud/parts/screenshot_exporter";
import { HUDShapeViewer } from "../hud/parts/shape_viewer";
import { HUDShop } from "../hud/parts/shop";
import { HUDStatistics } from "../hud/parts/statistics";
import { HUDPartTutorialHints } from "../hud/parts/tutorial_hints";
import { HUDTutorialVideoOffer } from "../hud/parts/tutorial_video_offer";
import { HUDUnlockNotification } from "../hud/parts/unlock_notification";
import { HUDWaypoints } from "../hud/parts/waypoints";
import { HUDWireInfo } from "../hud/parts/wire_info";
import { HUDWiresOverlay } from "../hud/parts/wires_overlay";
import { HUDWiresToolbar } from "../hud/parts/wires_toolbar";
import { ShapeDefinition } from "../shape_definition";
import { enumHubGoalRewards } from "../tutorial_goals";
import { finalGameShape, REGULAR_MODE_LEVELS } from "./levels";

/** @typedef {{
 *   shape: string,
 *   amount: number
 * }} UpgradeRequirement */

/** @typedef {{
 *   required: Array<UpgradeRequirement>
 *   improvement?: number,
 *   excludePrevious?: boolean
 * }} TierRequirement */

/** @typedef {Array<TierRequirement>} UpgradeTiers */

/** @typedef {{
 *   shape: string,
 *   required: number,
 *   reward: enumHubGoalRewards,
 *   throughputOnly?: boolean
 * }} LevelDefinition */

export const rocketShape = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw";
const preparementShape = "CpRpCp--:SwSwSwSw";

// Tiers need % of the previous tier as requirement too
const tierGrowth = 2.5;

// TODO: Convert this file to TS and fix types. Maybe split the levels and upgrades as well
let upgradesCache = null;

/**
 * Generates all upgrades
 * @returns {Object<string, UpgradeTiers>}
 */
function generateUpgrades() {
    if (upgradesCache) {
        return upgradesCache;
    }

    const fixedImprovements = [0.5, 0.5, 1, 1, 2, 1, 1];
    const numEndgameUpgrades = 1000 - fixedImprovements.length - 1;

    function generateInfiniteUnlocks() {
        return new Array(numEndgameUpgrades).fill(null).map((_, i) => ({
            required: [
                { shape: preparementShape, amount: 30000 + i * 10000 },
                { shape: finalGameShape, amount: 20000 + i * 5000 },
                { shape: rocketShape, amount: 20000 + i * 5000 },
            ],
            excludePrevious: true,
        }));
    }

    // Fill in endgame upgrades
    for (let i = 0; i < numEndgameUpgrades; ++i) {
        if (i < 20) {
            fixedImprovements.push(0.1);
        } else if (i < 50) {
            fixedImprovements.push(0.05);
        } else if (i < 100) {
            fixedImprovements.push(0.025);
        } else {
            fixedImprovements.push(0.0125);
        }
    }

    const upgrades = {
        belt: [
            {
                required: [{ shape: "CuCuCuCu", amount: 30 }],
            },
            {
                required: [{ shape: "--CuCu--", amount: 500 }],
            },
            {
                required: [{ shape: "CpCpCpCp", amount: 1000 }],
            },
            {
                required: [{ shape: "SrSrSrSr:CyCyCyCy", amount: 6000 }],
            },
            {
                required: [{ shape: "SrSrSrSr:CyCyCyCy:SwSwSwSw", amount: 25000 }],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],

        miner: [
            {
                required: [{ shape: "RuRuRuRu", amount: 300 }],
            },
            {
                required: [{ shape: "Cu------", amount: 800 }],
            },
            {
                required: [{ shape: "ScScScSc", amount: 3500 }],
            },
            {
                required: [{ shape: "CwCwCwCw:WbWbWbWb", amount: 23000 }],
            },
            {
                required: [
                    {
                        shape: "CbRbRbCb:CwCwCwCw:WbWbWbWb",
                        amount: 50000,
                    },
                ],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],

        processors: [
            {
                required: [{ shape: "SuSuSuSu", amount: 500 }],
            },
            {
                required: [{ shape: "RuRu----", amount: 600 }],
            },
            {
                required: [{ shape: "CgScScCg", amount: 3500 }],
            },
            {
                required: [{ shape: "CwCrCwCr:SgSgSgSg", amount: 25000 }],
            },
            {
                required: [{ shape: "WrRgWrRg:CwCrCwCr:SgSgSgSg", amount: 50000 }],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],

        painting: [
            {
                required: [{ shape: "RbRb----", amount: 600 }],
            },
            {
                required: [{ shape: "WrWrWrWr", amount: 3800 }],
            },
            {
                required: [
                    {
                        shape: "RpRpRpRp:CwCwCwCw",
                        amount: 6500,
                    },
                ],
            },
            {
                required: [{ shape: "WpWpWpWp:CwCwCwCw:WpWpWpWp", amount: 25000 }],
            },
            {
                required: [{ shape: "WpWpWpWp:CwCwCwCw:WpWpWpWp:CwCwCwCw", amount: 50000 }],
            },
            {
                required: [{ shape: preparementShape, amount: 25000 }],
                excludePrevious: true,
            },
            {
                required: [
                    { shape: preparementShape, amount: 25000 },
                    { shape: finalGameShape, amount: 50000 },
                ],
                excludePrevious: true,
            },
            ...generateInfiniteUnlocks(),
        ],
    };

    // Automatically generate tier levels
    for (const upgradeId in upgrades) {
        const upgradeTiers = upgrades[upgradeId];

        let currentTierRequirements = [];
        for (let i = 0; i < upgradeTiers.length; ++i) {
            const tierHandle = upgradeTiers[i];
            tierHandle.improvement = fixedImprovements[i];

            const originalRequired = tierHandle.required.slice();

            for (let k = currentTierRequirements.length - 1; k >= 0; --k) {
                const oldTierRequirement = currentTierRequirements[k];
                if (!tierHandle.excludePrevious) {
                    tierHandle.required.unshift({
                        shape: oldTierRequirement.shape,
                        amount: oldTierRequirement.amount,
                    });
                }
            }
            currentTierRequirements.push(
                ...originalRequired.map(req => ({
                    amount: req.amount,
                    shape: req.shape,
                }))
            );
            currentTierRequirements.forEach(tier => {
                tier.amount = findNiceIntegerValue(tier.amount * tierGrowth);
            });
        }
    }

    MOD_SIGNALS.modifyUpgrades.dispatch(upgrades);

    // VALIDATE
    if (G_IS_DEV) {
        for (const upgradeId in upgrades) {
            upgrades[upgradeId].forEach(tier => {
                tier.required.forEach(({ shape }) => {
                    try {
                        ShapeDefinition.fromShortKey(shape);
                    } catch (ex) {
                        throw new Error("Invalid upgrade goal for shape " + shape, { cause: ex });
                    }
                });
            });
        }
    }

    upgradesCache = upgrades;
    return upgrades;
}

let levelDefinitionsCache = null;

/**
 * Generates the level definitions
 */
export function generateLevelDefinitions() {
    // NOTE: This cache is useless in production, but is there because of the G_IS_DEV validation
    if (levelDefinitionsCache) {
        return levelDefinitionsCache;
    }

    const levelDefinitions = REGULAR_MODE_LEVELS;
    MOD_SIGNALS.modifyLevelDefinitions.dispatch(levelDefinitions);

    if (G_IS_DEV) {
        levelDefinitions.forEach(({ shape }) => {
            try {
                ShapeDefinition.fromShortKey(shape);
            } catch (ex) {
                throw new Error("Invalid tutorial goal for shape " + shape, { cause: ex });
            }
        });
    }

    levelDefinitionsCache = levelDefinitions;
    return levelDefinitions;
}

export class RegularGameMode extends GameMode {
    static getId() {
        return enumGameModeIds.regular;
    }

    static getType() {
        return enumGameModeTypes.default;
    }

    /** @param {GameRoot} root */
    constructor(root) {
        super(root);

        this.additionalHudParts = {
            wiresToolbar: HUDWiresToolbar,
            unlockNotification: HUDUnlockNotification,
            massSelector: HUDMassSelector,
            shop: HUDShop,
            statistics: HUDStatistics,
            waypoints: HUDWaypoints,
            wireInfo: HUDWireInfo,
            leverToggle: HUDLeverToggle,
            pinnedShapes: HUDPinnedShapes,
            notifications: HUDNotifications,
            screenshotExporter: HUDScreenshotExporter,
            wiresOverlay: HUDWiresOverlay,
            shapeViewer: HUDShapeViewer,
            layerPreview: HUDLayerPreview,
            minerHighlight: HUDMinerHighlight,
            tutorialVideoOffer: HUDTutorialVideoOffer,
            gameMenu: HUDGameMenu,
            constantSignalEdit: HUDConstantSignalEdit,
        };

        if (!IS_MOBILE) {
            this.additionalHudParts.keybindingOverlay = HUDKeybindingOverlay;
        }

        if (this.root.app.settings.getAllSettings().offerHints) {
            this.additionalHudParts.tutorialHints = HUDPartTutorialHints;
            this.additionalHudParts.interactiveTutorial = HUDInteractiveTutorial;
        }

        /** @type {(typeof MetaBuilding)[]} */
        this.hiddenBuildings = [
            MetaConstantProducerBuilding,
            MetaGoalAcceptorBuilding,
            MetaBlockBuilding,
            MetaItemProducerBuilding,
        ];
    }

    /**
     * Should return all available upgrades
     * @returns {Object<string, UpgradeTiers>}
     */
    getUpgrades() {
        return generateUpgrades();
    }

    /**
     * Returns the goals for all levels including their reward
     * @returns {Array<LevelDefinition>}
     */
    getLevelDefinitions() {
        return generateLevelDefinitions();
    }

    /**
     * Should return whether free play is available or if the game stops
     * after the predefined levels
     * @returns {boolean}
     */
    getIsFreeplayAvailable() {
        return true;
    }
}
