
<img src="https://a.storyblok.com/f/51376/x/19b4879a86/logo.svg" width="200" alt="Storyblok Logo">

# Tool Examples

A collection of tools for Storyblok created by the community. Read more about creating tools [here](https://www.storyblok.com/docs/plugins/introduction)

<!-- AUTO-GENERATED-CONTENT:START (TOC:collapse=true&collapseText=Table of Content) -->
<details>
<summary>Table of Content</summary>

- [Examples](#examples)
- [Example Repositories](#example-repositories)
- [Contributing](#contributing)

</details>
<!-- AUTO-GENERATED-CONTENT:END -->

## Examples

Each example contains a `README.md` with an explanation about the field-type.

<!-- AUTO-GENERATED-CONTENT:START (EXAMPLE_TABLE)  -->
| Example  | Author |
|:-------|:------:|
| **[Clean Up Field Script ](https://github.com/storyblok/field-type-examples/tree/main/clean-up-field)** <br/>  A tool to remove a specific field from all stories  |  [Alexander Feiglstorfer](https://github.com/onefriendaday) |

<!-- AUTO-GENERATED-CONTENT:END -->

## Example Repositories

The following examples live in their own Github repository.

<!-- AUTO-GENERATED-CONTENT:START (COMMUNITY_EXAMPLES_TABLE)-->
| Example | Author |
|:-------|:------:|
| **[Storyblok Migrate](https://github.com/maoberlehner/storyblok-migrate)** <br/> Migration tool from Storyblok (Import/Export of schemas and content) | [maoberlehner](http://github.com/maoberlehner) |
| **[Sb Mig](https://github.com/sb-mig/sb-mig)** <br/> CLI tool to handle migrations and components in Storyblok | [sb-mig](http://github.com/sb-mig) |
<!-- AUTO-GENERATED-CONTENT:END -->
## Contributing

**Have an example?** Submit a PR or [open an issue]().We are happy to accept more examples from the community.

<details>
<summary>Adding an example in this repository</summary>

1. Create a new folder for your tool

2. Add a `README.md` file in your example folder with a markdown table of the following format:

Name | Description | Author
------------ | ------------- | -------------
Name of your tool | Short description | [Your Github](https://github.com/lisilinhart/)

3. Make sure your contribution matches the linting setup for this repo:

  Run the linting via

  ```bash
  npm run lint
  ```

4. Regenerate the README.md with the following command

  ```bash
  npm run docs
  ```

5. Open a new pull request with your example. ⚡️
</details>


<details>
<summary>Adding an example in a different repository</summary>


If you want to be listed in the [Example Repositories](#example-repositories), follow these steps:

1. Create a new entry with a `name`, `description`, and `githubUrl` in the `community-examples.json` file.

2. Regenerate the README.md with the following command

  ```bash
  npm run docs
  ```

3. Open a new pull request with your example.


</details>

