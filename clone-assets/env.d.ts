interface ImportMetaEnv {
  readonly VITE_PERSONAL_ACCESS_TOKEN: string;
  readonly VITE_SOURCE_SPACE_ID: number;
  readonly VITE_TARGET_SPACE_ID: number;
  readonly VITE_SIMULTANEOUS_UPLOADS: number;
  readonly VITE_SOURCE_SPACE_REGION: string;
  readonly VITE_TARGET_SPACE_REGION: string;
  readonly VITE_CLEAR_SOURCE?: "true" | "false";
  readonly VITE_DETECT_IMAGE_SIZE?: "true" | "false";
  readonly VITE_USED_ASSETS_ONLY?: "true" | "false";
  readonly VITE_DUPLICATE_FOLDERS?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
