# Getting Started

Welcome to **vmblu** — the *visual model blueprint* for building reliable, maintainable software with AI and architecture.

This guide helps you install the **vmblu editor** (as a VS Code extension), create your first model, and run it using the built-in runtime tools.

---

## ⚠️ Heads-Up: Pre-1.0 Version

vmblu is currently in version **0.9.0** — nearing its first stable release.

The editor is already **fully functional**, and you can build, edit, and run models today. That said, as the project is being opened to a wider developer audience, **new bugs and edge cases may still surface**.

We welcome early adopters and feedback! Expect frequent updates as we work toward a 1.0 release within the next few months.

> 💬 Found something? Please open an issue or discussion on [GitHub](https://github.com/vizualmodel/vmblu/issues).

---

## 1. Requirements

Before you start, make sure you have:

- [Visual Studio Code](https://code.visualstudio.com/) (latest stable version)
- [Node.js](https://nodejs.org/) (if you want to run models or use CLI tools)

---

## 2. Installing the vmblu Extension

### Method 1: From the VS Code Marketplace

1. Open VS Code  
2. Go to the **Extensions** view (`Ctrl+Shift+X`)  
3. Search for **vmblu**  
4. Click **Install**

> 📦 Or install directly from the [Marketplace link](#).

### Method 2: Manual `.vsix` Installation (optional)

As an alternative to the installations described above, you can also download the .vsix file for the extension and install locally.
You can find the *vmblu-0.0.1.vsix* file for this extension in the vscodex directory of this repo. Download it and then select extensions (`Ctrl+Shift+X`), select the '...' menu at the top right of the extensions pane, and click on *install from VSIX...* and then select the .vsix file that you have downloaded.

---

## 3. Creating Your First Model

The file extension used by **vmblu** for its models is .vmblu, so simply create a new file with that extension and you are ready to go.

Because .vmblu files are in json format, you can also open these files with the built-in text editor. To do that left-click on the file name in the explorer and select *Open With...* from the popup menu and then select the text-editor from the menu.

You can also have a look at the examples included in the distribution and play around with these.

---

## 4. Running a model

The model that you have built will be compiled to a runable .js file. Normally you would do this in the editor by selecting an option in the main menu, but you can also do this using a cli command. You can run that .js file using the tools that you normally use for your application, whether it is a node-based application or an application that runs in the browser. Because it is very helpfull when developping and debugging, we often use *vite*, but again that's just one of the possibilties. The resulting .js file can also be used as the starting point to make a bundle of course.

The format of the compiled file is given in the user-guide, but in that file the required runtime is imported and started automatically, so you do not have to do anything extra for this.

## 5. Using the CLI (Optional)
Install the CLI globally:

```bash
npm install -g vmblu-cli
```
Available commands:

```bash
vmblu scaffold NodeName            # Create a scaffold for a new node
vmblu generate tools model.vmblu  # Generate a tools.json file for LLMs
```
📘 See ai-integration.md for how to use vmblu with OpenAI or other LLMs.

6. Next Steps

- Learn the vmblu file format
- Master the editor features
- Run and debug with the runtime tools
- Integrate AI using tools and MCP
- Browse or create standard reusable nodes


📣 Feedback & Community
vmblu is open source and community-driven.
We welcome contributions, feature requests, and ideas:

🛠 GitHub Issues: github.com/vizualmodel/vmblu/issues

💬 Discussions: github.com/vizualmodel/vmblu/discussions

🌐 Website: https://vmblu.dev


→ vmblu