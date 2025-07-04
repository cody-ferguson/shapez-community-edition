/* typehints:start*/
import { Application } from "../application";
/* typehints:end*/

import { MOD_SIGNALS } from "../mods/mod_signals";
import { GameState } from "./game_state";
import { createLogger } from "./logging";
import { removeAllChildren, waitNextFrame } from "./utils";

const logger = createLogger("state_manager");

/**
 * This is the main state machine which drives the game states.
 */
export class StateManager {
    /**
     * @param {Application} app
     */
    constructor(app) {
        this.app = app;

        /** @type {GameState} */
        this.currentState = null;

        /** @type {Object.<string, new() => GameState>} */
        this.stateClasses = {};
    }

    /**
     * Registers a new state class, should be a GameState derived class
     * @param {object} stateClass
     */
    register(stateClass) {
        // Create a dummy to retrieve the key
        const dummy = new stateClass();
        assert(dummy instanceof GameState, "Not a state!");
        const key = dummy.key;
        assert(!this.stateClasses[key], `State '${key}' is already registered!`);
        this.stateClasses[key] = stateClass;
    }

    /**
     * Constructs a new state or returns the instance from the cache
     * @param {string} key
     */
    constructState(key) {
        if (this.stateClasses[key]) {
            return new this.stateClasses[key]();
        }
        assert(false, `State '${key}' is not known!`);
    }

    /**
     * Moves to a given state
     * @param {string} key State Key
     */
    moveToState(key, payload = {}) {
        if (window.APP_ERROR_OCCURED) {
            console.warn("Skipping state transition because of application crash");
            return;
        }

        if (this.currentState) {
            if (key === this.currentState.key) {
                logger.error(`State '${key}' is already active!`);
                return false;
            }
            this.currentState.internalLeaveCallback();

            // Remove all references
            for (const stateKey in this.currentState) {
                if (Object.hasOwn(this.currentState, stateKey)) {
                    delete this.currentState[stateKey];
                }
            }
            this.currentState = null;
        }

        this.currentState = this.constructState(key);
        this.currentState.internalRegisterCallback(this, this.app);

        // Clean up old elements
        if (this.currentState.getRemovePreviousContent()) {
            removeAllChildren(document.body);
        }

        document.body.className = "gameState " + (this.currentState.getHasFadeIn() ? "" : "arrived");
        document.body.id = "state_" + key;

        if (this.currentState.getRemovePreviousContent()) {
            const content = this.currentState.internalGetWrappedContent();
            document.body.append(content);
        }

        const dialogParent = document.createElement("div");
        dialogParent.classList.add("modalDialogParent");
        document.body.appendChild(dialogParent);

        this.currentState.internalEnterCallback(payload);

        this.app.sound.playThemeMusic(this.currentState.getThemeMusic());

        this.currentState.onResized(this.app.screenWidth, this.app.screenHeight);

        window.history.pushState(
            {
                key,
            },
            key
        );

        MOD_SIGNALS.stateEntered.dispatch(this.currentState);

        waitNextFrame().then(() => {
            document.body.classList.add("arrived");
        });

        return true;
    }

    /**
     * Returns the current state
     * @returns {GameState}
     */
    getCurrentState() {
        return this.currentState;
    }
}
