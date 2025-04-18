import { globalConfig } from "../../core/config";
import { BaseItem } from "../base_item";
import { enumColorMixingResults, enumColors } from "../colors";
import {
    enumItemProcessorRequirements,
    enumItemProcessorTypes,
    ItemProcessorComponent,
} from "../components/item_processor";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { isTruthyItem } from "../items/boolean_item";
import { COLOR_ITEM_SINGLETONS, ColorItem } from "../items/color_item";
import { ShapeItem } from "../items/shape_item";

/**
 * We need to allow queuing charges, otherwise the throughput will stall
 */
const MAX_QUEUED_CHARGES = 2;

/**
 * Whole data for a produced item
 *
 * @typedef {{
 *   item: BaseItem,
 *   preferredSlot?: number,
 *   requiredSlot?: number,
 *   doNotTrack?: boolean
 * }} ProducedItem
 */

/**
 * Type of a processor implementation
 * @typedef {{
 *   entity: Entity,
 *   items: Map<number, BaseItem>,
 *   inputCount: number,
 *   outItems: Array<ProducedItem>
 *   }} ProcessorImplementationPayload
 */

/**
 * Type of a processor implementation
 * @typedef {{
 *   entity: Entity,
 *   item: BaseItem,
 *   slotIndex: number
 *   }} ProccessingRequirementsImplementationPayload
 */

/**
 * @type {Object<string, (arg: ProcessorImplementationPayload) => void>}
 */
export const MOD_ITEM_PROCESSOR_HANDLERS = {};

/**
 * @type {Object<string, (arg: ProccessingRequirementsImplementationPayload) => boolean>}
 */
export const MODS_PROCESSING_REQUIREMENTS = {};

/**
 * @type {Object<string, (arg: {entity: Entity}) => boolean>}
 */
export const MODS_CAN_PROCESS = {};

