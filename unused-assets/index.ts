import CleanUpAssets from "./src/index"

const spaceId = import.meta.env.VITE_SPACE_ID;
const region = import.meta.env.VITE_REGION;
const paToken = import.meta.env.VITE_PERSONAL_ACCESS_TOKEN;
const deleteAssets = import.meta.env.VITE_DELETE_ASSETS?.toLowerCase() === "true";
const filterOnlyDuplicates = import.meta.env.VITE_FILTER_ONLY_DUPLICATES?.toLowerCase() === "true";
const folderName = import.meta.env.VITE_FOLDER_NAME;

const cleanUpProcess = new CleanUpAssets(paToken, spaceId, region, deleteAssets, filterOnlyDuplicates, folderName);
cleanUpProcess.start();
