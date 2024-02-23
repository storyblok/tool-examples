require("dotenv").config();
// BEGIN: Configuration

const oauthToken = process.env.OAUTH_TOKEN;
const spaceId = parseInt(process.env.SPACE_ID);
let folderToAssign;
// END: Configuration

const StoryblokClient = require("storyblok-js-client");

const Storyblok = new StoryblokClient({
  oauthToken: oauthToken,
});

let filenames = [];

const Sync = {
  _getAll(type, page) {
    console.log(`Getting page ${page} of ${type}`);
    return Storyblok.get(`spaces/${spaceId}/${type}`, {
      per_page: 100,
      story_only: 1,
      page: page,
      with_alts: 1,
    });
  },
  async checkAndCreateFolder() {
    try {
      const response = await Storyblok.get(`spaces/${spaceId}/asset_folders`);
      const folders = response.data.asset_folders;

      // Check if the folder with the desired name exists
      const folder = folders.find((folder) => folder.name === "unused-assets");

      if (!folder) {
        console.log(`Folder 'unused-assets' does not exist. Creating it...`);
        const newFolder = await Storyblok.post(
          `spaces/${spaceId}/asset_folders`,
          {
            name: "unused-assets", // Modify the name as needed
            parent_id: null, // Assuming it's a root folder, modify if needed
          }
        );
        folderToAssign = newFolder.data.asset_folder.id;
        console.log(
          `Folder 'unused-assets' created with ID ${folderToAssign}.`
        );
      } else {
        folderToAssign = folder.id;
      }
    } catch (error) {
      console.error(error.message);
      process.exit(1); // Exit the process with an error code
    }
  },
  async getAll(type) {
    let page = 1;
    const res = await this._getAll(type, page);
    const all = res.data[type];
    const lastPage = Math.ceil(res.total / 100);

    while (page < lastPage) {
      page++;
      res = await this._getAll(type, page);
      res.data[type].forEach((story) => {
        all.push(story);
      });
    }
    return all;
  },

  traverse(tree) {
    const traverse = function (jtree) {
      if (jtree?.constructor === Array) {
        for (let item = 0; item < jtree.length; item++) {
          traverse(jtree[item]);
        }
      } else if (jtree?.constructor === Object) {
        for (let treeItem in jtree) {
          traverse(jtree[treeItem]);
        }
      } else if (jtree?.constructor === String) {
        let idx = -1;
        if (jtree) {
          for (let i = 0; i < filenames.length; i++) {
            if (filenames[i].indexOf(jtree) > -1) {
              idx = i;
            }
          }
        }
        if (idx > -1) {
          console.log(`${jtree} found`);
          filenames.splice(idx, 1);
        }
      }
    };

    traverse(tree);
    return tree;
  },

  async processAllStories() {
    const stories = await this.getAll("stories");
    const assets = await this.getAll("assets");
    filenames = assets.map((item) => {
      return item.filename.replace("https://s3.amazonaws.com/", "https://");
    });

    for (let i = 0; i < stories.length; i++) {
      const res = await Storyblok.get(
        `spaces/${spaceId}/stories/${stories[i].id}`
      );
      console.log(`Searching in ${res.data.story.full_slug}`);
      this.traverse(res.data.story.content);
    }

    for (let j = 0; j < filenames.length; j++) {
      const asset = assets.filter((item) => {
        return (
          item.filename.replace("https://s3.amazonaws.com/", "https://") ==
          filenames[j]
        );
      });
      await Storyblok.put(`spaces/${spaceId}/assets/${asset[0].id}`, {
        asset: { asset_folder_id: folderToAssign },
      });
      console.log(`Asset ${asset[0].id} moved to folder ${folderToAssign}`);
    }

    return stories;
  },
};

// Call the checkAndCreateFolder function before processing all stories
Sync.checkAndCreateFolder().then(() => {
  Sync.processAllStories();
});
