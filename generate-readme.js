const fs = require('fs');
const path = require('path');
const url = require('url');
const markdownMagic = require('markdown-magic'); // eslint-disable-line
const globby = require('markdown-magic').globby; // eslint-disable-line

const toTitleCase = (str) => { // eslint-disable-line
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

const formatPluginName = (string) => { // eslint-disable-line
  return toTitleCase(string.replace(/-/g, ' '));
};

const username = (repo) => {
  if (!repo) {
    return null;
  }

  const o = url.parse(repo);
  var urlPath = o.path; // eslint-disable-line

  if (urlPath.length && urlPath.charAt(0) === '/') {
    urlPath = urlPath.slice(1);
  }

  urlPath = urlPath.split('/')[0];
  return urlPath;
};

const config = {
  transforms: {
    /*
    In README.md the below function will add a list from Readme files in the folders
     */
    EXAMPLE_TABLE() {
      const examples = globby.sync(['**/README.md', '!README.md', '!node_modules/**/package.json', '!**/node_modules/**/README.md', '!README.md', '!**/bin/**/netcoreapp2.1/**/README.md']);
      // Make table header
      let md = '| Example  | Author |\n';
      md += '|:-------|:------:|\n';
      examples.forEach((example) => {
        const data = fs.readFileSync(example, 'utf8');
        const readme = data.toString().split(/\r?\n/);
        const tableLine = readme.find(l => l.startsWith('Name'));
        const tableIndex = readme.indexOf(tableLine);
        const [name, description, author] = readme[tableIndex + 2].split('|');
        const dirname = path.dirname(example);
        const exampleUrl = `https://github.com/storyblok/field-type-examples/tree/main/${dirname}`;
        // add table rows
        md += `| **[${formatPluginName(name)}](${exampleUrl})** <br/> ${description} | ${author} |\n`;
      });

      return md;
    },

    /*
    In README.md the below function will add a list from the community-examples.json file
    */

    COMMUNITY_EXAMPLES_TABLE() {
      const exampleFile = path.join(__dirname, 'community-examples.json');
      const examples = JSON.parse(fs.readFileSync(exampleFile, 'utf8'));
      // Make table header
      let md = '| Example | Author |\n';
      md += '|:-------|:------:|\n';
      // Sort alphabetically
      examples.sort((a, b) => a.name < b.name ? -1 : 1).forEach((data) => { // eslint-disable-line
        // add table rows
        const userName = username(data.githubUrl);
        const profileURL = `http://github.com/${userName}`;
        md += `| **[${formatPluginName(data.name)}](${data.githubUrl})** <br/>`;
        md += ` ${data.description} | [${userName}](${profileURL}) |\n`;
      });
      return md.replace(/^\s+|\s+$/g, '');
    },
  },
};


const markdownPath = path.join(__dirname, 'README.md');

markdownMagic(markdownPath, config, () => {
  console.log('Docs updated!'); // eslint-disable-line
});