export class ItemProcessorSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [ItemProcessorComponent]);

        /**
         * @type {Object<enumItemProcessorTypes, (arg: ProcessorImplementationPayload) => void>}
         */
        this.handlers = {
            [enumItemProcessorTypes.balancer]: this.process_BALANCER,
            [enumItemProcessorTypes.cutter]: this.process_CUTTER,
            [enumItemProcessorTypes.cutterQuad]: this.process_CUTTER_QUAD,
            [enumItemProcessorTypes.rotator]: this.process_ROTATOR,
            [enumItemProcessorTypes.rotatorCCW]: this.process_ROTATOR_CCW,
            [enumItemProcessorTypes.rotator180]: this.process_ROTATOR_180,
            [enumItemProcessorTypes.stacker]: this.process_STACKER,
            [enumItemProcessorTypes.trash]: this.process_TRASH,
            [enumItemProcessorTypes.mixer]: this.process_MIXER,
            [enumItemProcessorTypes.painter]: this.process_PAINTER,
            [enumItemProcessorTypes.painterDouble]: this.process_PAINTER_DOUBLE,
            [enumItemProcessorTypes.painterQuad]: this.process_PAINTER_QUAD,
            [enumItemProcessorTypes.hub]: this.process_HUB,
            [enumItemProcessorTypes.reader]: this.process_READER,
            [enumItemProcessorTypes.goal]: this.process_GOAL,
            ...MOD_ITEM_PROCESSOR_HANDLERS,
        };

        // Bind all handlers
        for (const key in this.handlers) {
            this.handlers[key] = this.handlers[key].bind(this);
        }
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];

            const processorComp = entity.components.ItemProcessor;
            const ejectorComp = entity.components.ItemEjector;

            const currentCharge = processorComp.ongoingCharges[0];

            if (currentCharge) {
                // Process next charge
                if (currentCharge.remainingTime > 0.0) {
                    currentCharge.remainingTime -= this.root.dynamicTickrate.deltaSeconds;
                    if (currentCharge.remainingTime < 0.0) {
                        // Add bonus time, this is the time we spent too much
                        processorComp.bonusTime += -currentCharge.remainingTime;
                    }
                }

                // Check if it finished and we don't already have queued ejects
                if (currentCharge.remainingTime <= 0.0 && !processorComp.queuedEjects.length) {
                    const itemsToEject = currentCharge.items;

                    // Go over all items and add them to the queue
                    for (let j = 0; j < itemsToEject.length; ++j) {
                        processorComp.queuedEjects.push(itemsToEject[j]);
                    }

                    processorComp.ongoingCharges.shift();
                }
            }

            // Check if we have an empty queue and can start a new charge
            if (processorComp.ongoingCharges.length < MAX_QUEUED_CHARGES) {
                if (this.canProcess(entity)) {
                    this.startNewCharge(entity);
                }
            }

            for (let j = 0; j < processorComp.queuedEjects.length; ++j) {
                const { item, requiredSlot, preferredSlot } = processorComp.queuedEjects[j];

                assert(ejectorComp, "To eject items, the building needs to have an ejector");

                let slot = null;
                if (requiredSlot !== null && requiredSlot !== undefined) {
                    // We have a slot override, check if that is free
                    if (ejectorComp.canEjectOnSlot(requiredSlot)) {
                        slot = requiredSlot;
                    }
                } else if (preferredSlot !== null && preferredSlot !== undefined) {
                    // We have a slot preference, try using it but otherwise use a free slot
                    if (ejectorComp.canEjectOnSlot(preferredSlot)) {
                        slot = preferredSlot;
                    } else {
                        slot = ejectorComp.getFirstFreeSlot();
                    }
                } else {
                    // We can eject on any slot
                    slot = ejectorComp.getFirstFreeSlot();
                }

                if (slot !== null) {
                    // Alright, we can actually eject
                    if (!ejectorComp.tryEject(slot, item)) {
                        assert(false, "Failed to eject");
                    } else {
                        processorComp.queuedEjects.splice(j, 1);
                        j -= 1;
                    }
                }
            }
        }
    }

    /**
     * Returns true if the entity should accept the given item on the given slot.
     * This should only be called with matching items! I.e. if a color item is expected
     * on the given slot, then only a color item must be passed.
     * @param {Entity} entity
     * @param {BaseItem} item The item to accept
     * @param {number} slotIndex The slot index
     * @returns {boolean}
     */
    checkRequirements(entity, item, slotIndex) {
        const itemProcessorComp = entity.components.ItemProcessor;
        const pinsComp = entity.components.WiredPins;

        if (MODS_PROCESSING_REQUIREMENTS[itemProcessorComp.processingRequirement]) {
            return MODS_PROCESSING_REQUIREMENTS[itemProcessorComp.processingRequirement].bind(this)({
                entity,
                item,
                slotIndex,
            });
        }

        switch (itemProcessorComp.processingRequirement) {
            case enumItemProcessorRequirements.painterQuad: {
                if (slotIndex === 0) {
                    // Always accept the shape
                    return true;
                }

                // Check the network value at the given slot
                const network = pinsComp.slots[slotIndex - 1].linkedNetwork;
                const slotIsEnabled = network && network.hasValue() && isTruthyItem(network.currentValue);
                if (!slotIsEnabled) {
                    return false;
                }
                return true;
            }

            // By default, everything is accepted
            default:
                return true;
        }
    }

    /**
     * Checks whether it's possible to process something
     * @param {Entity} entity
     */
    canProcess(entity) {
        const processorComp = entity.components.ItemProcessor;

        if (MODS_CAN_PROCESS[processorComp.processingRequirement]) {
            return MODS_CAN_PROCESS[processorComp.processingRequirement].bind(this)({
                entity,
            });
        }

        switch (processorComp.processingRequirement) {
            // DEFAULT
            // By default, we can start processing once all inputs are there
            case null: {
                return processorComp.inputCount >= processorComp.inputsPerCharge;
            }

            // QUAD PAINTER
            // For the quad painter, it might be possible to start processing earlier
            case enumItemProcessorRequirements.painterQuad: {
                const pinsComp = entity.components.WiredPins;

                // First slot is the shape, so if it's not there we can't do anything
                const shapeItem = /** @type {ShapeItem} */ (processorComp.inputSlots.get(0));
                if (!shapeItem) {
                    return false;
                }

                const slotStatus = [];

                // Check which slots are enabled
                for (let i = 0; i < 4; ++i) {
                    // Extract the network value on the Nth pin
                    const network = pinsComp.slots[i].linkedNetwork;
                    const networkValue = network && network.hasValue() ? network.currentValue : null;

                    // If there is no "1" on that slot, don't paint there
                    if (!isTruthyItem(networkValue)) {
                        slotStatus.push(false);
                        continue;
                    }

                    slotStatus.push(true);
                }

                // All slots are disabled
                if (!slotStatus.includes(true)) {
                    return false;
                }

                // Check if all colors of the enabled slots are there
                for (let i = 0; i < slotStatus.length; ++i) {
                    if (slotStatus[i] && !processorComp.inputSlots.get(1 + i)) {
                        // A slot which is enabled wasn't enabled. Make sure if there is anything on the quadrant,
                        // it is not possible to paint, but if there is nothing we can ignore it
                        for (let j = 0; j < 4; ++j) {
                            const layer = shapeItem.definition.layers[j];
                            if (layer && layer[i]) {
                                return false;
                            }
                        }
                    }
                }

                return true;
            }

            default:
                assertAlways(false, "Unknown requirement for " + processorComp.processingRequirement);
        }
    }

    /**
     * Starts a new charge for the entity
     * @param {Entity} entity
     */
    startNewCharge(entity) {
        const processorComp = entity.components.ItemProcessor;

        // First, take items
        const items = processorComp.inputSlots;

        /** @type {Array<ProducedItem>} */
        const outItems = [];

        /** @type {function(ProcessorImplementationPayload) : void} */
        const handler = this.handlers[processorComp.type];
        assert(handler, "No handler for processor type defined: " + processorComp.type);

        // Call implementation
        handler({
            entity,
            items,
            outItems,
            inputCount: processorComp.inputCount,
        });

        // Track produced items
        for (let i = 0; i < outItems.length; ++i) {
            if (!outItems[i].doNotTrack) {
                this.root.signals.itemProduced.dispatch(outItems[i].item);
            }
        }

        // Queue Charge
        const baseSpeed = this.root.hubGoals.getProcessorBaseSpeed(processorComp.type);
        const originalTime = 1 / baseSpeed;

        const bonusTimeToApply = Math.min(originalTime, processorComp.bonusTime);
        const timeToProcess = originalTime - bonusTimeToApply;

        processorComp.bonusTime -= bonusTimeToApply;
        processorComp.ongoingCharges.push({
            items: outItems,
            remainingTime: timeToProcess,
        });

        processorComp.inputSlots.clear();
        processorComp.inputCount = 0;
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_BALANCER(payload) {
        assert(
            payload.entity.components.ItemEjector,
            "To be a balancer, the building needs to have an ejector"
        );
        const availableSlots = payload.entity.components.ItemEjector.slots.length;
        const processorComp = payload.entity.components.ItemProcessor;

        for (let i = 0; i < 2; ++i) {
            const item = payload.items.get(i);
            if (!item) {
                continue;
            }
            payload.outItems.push({
                item,
                preferredSlot: processorComp.nextOutputSlot++ % availableSlots,
                doNotTrack: true,
            });
        }
        return true;
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_CUTTER(payload) {
        const inputItem = /** @type {ShapeItem} */ (payload.items.get(0));
        assert(inputItem instanceof ShapeItem, "Input for cut is not a shape");
        const inputDefinition = inputItem.definition;

        const cutDefinitions = this.root.shapeDefinitionMgr.shapeActionCutHalf(inputDefinition);

        const ejectorComp = payload.entity.components.ItemEjector;
        for (let i = 0; i < cutDefinitions.length; ++i) {
            const definition = cutDefinitions[i];

            if (definition.isEntirelyEmpty()) {
                ejectorComp.slots[i].lastItem = null;
                continue;
            }

            payload.outItems.push({
                item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(definition),
                requiredSlot: i,
            });
        }
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_CUTTER_QUAD(payload) {
        const inputItem = /** @type {ShapeItem} */ (payload.items.get(0));
        assert(inputItem instanceof ShapeItem, "Input for cut is not a shape");
        const inputDefinition = inputItem.definition;

        const cutDefinitions = this.root.shapeDefinitionMgr.shapeActionCutQuad(inputDefinition);

        const ejectorComp = payload.entity.components.ItemEjector;
        for (let i = 0; i < cutDefinitions.length; ++i) {
            const definition = cutDefinitions[i];

            if (definition.isEntirelyEmpty()) {
                ejectorComp.slots[i].lastItem = null;
                continue;
            }

            payload.outItems.push({
                item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(definition),
                requiredSlot: i,
            });
        }
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_ROTATOR(payload) {
        const inputItem = /** @type {ShapeItem} */ (payload.items.get(0));
        assert(inputItem instanceof ShapeItem, "Input for rotation is not a shape");
        const inputDefinition = inputItem.definition;

        const rotatedDefinition = this.root.shapeDefinitionMgr.shapeActionRotateCW(inputDefinition);
        payload.outItems.push({
            item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(rotatedDefinition),
        });
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_ROTATOR_CCW(payload) {
        const inputItem = /** @type {ShapeItem} */ (payload.items.get(0));
        assert(inputItem instanceof ShapeItem, "Input for rotation is not a shape");
        const inputDefinition = inputItem.definition;

        const rotatedDefinition = this.root.shapeDefinitionMgr.shapeActionRotateCCW(inputDefinition);
        payload.outItems.push({
            item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(rotatedDefinition),
        });
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_ROTATOR_180(payload) {
        const inputItem = /** @type {ShapeItem} */ (payload.items.get(0));
        assert(inputItem instanceof ShapeItem, "Input for rotation is not a shape");
        const inputDefinition = inputItem.definition;

        const rotatedDefinition = this.root.shapeDefinitionMgr.shapeActionRotate180(inputDefinition);
        payload.outItems.push({
            item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(rotatedDefinition),
        });
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_STACKER(payload) {
        const lowerItem = /** @type {ShapeItem} */ (payload.items.get(0));
        const upperItem = /** @type {ShapeItem} */ (payload.items.get(1));

        assert(lowerItem instanceof ShapeItem, "Input for lower stack is not a shape");
        assert(upperItem instanceof ShapeItem, "Input for upper stack is not a shape");

        const stackedDefinition = this.root.shapeDefinitionMgr.shapeActionStack(
            lowerItem.definition,
            upperItem.definition
        );
        payload.outItems.push({
            item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(stackedDefinition),
        });
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_TRASH(payload) {
        // Do nothing ..
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_MIXER(payload) {
        // Find both colors and combine them
        const item1 = /** @type {ColorItem} */ (payload.items.get(0));
        const item2 = /** @type {ColorItem} */ (payload.items.get(1));
        assert(item1 instanceof ColorItem, "Input for color mixer is not a color");
        assert(item2 instanceof ColorItem, "Input for color mixer is not a color");

        const color1 = item1.color;
        const color2 = item2.color;

        // Try finding mixer color, and if we can't mix it we simply return the same color
        const mixedColor = enumColorMixingResults[color1][color2];
        let resultColor = color1;
        if (mixedColor) {
            resultColor = mixedColor;
        }
        payload.outItems.push({
            item: COLOR_ITEM_SINGLETONS[resultColor],
        });
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_PAINTER(payload) {
        const shapeItem = /** @type {ShapeItem} */ (payload.items.get(0));
        const colorItem = /** @type {ColorItem} */ (payload.items.get(1));

        const colorizedDefinition = this.root.shapeDefinitionMgr.shapeActionPaintWith(
            shapeItem.definition,
            colorItem.color
        );

        payload.outItems.push({
            item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(colorizedDefinition),
        });
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_PAINTER_DOUBLE(payload) {
        const shapeItem1 = /** @type {ShapeItem} */ (payload.items.get(0));
        const shapeItem2 = /** @type {ShapeItem} */ (payload.items.get(1));
        const colorItem = /** @type {ColorItem} */ (payload.items.get(2));

        assert(shapeItem1 instanceof ShapeItem, "Input for painter is not a shape");
        assert(shapeItem2 instanceof ShapeItem, "Input for painter is not a shape");
        assert(colorItem instanceof ColorItem, "Input for painter is not a color");

        const colorizedDefinition1 = this.root.shapeDefinitionMgr.shapeActionPaintWith(
            shapeItem1.definition,
            colorItem.color
        );

        const colorizedDefinition2 = this.root.shapeDefinitionMgr.shapeActionPaintWith(
            shapeItem2.definition,
            colorItem.color
        );
        payload.outItems.push({
            item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(colorizedDefinition1),
        });

        payload.outItems.push({
            item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(colorizedDefinition2),
        });
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_PAINTER_QUAD(payload) {
        const shapeItem = /** @type {ShapeItem} */ (payload.items.get(0));
        assert(shapeItem instanceof ShapeItem, "Input for painter is not a shape");

        /** @type {Array<enumColors>} */
        const colors = [null, null, null, null];
        for (let i = 0; i < 4; ++i) {
            const colorItem = /** @type {ColorItem} */ (payload.items.get(i + 1));
            if (colorItem) {
                colors[i] = colorItem.color;
            }
        }

        const colorizedDefinition = this.root.shapeDefinitionMgr.shapeActionPaintWith4Colors(
            shapeItem.definition,
            /** @type {[string, string, string, string]} */ (colors)
        );

        payload.outItems.push({
            item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(colorizedDefinition),
        });
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_READER(payload) {
        // Pass through the item
        const item = payload.items.get(0);
        payload.outItems.push({
            item,
            doNotTrack: true,
        });

        // Track the item
        const readerComp = payload.entity.components.BeltReader;
        readerComp.lastItemTimes.push(this.root.time.now());
        readerComp.lastItem = item;
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_HUB(payload) {
        const hubComponent = payload.entity.components.Hub;
        assert(hubComponent, "Hub item processor has no hub component");

        // Hardcoded
        for (let i = 0; i < payload.inputCount; ++i) {
            const item = /** @type {ShapeItem} */ (payload.items.get(i));
            if (!item) {
                continue;
            }
            this.root.hubGoals.handleDefinitionDelivered(item.definition);
        }
    }

    /**
     * @param {ProcessorImplementationPayload} payload
     */
    process_GOAL(payload) {
        const goalComp = payload.entity.components.GoalAcceptor;
        const item = payload.items.get(0);
        const now = this.root.time.now();

        if (goalComp.item && !item.equals(goalComp.item)) {
            goalComp.clearItems();
        } else {
            goalComp.currentDeliveredItems = Math.min(
                goalComp.currentDeliveredItems + 1,
                globalConfig.goalAcceptorItemsRequired
            );
        }

        if (this.root.gameMode.getIsEditor()) {
            // while playing in editor, assign the item
            goalComp.item = item;
        }

        goalComp.lastDelivery = {
            item,
            time: now,
        };
    }
}
