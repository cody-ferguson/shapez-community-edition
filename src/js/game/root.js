import { createLogger } from "../core/logging";
import { RandomNumberGenerator } from "../core/rng";
import { Signal } from "../core/signal";

// Type hints
/* typehints:start */
import { Application } from "../application";
import { BufferMaintainer } from "../core/buffer_maintainer";
import { Vector } from "../core/vector";
import { Savegame } from "../savegame/savegame";
import { InGameState } from "../states/ingame";
import { AutomaticSave } from "./automatic_save";
import { BaseItem } from "./base_item";
import { Camera } from "./camera";
import { DynamicTickrate } from "./dynamic_tickrate";
import { Entity } from "./entity";
import { EntityManager } from "./entity_manager";
import { GameMode } from "./game_mode";
import { GameSystemManager } from "./game_system_manager";
import { HubGoals } from "./hub_goals";
import { GameHUD } from "./hud/hud";
import { KeyActionMapper } from "./key_action_mapper";
import { GameLogic } from "./logic";
import { MapView } from "./map_view";
import { ProductionAnalytics } from "./production_analytics";
import { ShapeDefinition } from "./shape_definition";
import { ShapeDefinitionManager } from "./shape_definition_manager";
import { SoundProxy } from "./sound_proxy";
import { GameTime } from "./time/game_time";
/* typehints:end */

const logger = createLogger("game/root");

/** @type {Array<Layer>} */
export const layers = ["regular", "wires"];

/**
 * The game root is basically the whole game state at a given point,
 * combining all important classes. We don't have globals, but this
 * class is passed to almost all game classes.
 */
export class GameRoot {
    /**
     * Constructs a new game root
     * @param {Application} app
     */
    constructor(app) {
        this.app = app;

        /** @type {Savegame} */
        this.savegame = null;

        /** @type {InGameState} */
        this.gameState = null;

        /** @type {KeyActionMapper} */
        this.keyMapper = null;

        // Store game dimensions
        this.gameWidth = 500;
        this.gameHeight = 500;

        // Stores whether the current session is a fresh game (true), or was continued (false)
        /** @type {boolean} */
        this.gameIsFresh = true;

        // Stores whether the logic is already initialized
        /** @type {boolean} */
        this.logicInitialized = false;

        // Stores whether the game is already initialized, that is, all systems etc have been created
        /** @type {boolean} */
        this.gameInitialized = false;

        /**
         * Whether a bulk operation is running
         */
        this.bulkOperationRunning = false;

        /**
         * Whether a immutable operation is running
         */
        this.immutableOperationRunning = false;

        //////// Other properties ///////

        /** @type {Camera} */
        this.camera = null;

        /** @type {HTMLCanvasElement} */
        this.canvas = null;

        /** @type {CanvasRenderingContext2D} */
        this.context = null;

        /** @type {MapView} */
        this.map = null;

        /** @type {GameLogic} */
        this.logic = null;

        /** @type {EntityManager} */
        this.entityMgr = null;

        /** @type {GameHUD} */
        this.hud = null;

        /** @type {GameSystemManager} */
        this.systemMgr = null;

        /** @type {GameTime} */
        this.time = null;

        /** @type {HubGoals} */
        this.hubGoals = null;

        /** @type {BufferMaintainer} */
        this.buffers = null;

        /** @type {AutomaticSave} */
        this.automaticSave = null;

        /** @type {SoundProxy} */
        this.soundProxy = null;

        /** @type {ShapeDefinitionManager} */
        this.shapeDefinitionMgr = null;

        /** @type {ProductionAnalytics} */
        this.productionAnalytics = null;

        /** @type {DynamicTickrate} */
        this.dynamicTickrate = null;

        /** @type {Layer} */
        this.currentLayer = "regular";

        /** @type {GameMode} */
        this.gameMode = null;

        this.signals = {
            // Entities
            entityManuallyPlaced: /** @type {Signal<[Entity]>} */ (new Signal()),
            entityAdded: /** @type {Signal<[Entity]>} */ (new Signal()),
            entityChanged: /** @type {Signal<[Entity]>} */ (new Signal()),
            entityGotNewComponent: /** @type {Signal<[Entity]>} */ (new Signal()),
            entityComponentRemoved: /** @type {Signal<[Entity]>} */ (new Signal()),
            entityQueuedForDestroy: /** @type {Signal<[Entity]>} */ (new Signal()),
            entityDestroyed: /** @type {Signal<[Entity]>} */ (new Signal()),

            // Global
            resized: /** @type {Signal<[number, number]>} */ (new Signal()),
            readyToRender: /** @type {Signal<[]>} */ (new Signal()),
            aboutToDestruct: /** @type {Signal<[]>} */ new Signal(),

            // Game Hooks
            gameSaved: /** @type {Signal<[]>} */ (new Signal()), // Game got saved
            gameRestored: /** @type {Signal<[]>} */ (new Signal()), // Game got restored

            gameFrameStarted: /** @type {Signal<[]>} */ (new Signal()), // New frame

            storyGoalCompleted: /** @type {Signal<[number, string]>} */ (new Signal()),
            upgradePurchased: /** @type {Signal<[string]>} */ (new Signal()),

            // Called right after game is initialized
            postLoadHook: /** @type {Signal<[]>} */ (new Signal()),

            shapeDelivered: /** @type {Signal<[ShapeDefinition]>} */ (new Signal()),
            itemProduced: /** @type {Signal<[BaseItem]>} */ (new Signal()),

            bulkOperationFinished: /** @type {Signal<[]>} */ (new Signal()),
            immutableOperationFinished: /** @type {Signal<[]>} */ (new Signal()),

            editModeChanged: /** @type {Signal<[Layer]>} */ (new Signal()),

            // Called to check if an entity can be placed, second parameter is an additional offset.
            // Use to introduce additional placement checks
            prePlacementCheck: /** @type {Signal<[Entity, Vector]>} */ (new Signal()),

            // Called before actually placing an entity, use to perform additional logic
            // for freeing space before actually placing.
            freeEntityAreaBeforeBuild: /** @type {Signal<[Entity]>} */ (new Signal()),

            // Puzzle mode
            puzzleComplete: /** @type {Signal<[]>} */ (new Signal()),
        };

        // RNG's
        /** @type {Object.<string, Object.<string, RandomNumberGenerator>>} */
        this.rngs = {};

        // Work queue
        this.queue = {
            requireRedraw: false,
        };
    }

    /**
     * Destructs the game root
     */
    destruct() {
        logger.log("destructing root");
        this.signals.aboutToDestruct.dispatch();

        this.reset();
    }

    /**
     * Resets the whole root and removes all properties
     */
    reset() {
        if (this.signals) {
            // Destruct all signals
            for (let i = 0; i < this.signals.length; ++i) {
                this.signals[i].removeAll();
            }
        }

        if (this.hud) {
            this.hud.cleanup();
        }
        if (this.camera) {
            this.camera.cleanup();
        }

        // Finally free all properties
        for (const prop in this) {
            if (Object.hasOwn(this, prop)) {
                delete this[prop];
            }
        }
    }
}
