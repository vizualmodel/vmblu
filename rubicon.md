
# The rubicon project

## Overview
The rubicon project wants to rebuild the vmblu framework as a vmblu project itself.

- the original vmblu framework code is in the /vmblu folder and must not be changed
- the /new-vmblu folder is a copy of the /vmblu folder. Modifications will be done to the /new-vmblu folder. 

The rewrite of the vmblu framework is allowed to deviate significantly from the original but the following has to be taken into account:the formats of the inputs files and output files used by the framework remain the same.

The rubicon project will convert the vmblu framework into four separate vmblu projects that we will refactor/rewrite:

1. /ui: the library that contains the ui for the editor: popups, menus etc. It is a separate library because it is just ui. It is written with the svelte framework and that can stay this way. 
3. /playground: this is the vmblu graphical editor for the browser that uses the nodes defined in /core and /ui. It has only very few own nodes, most notably a 'workspace' node for working with folders and files.
3. /core: the library that contains the core types and functions of the vmblu framework to make it fit into the new playground architecture
4. /vscodex/webview: /vscodex is the folder where the vscode extension for the vmblu graphical editor lives. It has two main parts: first the vscode extension code, written in type script and second the webview code that defines the vmblu editor. The architecture of that editor is very similar to the playground editor, but with a few different nodes because it has to communicate with vscode and not with its own 'workspace'

## ui

The current ui is usable as is and I think the main challenge for the ui is not so much to rewrite it, but to improve it and to structure it as a vmblu project.

(1) The ui is based on svelte and I want to keep that so but all improvements to make it more 'canonical' svelte are welcome. We must also switch to svelte 5.0 
(2) the ui folders /ui/layouts, /ui/menus-tabs-widgets, /ui/popups should be organised in the new /ui/nodes folder with a file (or folder) per node
(3) the /ui/fragments folder can stay because it contains small svelte components for reuse in the svelte nodes
(4) material icons is part of the ui because I use the google icons locally
(5) common css elements (color, font etc) should be put together in a global section somewhere

## Playground

We will make a new architecture for playground: the big editor node must be split into several nodes. You wil analyze the current code to come with a proposal for the new playground architecture. We will call the new architetcure 'rubicon' but when the project is ready and approved we will switch back to the old name 'playground'

Playground is made from the nodes defined in the core and some specific nodes.

## Core rewrite

When we have defined the new architecture, we will rewrite/refactor the core. This is by far the most complicated rewrite of the whole project.In the subsections below you find a high level overview of the core. The ground truth is to be found in the code itself of course.

### High level

The following is a high level description of the way the vmblu editor works and how the code is organised:

- The vmblu graphical editor shows a graphical representation of a vmblu model. A vmblu model consists of two files: model-name.mod.blu and model-name.mod.viz. When the two files are read they are combined into a single internal model. ModelBlueprint, the model structure, takes care of that.
- A model consists of nodes and routes. Nodes can be source nodes, group nodes or linked nodes. Source nodes have a corresponding factory that contains the source code for the node. Group nodes are made of nodes themselves and linked nodes import nodes from external model files. Nodes have pins that are connected by routes.
- A model is shown in a 'view'. There is one top-level view and that view contains a view for each group node in the model. If the group node contains group nodes itself, then the that view will also contain views etc.
- The compiler transforms the raw model data as read from the files into an internal model, and vice-versa.
- The vmblu output artefacts are created fom the model: the .app.js file, the .mcp.js file, the .prf.json file, the .tst.js file
- The editor works with 'documents'. A document is a combination of a model, the main view and one or more compilers.

The rewrite should carefully examine how we can redo the current node-structure of the core, particularly because the bulk of the application is now concentrated into one big editor node. It probably makes sense to regroup functionality in two three or max four node types.

### Internal model

The structure of the internal model is as follows:

- The internal vmblu model consists of a node tree: the top level node is always a group node, and that node contains a list of nodes, buses and pads.
- Groups nodes and source nodes share a common part and have a specific part.
- The 'look' is common to source nodes and group nodes and describes what the a node looks like. It has a rectangular area and it is entirely built up of widgets: a widget for the header, the box around it, the pins, the icons etc.
- a source node maintains a rxTable and a txTable. The rxTable is a list of messages it can receive, the txTable is, for each output pin, the actual input pins of source nodes this pin is connected to. Resolving this by following the routes in the model is an important function because the .app.js file only contains source nodes and the list of souce inputs each pin output is connected to.
- routes contain the connection information of the model: they have two end-points and a 'wire'. End-points for a route can be pins, bus-tacks or pads.
- buses are a way of connecting pins or pads via a single wire, the actual connection is then determined based on the name of the pin or pad.
- pads are used inside group node and each pad corresponds to an external pin of the group node.

### User interaction with the model

- The toplevel structure for the editor is Editor
- Editor has one active document. Switching between documents is handled by an external node, DocumentManager
- Event handlers are registered by the Editor to intercept any user action that are related to views (switch, resize etc.). Anything else is passed down to the view of the active document.
- The editor also receives the messages from the main menu of the editor and handles these or passes these down to the active document.
- The view determines based on the current state and the user action (keyboard, mouse) what needs to be done. The view also maintains the many context menus the user can call up, depending on wher he clicks.
- Modifications to the internal model (the root of a view) are handled via the redox structure. The redox structure is a large structure that has an entry for each action on the model. Each entry contains three functions: doit(), undo() and redo(). These functions are not called directly but via Editor who also maintains a stack of latest actions so that a user can undo/redo actions.

### File structure

The /vmblu/core folder has the following folders

- /ai : not used by the vmblu editor. Is supposed to be used as a generic MCP server / client, but can be discarded for the moment
- /arl : the arl (application resource locator) is an important concept and is serves to access several types of files in a uniform matter: local files, node.js files, files via a URL. Once you obtain an ARL for a file you can access it in the same way, irrespective of the underlying real file type. Also contains some additional functions to work with path names.
- /document: contains the Document object and the DocumentManager
- /editor: contains the Editor object
- /model: contains the ModelBlueprint and the ModelCompiler. Also the code for the library manager node is here.
- /node: contains the definitions of the following objects: node, look, route, bus and pad
- /util: contains functions used in other parts. Important files: shape.js and shape-icon.js where all drawing functions are grouped, style.js that groups all important style related constants, convert.js that contains often used conversion functions.
- /view: contains the view object, the mouse handlers, the context menus, the redox structure etc.
- /widget: contains all the widgets that are used in the construction of the look of the node and also some widgets that are used for the views.

## vscodex/webview rewrite

When playground will have been rewritten, rewriting the webview will be a lot easier because we will be able to simply use 80% of the nodes used and only rework the nodes that handle the communication between vscode and the webview.


