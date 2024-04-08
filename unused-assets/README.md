Name | Description | Author
------------ | ------------- | -------------
Storyblok Unused Assets | Detect unused assets and either move them to a folder or delete them. | [Christian Zoppi](https://github.com/christianzoppi), [Alexandra Spalato](https://github.com/alexadark) 

# Unused Assets Script - Move or delete them

Detect unused assets and either move them to a folder or delete them. By default it moves assets into a folder, but with the `VITE_DELETE_ASSETS` parameter set to `true`, it will delete them. Assets can then be recovered from the trashbin.

## How to use

1. Get your personal access token from the My account section of Storyblok.

2. Create an `.env` file with the content from `.env.example`.

3. Execute the script with`npm run start`

```bash
$ npm install
$ npm run start
```

## Parameters
- `VITE_PERSONAL_ACCESS_TOKEN`: Your Personal Access Token
- `VITE_SPACE_ID`: The Space ID of your project
- `VITE_REGION`: The region of your space
- `VITE_FOLDER_NAME` (optional, default: "Unused Assets"): The folder name where to move assets
- `VITE_DELETE_ASSETS` (optional, default "false"): Set to `true` if you want to delete the assets instead of moving them to a folder.
