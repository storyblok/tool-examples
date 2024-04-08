interface ImportMetaEnv {
  readonly VITE_PERSONAL_ACCESS_TOKEN: string;
  readonly VITE_OAUTH_TOKEN: string;
  readonly VITE_SPACE_ID: number;
  readonly VITE_REGION: string;
  readonly VITE_FOLDER_NAME?: string;
  readonly VITE_DELETE_ASSETS?: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
