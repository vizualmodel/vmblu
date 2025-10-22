![logo](./assets/vmblu-512.png)
# Getting Started

Welcome to **vmblu** — the *visual model blueprint* for building intelligible, reliable and maintainable software with AI.

This guide helps you install the **vmblu editor** (as a VS Code extension), create your first model, and run it using the built-in runtime tools.

## 1. Requirements

Before you start, make sure you have:

- [Visual Studio Code](https://code.visualstudio.com/) (latest stable version)
- [Node.js](https://nodejs.org/) (if you want to run models or use CLI tools)

## 2. Install the vmblu Extension

### Method 1: From the VS Code Marketplace

1. Open VS Code  
2. Go to the **Extensions** view (`Ctrl+Shift+X`)  
3. Search for **vmblu**  
4. Click **Install**

📦 Or install directly from the [Marketplace link](#).

### Method 2: Manual `.vsix` Installation (optional)

As an alternative to the installations described above, you can also build the extension from the repo, command *npm run vx*, then select the extensions pane (`Ctrl+Shift+X`), select the '...' menu at the top right of the extensions pane, and click on *install from VSIX...* and then select the .vsix file in the *vmblu/vscodex* directory.

With the extension installed you can start building **vmblu models** in vscode. To run the application you also need the runtime lib.

## 3. Install the runtime and cli 

To run an application you need the *vmblu runtime lib*. There is also a *vmblu cli* available that contain a commands to easily set up a project. This is particularly helpful for setting up projects that want to use LLMs - but you can of course make your own setup.

The vmblu runtime lib and vmblu cli are part of this repo and can be built from scratch, but both are also conveniently available from *npm*:

* To install the runtime use: *npm install @vizualmodel/vmblu-runtime*
* To install the cli use: *npm install @vizualmodel/vmblu-cli* 

## 4. Create Your First Model

The file extension used by **vmblu** for its models is .vmblu, so simply create a new file with that extension and you are ready to go.

Because .vmblu files are in json format, you can also open these files with the built-in text editor. To do that left-click on the file name in the explorer and select *Open With...* from the popup menu and then select the text-editor from the menu.

You can also have a look at the examples included in the distribution and play around with these.

To set up a project for collaboration with an LLM, run *vmblu init project-name*. The command will create a directory, and empty model file and a number of refernce files for the LLM. In your prompt for the coding assistant that you use, instruct the LLM to first read the *llm/seed.md* file and follow up with a description of the application that you want to build.

## 5. Running a model

The model that you have built will be compiled to a runable .js file. Normally you would do this in the editor by selecting an option in the main menu, but you can also do this using a cli command. You can run that .js file using the tools that you normally use for your application, whether it is a node-based application or an application that runs in the browser. Because it is very helpfull when developping and debugging, we often use *vite*, but again that's just one of the possibilties. The resulting .js file can also be used as the starting point to make a bundle.


## 6. Next Steps

On the https://vmblu.dev website you can find the *user guide* and a *tutorial* that gives more details about how to work with **vmblu** models.

In this repo there is also a directory *examples* that contains apps that you can work with to explore the features of vmblu.

If you are interested in contributing to the project - you are most welcome -  read [contribute](./CONTRIBUTE.md). 


📣 Feedback & Community
vmblu is open source and community-driven.
We welcome contributions, feature requests, and ideas:

🛠 GitHub Issues: github.com/vizualmodel/vmblu/issues

💬 Discussions: github.com/vizualmodel/vmblu/discussions

🌐 Website: https://vmblu.dev


→ vmblu