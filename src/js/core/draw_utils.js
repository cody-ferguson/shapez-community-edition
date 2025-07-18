/**
 * @typedef {import("./sprites").AtlasSprite} AtlasSprite
 * @typedef {import("./draw_parameters").DrawParameters} DrawParameters
 */

import { globalConfig } from "./config";
import { createLogger } from "./logging";
import { Rectangle } from "./rectangle";

const logger = createLogger("draw_utils");

/**
 *
 * @param {object} param0
 * @param {DrawParameters} param0.parameters
 * @param {AtlasSprite} param0.sprite
 * @param {number} param0.x
 * @param {number} param0.y
 * @param {number} param0.angle
 * @param {number} param0.size
 * @param {number=} param0.offsetX
 * @param {number=} param0.offsetY
 */
export function drawRotatedSprite({ parameters, sprite, x, y, angle, size, offsetX = 0, offsetY = 0 }) {
    if (angle === 0) {
        sprite.drawCachedCentered(parameters, x + offsetX, y + offsetY, size);
        return;
    }

    parameters.context.translate(x, y);
    parameters.context.rotate(angle);
    sprite.drawCachedCentered(parameters, offsetX, offsetY, size, false);
    parameters.context.rotate(-angle);
    parameters.context.translate(-x, -y);
}

let warningsShown = 0;

/**
 * Draws a sprite with clipping
 * @param {object} param0
 * @param {DrawParameters} param0.parameters
 * @param {HTMLCanvasElement} param0.sprite
 * @param {number} param0.x
 * @param {number} param0.y
 * @param {number} param0.w
 * @param {number} param0.h
 * @param {number} param0.originalW
 * @param {number} param0.originalH
 * @param {boolean=} param0.pixelAligned
 * Whether to round the canvas coordinates, to avoid issues with transparency between tiling images
 */
export function drawSpriteClipped({
    parameters,
    sprite,
    x,
    y,
    w,
    h,
    originalW,
    originalH,
    pixelAligned = false,
}) {
    const rect = new Rectangle(x, y, w, h);
    const intersection = rect.getIntersection(parameters.visibleRect);
    if (!intersection) {
        // Clipped
        if (++warningsShown % 200 === 1) {
            logger.warn(
                "Sprite drawn clipped but it's not on screen - perform culling before (",
                warningsShown,
                "warnings)"
            );
        }
        if (G_IS_DEV && globalConfig.debug.testClipping) {
            parameters.context.fillStyle = "yellow";
            parameters.context.fillRect(x, y, w, h);
        }
        return;
    }

    if (!pixelAligned) {
        parameters.context.drawImage(
            sprite,

            // src pos and size
            ((intersection.x - x) / w) * originalW,
            ((intersection.y - y) / h) * originalH,
            (originalW * intersection.w) / w,
            (originalH * intersection.h) / h,

            // dest pos and size
            intersection.x,
            intersection.y,
            intersection.w,
            intersection.h
        );
        return;
    }

    const matrix = parameters.context.getTransform();
    let { x: x1, y: y1 } = matrix.transformPoint(new DOMPoint(intersection.x, intersection.y));
    let { x: x2, y: y2 } = matrix.transformPoint(
        new DOMPoint(intersection.x + intersection.w, intersection.y + intersection.h)
    );
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    x2 = Math.round(x2);
    y2 = Math.round(y2);
    if (x2 - x1 == 0 || y2 - y1 == 0) {
        return;
    }

    parameters.context.resetTransform();
    parameters.context.drawImage(
        sprite,

        // src pos and size
        ((intersection.x - x) / w) * originalW,
        ((intersection.y - y) / h) * originalH,
        (originalW * intersection.w) / w,
        (originalH * intersection.h) / h,

        // dest pos and size
        x1,
        y1,
        x2 - x1,
        y2 - y1
    );
    parameters.context.setTransform(matrix);
}
