![logo](./assets/vmblu-512.png)

**vmblu** is a tool that makes the architecture of your software explicit and easy to navigate — by humans *and* LLMs. 

Modern LLMs make it easy to “vibe code”. But as your app grows, features break, code bloat creeps in and the big picture fades.

**vmblu** fixes that by making your *architecture* **structured, visual, and AI-native**.

With **vmblu**, you can co-write your project with an LLM while keeping the architecture clear, the codebase maintainable, and the system navigable.

---
<span style="font-size:1.4em; color:#0066ff;"><b>■   What is vmblu?</b></span><br>

**vmblu** is a combination of a graphical editor, file format specs and prompts for building software as a **network of message-passing nodes** in collaboration with an LLM.

It’s:

- **AI-native** — LLMs can design the architecture, write the code and interact with the running system.
- A **visual modeler** that makes your architecture explicit and navigable  
- A **runnable scaffold** — models execute via the vmblu runtime  
- **Framework-agnostic** — use any stack or package

The **vmblu model** is not documentation, it is the actual system.

---
<span style="font-size:1.4em; color:#0066ff;"><b>■ The Editor</b></span><br>

The **vmblu editor** lets the human and the LLM work together on the architecture of a system:

- Create and connect nodes visually  
- Define message I/O via **pins**  
- Group subsystems into **group nodes**  
- Reuse components via **linked nodes** or **standard libraries**  
- Jump from the architecture file into the source code details instantly  

**vmblu** achieves clean connectivity by using

- **Busbars** — broadcast to all connected nodes  
- **Cables** — selective point-to-point  
- **Filters** — dynamic dispatch

The following is a screenshot from an application in vmblu:

![example of a vmblu model](./assets/vmblu-screenshot.png)

---
<span style="font-size:1.4em; color:#0066ff;"><b>■ AI-native by design</b></span><br>

**vmblu** was designed to let LLMs do the work, but to keep the human in the driver seat.

- **vmblu** was built for LLM integration from the start: the model format is LLM-friendly, so you and the AI can reason about and modify architecture together.
- The **vmblu model** with explicit and clear contracts between the building blocks, is a great help for an LLM to write the code for the nodes of the application.
- **vmblu** can generate an [MCP](https://github.com/modelcontext) tools file to call into a running system allowing to have an instant AI-based user interface at a granular level for your application.

---
<span style="font-size:1.4em; color:#0066ff;"><b>■ AI generated code poses new challenges</b></span><br>

When code is written or co-written by LLMs, the nature of risk changes. LLMs make far fewer syntax errors or trivial logic mistakes than human developers, but
the bigger challenges are:

- **Trustworthiness**: LLMs can hallucinate extra behavior, misinterpret user intent, or introduce malicious side-effects. We need assurance that nodes and systems do *only* what they are supposed to do.  
- **Efficiency**: LLMs may generate redundant or roundabout logic. Even if outputs are correct, wasted messages, loops, or hidden work can compromise performance and scalability.

**vmblu** gives you the tool you need to address these new challenges. Working from an explicit, shared architecture allows you to understand and test your system in the age of AI.

---
<span style="font-size:1.4em; color:#0066ff;"><b>■ For developers</b></span><br>

**vmblu** is a tool targeted at developers whose role is changing with the arrival of powerful AI.

**vmblu** is for developers building real, complex systems. It is an excellent foundation to build agentic systems. It gives you:

- Clear, maintainable architectural design  
- Modular components and reuse  
- Always-up-to-date documentation  (the model *is* the doc)
- Live reconfiguration and testing  
- AI collaboration through structure-aware tools  

Migrating an application to a **vmblu** based design is also not complicated. The vmblu editor itself is now a vmblu application.

**Message-based architectures** — the foundation of vmblu — bring their own advantages:

- Loose coupling with clear boundaries – Nodes only communicate through messages, not direct calls. You can refactor, replace, or test components independently.
- Natural concurrency and scalability – Messages are asynchronous by design; the same model runs locally, across threads, or distributed systems without change.
- Explicit communication contracts – Each message has a defined structure and meaning, making behavior transparent and machine-understandable.
- Traceable and testable – Every interaction flows through observable messages, enabling time-travel debugging, targeted tests, and reproducible runs.
- Evolvable and AI-friendly – The message graph becomes a stable backbone. Both humans and LLMs can extend it safely by adding messages or handlers without breaking existing logic. The node-based design also makes vmblu a natural fit for MCP-based (Model Context Protocol) interaction.

### ⚠️ Heads-Up: Pre-1.0 Version

vmblu is currently in version **0.9** — nearing its first official release.

The editor is already **fully functional**, and you can build, edit, and run models today. That said, as the project is being opened to a wider developer audience, **new bugs and edge cases may still surface**. We welcome early adopters and feedback! Expect frequent updates as we work toward a 1.0 release within the next weeks.

The tool will further evolve to address the new possibilities and challenges in this new era of software design.

💬 Found something? Please open an issue or discussion on [GitHub](https://github.com/vizualmodel/vmblu/issues).

---
<span style="font-size:1.4em; color:#0066ff;"><b>■ Quick start</b></span><br>

- Install the [VS Code extension](https://marketplace.visualstudio.com/)  
- Add the runtime and cli with: `npm install @vizualmodel/vmblu-runtime @vizualmodel/vmblu-cli`  
- Read more at 🌐 [vmblu.dev](https://vmblu.dev)  

---
<span style="font-size:1.4em; color:#0066ff;"><b>■ Contribute</b></span><br>

We welcome contributions from everyone! Here are the best ways to connect with us:

* **Public Discussions & Questions:** If you have an idea, a general question, or need support, please start a topic in our **[Discussions Tab]** (link to your repo's Discussions tab).
* **Actionable Work:** Found a bug or want to implement a feature? Check the **[Issues Tab]** to see what's being worked on.
* **Private Contact/DM:** For private inquiries, professional interest, or specific questions about collaboration, you can DM us here: **[vmblu project](mailto:vmblu.project@gmail.com)**

Read our full Contribution Guide here [Contribute](./CONTRIBUTE.md)

<span style="font-size:1.4em; color:#0066ff;"><b>■ Open source</b></span><br>

* **vmblu** is and will remain open source
* **vmblu** is licensed under the [Apache License 2.0](./LICENSE.txt).

---
<p align="center">
  <span style="font-size:1.4em; color:#0066ff;"><b>vmblu</b></span><br>
  <span style="font-size:1.4em; color:#0066ff;">clarity at scale</span>
</p>
