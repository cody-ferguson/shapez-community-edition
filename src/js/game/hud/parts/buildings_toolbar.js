import { MetaBalancerBuilding } from "../../buildings/balancer";
import { MetaBeltBuilding } from "../../buildings/belt";
import { MetaBlockBuilding } from "../../buildings/block";
import { MetaConstantProducerBuilding } from "../../buildings/constant_producer";
import { MetaCutterBuilding } from "../../buildings/cutter";
import { MetaDisplayBuilding } from "../../buildings/display";
import { MetaFilterBuilding } from "../../buildings/filter";
import { MetaGoalAcceptorBuilding } from "../../buildings/goal_acceptor";
import { MetaItemProducerBuilding } from "../../buildings/item_producer";
import { MetaLeverBuilding } from "../../buildings/lever";
import { MetaMinerBuilding } from "../../buildings/miner";
import { MetaMixerBuilding } from "../../buildings/mixer";
import { MetaPainterBuilding } from "../../buildings/painter";
import { MetaReaderBuilding } from "../../buildings/reader";
import { MetaRotatorBuilding } from "../../buildings/rotator";
import { MetaStackerBuilding } from "../../buildings/stacker";
import { MetaStorageBuilding } from "../../buildings/storage";
import { MetaTrashBuilding } from "../../buildings/trash";
import { MetaUndergroundBeltBuilding } from "../../buildings/underground_belt";
import { HUDBaseToolbar } from "./base_toolbar";

export class HUDBuildingsToolbar extends HUDBaseToolbar {
    constructor(root) {
        super(root, {
            primaryBuildings: [
                MetaConstantProducerBuilding,
                MetaGoalAcceptorBuilding,
                MetaBeltBuilding,
                MetaBalancerBuilding,
                MetaUndergroundBeltBuilding,
                MetaMinerBuilding,
                MetaBlockBuilding,
                MetaCutterBuilding,
                MetaRotatorBuilding,
                MetaStackerBuilding,
                MetaMixerBuilding,
                MetaPainterBuilding,
                MetaTrashBuilding,
                MetaItemProducerBuilding,
            ],
            secondaryBuildings: [
                MetaStorageBuilding,
                MetaReaderBuilding,
                MetaLeverBuilding,
                MetaFilterBuilding,
                MetaDisplayBuilding,
            ],
            visibilityCondition: () =>
                !this.root.camera.getIsMapOverlayActive() && this.root.currentLayer === "regular",
            htmlElementId: "ingame_HUD_BuildingsToolbar",
        });
    }
}
