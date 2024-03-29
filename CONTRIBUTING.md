# Contributing to Sema

:+1::tada: Thanks so much for taking the time to contribute! :tada::+1:

The following is a set of guidelines for contributing to Sema and its engine, the sema-engine, which are hosted here on GitHub. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

#### Table Of Contents

[Code of Conduct](#code-of-conduct)

[I don't want to read this whole thing, I just have a question!!!](#i-dont-want-to-read-this-whole-thing-i-just-have-a-question)

[What should I know before I get started?](#what-should-i-know-before-i-get-started)
  * [What is the architecture of Sema?](https://github.com/mimic-sussex/sema/wiki/1.-The-Architecture-of-Sema)
  * [How can I debug Sema?](https://github.com/mimic-sussex/sema/wiki/3.-How-can-I-debug-Sema%3F)

[How Can I Contribute?](#how-can-i-contribute)
  * [Reporting Bugs](#reporting-bugs)
  * [Suggesting Enhancements](#suggesting-enhancements)
  * [Your First Code Contribution](#your-first-code-contribution)
  * [Pull Requests](#pull-requests)
  *	[Styleguides](#styleguides)
  * [Git Commit Messages](#git-commit-messages)
  <!--* [JavaScript Styleguide](#javascript-styleguide)
  * [Specs Styleguide](#specs-styleguide)
  * [Documentation Styleguide](#documentation-styleguide) -->

<!-- [Additional Notes](#additional-notes)
  * [Issue and Pull Request Labels](#issue-and-pull-request-labels) -->


## Code of Conduct

This project and everyone participating in it is governed by the [Sema Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [sema.live.coding@gmail.com](mailto:sema.live.coding@gmail.com).


## I don't want to read this whole thing I just have a question!!!

> **Note:** [Please don't file an issue to ask a question.]() You'll get faster results by using the resources below. Reach out on our community Discord channel if you are stuck.

## What should I know before I get started?
Sema consists of two main packages, [sema](https://github.com/mimic-sussex/sema) and the [sema-engine](https://github.com/mimic-sussex/sema-engine). The sema repo deals with everything you see on the front end side of things and works as an interface between the engine and the many other components such as the backend. The engine on the other hand is what deals with running the core components of sema under the hood. Language compilation, language creation, sound generation and running code from the javascript editor.

It also relies on many other open source projects. To list some of the main ones we use
- [Svelte](https://svelte.dev/) for everything on the frontend.
- [Routify](https://routify.dev/) for routing on the site.
- [Supabase](https://supabase.com/) for the backend.
- [Nearley](https://nearley.js.org/) for language creation.
- [Maximillian](https://github.com/micknoise/Maximilian) for all things sound.

Sema is quite a big project with many components and areas. If you feel intimidated the best thing to do is look at specific cases/areas of how things have been done already and try copy and build from them. For example, you want to build a widget? Look at how a fairly simple widget such as the liveCodeParserOutput is implemented, consumes output from the engine and displays it as a svelte component. The internal [sema documentation](https://sema.codes/docs) as well as the [github wiki](https://github.com/mimic-sussex/sema/wiki) are also valuable resources if you want to learn more.
## How Can I Contribute

### Reporting Bugs

This section guides you through submitting a bug report for Sema. Following these guidelines helps maintainers and the community understand your report :pencil:, reproduce the behavior :computer: :computer:, and find related reports :mag_right:.

Before creating bug reports, please check [this list](#before-submitting-a-bug-report) as you might find out that you don't need to create one. When you are creating a bug report, please [include as many details as possible](#how-do-i-submit-a-good-bug-report).

> **Note:** If you find a **Closed** issue that seems like it is the same thing that you're experiencing, open a new issue and include a link to the original issue in the body of your new one.

#### Before Submitting A Bug Report

* **Check the [debugging guide](https://github.com/mimic-sussex/sema/wiki/3.-How-can-I-debug-Sema%3F).** You might be able to find the cause of the problem and fix things yourself. Most importantly, check if you can reproduce the problem in the latest version of Sema. This will always be on the [develop branch](https://github.com/mimic-sussex/sema/tree/develop).

* **Perform a [cursory search](https://github.com/search?q=+is:issue+user:mimic-sussex)** to see if the problem has already been reported. If it has **and the issue is still open**, add a comment to the existing issue instead of opening a new one.

#### How Do I Submit A (Good) Bug Report?

Bugs are tracked as [GitHub issues](https://guides.github.com/features/issues/). After you've determined [which repository](https://github.com/mimic-sussex/sema/blob/master/package.json) your bug is related to, create an issue on the repository and provide the following information by filling in the template below:

##### Description

<!-- Description of the issue -->

##### Steps to Reproduce

1. <!-- First Step -->
2. <!-- Second Step -->
3. <!-- and so on… -->

**Expected behavior:**

<!-- What you expect to happen -->

**Actual behavior:**

<!-- What actually happens -->

**Reproduces how often:**

<!-- What percentage of the time does it reproduce? -->

##### Versions

<!-- Also, please include the OS and what version of the OS you're running, the browser and the the browser version, node version etc -->

##### Additional Information

<!-- Any additional information, configuration or data that might be necessary to reproduce the issue. -->


Explain the problem and include additional details to help maintainers reproduce the problem:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible. For example, start by explaining how you started Sema, e.g. which command exactly you used in the playground or tutorial. When listing steps, **don't just say what you did, but explain how you did it**. For example, if you moved the cursor to the end of a line, explain if you used the mouse, or a keyboard shortcut or an Sema command, and if so which one?
* **Provide specific examples to demonstrate the steps**. Include links to files or GitHub projects, or copy/pasteable snippets, which you use in those examples. If you're providing snippets in the issue, use [Markdown code blocks](https://help.github.com/articles/markdown-basics/#multiple-lines).
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**
* **Include screenshots and animated GIFs** which show you following the described steps and clearly demonstrate the problem. You can use [this tool](https://www.cockos.com/licecap/) to record GIFs on macOS and Windows, and [this tool](https://github.com/colinkeenan/silentcast) or [this tool](https://github.com/GNOME/byzanz) on Linux.
* **If the problem wasn't triggered by a specific action**, describe what you were doing before the problem happened and share more information using the guidelines below.

Provide more context by answering these questions:

* **Did the problem start happening recently** (e.g. after updating to a new version of Sema) or was this always a problem?
* **Can you reliably reproduce the issue?** If not, provide details about how often the problem happens and under which conditions it normally happens.

Include details about your configuration and environment:

* **Which browser and what version are you using?** You can get the exact version by by checking the About section on the application menu .
* **What's the name and version of the OS you're using**?
* **What's the name and version of node/npm you're using**?

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Sema, including completely new features and minor improvements to existing functionality. Following these guidelines helps maintainers and the community understand your suggestion :pencil: and find related suggestions :mag_right:.

Before creating enhancement suggestions, please check [this list](#before-submitting-an-enhancement-suggestion) as you might find out that you don't need to create one. When you are creating an enhancement suggestion, please [include as many details as possible](#how-do-i-submit-a-good-enhancement-suggestion), including the steps that you imagine you would take if the feature you're requesting existed.

#### Before Submitting An Enhancement Suggestion

* **Check the [debugging guide](https://github.com/mimic-sussex/sema/wiki/3.-How-can-I-debug-Sema%3F)** for tips — you might discover that the enhancement is already available.
* **Determine [which labels the enhancement should be suggested with](https://github.com/mimic-sussex/sema/labels).**
* **Perform a [cursory search](https://github.com/search?q=+is:issue+user:mimic-sussex)** to see if the enhancement has already been suggested. If it has, add a comment to the existing issue instead of opening a new one.

#### How Do I Submit A (Good) Enhancement Suggestion?

Enhancement suggestions are tracked as [GitHub issues](https://guides.github.com/features/issues/). After you've determined which part of Sema your enhancement suggestion is related to, create an issue on that repository and provide the following information:

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Provide specific examples to demonstrate the steps**. Include copy/pasteable snippets which you use in those examples, as [Markdown code blocks](https://help.github.com/articles/markdown-basics/#multiple-lines).
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Include screenshots and animated GIFs** which help you demonstrate the steps or point out the part of Sema which the suggestion is related to. You can use [this tool](https://www.cockos.com/licecap/) to record GIFs on macOS and Windows, and [this tool](https://github.com/colinkeenan/silentcast) or [this tool](https://github.com/GNOME/byzanz) on Linux.
* **Explain why this enhancement would be useful** to most Sema users and isn't something that can or should be implemented.
* **List some other similar websites or applications where this enhancement exists.**

### Your first code contribution
Browse the issues and look for labels with ```good first issue``` or ```help wanted```. These are a good place to start if you want to contribute but stuck with what to do.

### Pull requests
When making pull requests to the repository, make sure to follow these guidelines for both bug fixes and new features:

- Before creating a pull request, file a GitHub Issue so that maintainers and the community can discuss the problem and potential solutions before you spend time on an implementation.
- In your PR's description, link to any related issues or pull requests to give reviewers the full context of your change.
- Make sure you commit messages are highly descriptive of the change you are making.
### Style guides
Check out our [design guide wiki page](https://github.com/mimic-sussex/sema/wiki/Design-Guide) on our design choices and style guides for within sema itself.

#### Git commit messages
* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line
* Consider starting the commit message with an applicable emoji:
    * :art: `:art:` when improving the format/structure of the code
    * :racehorse: `:racehorse:` when improving performance
    * :non-potable_water: `:non-potable_water:` when plugging memory leaks
    * :memo: `:memo:` when writing docs
    * :penguin: `:penguin:` when fixing something on Linux
    * :apple: `:apple:` when fixing something on macOS
    * :checkered_flag: `:checkered_flag:` when fixing something on Windows
    * :bug: `:bug:` when fixing a bug
    * :fire: `:fire:` when removing code or files
    * :white_check_mark: `:white_check_mark:` when adding tests
    * :lock: `:lock:` when dealing with security
    * :arrow_up: `:arrow_up:` when upgrading dependencies
    * :arrow_down: `:arrow_down:` when downgrading dependencies
    * :shirt: `:shirt:` when removing linter warnings