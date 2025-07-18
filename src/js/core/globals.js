/* typehints:start */
import { Application } from "../application";
/* typehints:end */

/**
 * Used for the bug reporter, and the click detector which both have no handles to this.
 * It would be nicer to have no globals, but this is the only one. I promise!
 * @type {Application} */
export let GLOBAL_APP = null;

/**
 * @param {Application} app
 */
export function setGlobalApp(app) {
    assert(!GLOBAL_APP, "Tried to set GLOBAL_APP twice");
    GLOBAL_APP = app;
}

export const BUILD_OPTIONS = {
    APP_ENVIRONMENT: G_APP_ENVIRONMENT,
    IS_DEV: G_IS_DEV,
    IS_RELEASE: G_IS_RELEASE,
    BUILD_TIME: G_BUILD_TIME,
    BUILD_COMMIT_HASH: G_BUILD_COMMIT_HASH,
    BUILD_VERSION: G_BUILD_VERSION,
    ALL_UI_IMAGES: G_ALL_UI_IMAGES,
};
