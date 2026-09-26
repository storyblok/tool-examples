import Migration from "./src/index.js";

// Optionally use two least-privilege tokens: a read-only source token and a
// write target token. Falls back to the single VITE_PERSONAL_ACCESS_TOKEN
// when only one is provided.
const sourcePaToken =
  import.meta.env.VITE_SOURCE_PERSONAL_ACCESS_TOKEN ||
  import.meta.env.VITE_PERSONAL_ACCESS_TOKEN;
const targetPaToken =
  import.meta.env.VITE_TARGET_PERSONAL_ACCESS_TOKEN ||
  import.meta.env.VITE_PERSONAL_ACCESS_TOKEN;
const sourceSpaceId = import.meta.env.VITE_SOURCE_SPACE_ID;
const targetSpaceId = import.meta.env.VITE_TARGET_SPACE_ID;
const simultaneousUploads = import.meta.env.VITE_SIMULTANEOUS_UPLOADS;
const sourceSpaceRegion = import.meta.env.VITE_SOURCE_SPACE_REGION;
const targetSpaceRegion = import.meta.env.VITE_TARGET_SPACE_REGION;
const clearSource = import.meta.env.VITE_CLEAR_SOURCE?.toLowerCase() === "true";
const detectImageSize =
  import.meta.env.VITE_DETECT_IMAGE_SIZE?.toLowerCase() === "true";
const usedAssetsOnly =
  import.meta.env.VITE_USED_ASSETS_ONLY?.toLowerCase() === "true";
const duplicateFolders =
  import.meta.env.VITE_DUPLICATE_FOLDERS?.toLowerCase() === "true";
const limit = parseInt(import.meta.env.VITE_LIMIT) || 0;
const offset = parseInt(import.meta.env.VITE_OFFSET) || 0;
const assetsIds =
  typeof import.meta.env.VITE_ASSETS_IDS === "string"
    ? import.meta.env.VITE_ASSETS_IDS.split(",")
    : [];

const migration = new Migration(
  sourcePaToken,
  targetPaToken,
  sourceSpaceId,
  targetSpaceId,
  simultaneousUploads,
  sourceSpaceRegion,
  targetSpaceRegion,
  clearSource,
  detectImageSize,
  usedAssetsOnly,
  duplicateFolders,
  limit,
  offset,
  assetsIds
);
migration.start();
