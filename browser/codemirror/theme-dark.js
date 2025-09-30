import {EditorView} from "@codemirror/view"
import {HighlightStyle, syntaxHighlighting} from "@codemirror/language"
import {tags as t} from "@lezer/highlight"

// basic colors
const white = "#ffffff",
      black = "#000000",
      red = "#d92b00",
      yellow = "#f7e53d",
      orange = "#ffb300",
      green = "#3c3"

const blue = {
    bright :  '#00eeff',
    light :   '#22bbff',         
    base :    '#0077b3',
    pure :    '#0000ff'
}

// some specific use cases
const darkBackground = black,
      highlightBackground = "#2c313a",
      background = "#1a1a1a",
      tooltipBackground = "#353a42",
      selection = "#3E4451",
      cDefault = blue.light,
      cursor = blue.bright,
      cKeyword = "#dd8df7"

/// The editor theme styles for One Dark.
export const oneDarkTheme = EditorView.theme({
  "&": {
    color: cDefault,
    backgroundColor: background
  },

  ".cm-content": {
    caretColor: cursor
  },

  ".cm-cursor, .cm-dropCursor": {borderLeftColor: cursor},
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {backgroundColor: selection},

  ".cm-panels": {backgroundColor: darkBackground, color: cDefault},
  ".cm-panels.cm-panels-top": {borderBottom: "2px solid black"},
  ".cm-panels.cm-panels-bottom": {borderTop: "2px solid black"},

  ".cm-searchMatch": {
    backgroundColor: "#72a1ff59",
    outline: "1px solid #457dff"
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#6199ff2f"
  },

  ".cm-activeLine": {backgroundColor: "#6699ff0b"},
  ".cm-selectionMatch": {backgroundColor: "#aafe661a"},

  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "#bad0f847"
  },

  ".cm-gutters": {
    backgroundColor: background,
    color: white,
    border: "none"
  },

  ".cm-activeLineGutter": {
    backgroundColor: highlightBackground
  },

  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "#ddd"
  },

  ".cm-tooltip": {
    border: "none",
    backgroundColor: tooltipBackground
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: "transparent",
    borderBottomColor: "transparent"
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: tooltipBackground,
    borderBottomColor: tooltipBackground
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: highlightBackground,
      color: white
    }
  }
}, {dark: true})

/// The highlighting style for code in the One Dark theme.
export const oneDarkHighlightStyle = HighlightStyle.define([
  {tag: t.keyword,color: cKeyword},
  {tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: blue.bright},
  {tag: [t.function(t.variableName), t.labelName],color: yellow},
  {tag: [t.color, t.constant(t.name), t.standard(t.name)],color: cDefault},
  {tag: [t.definition(t.name), t.ifName],color: cDefault},
  {tag: [t.typeName, t.className, t.number, t.dirty, t.annotation, t.modifier, t.self, t.namespace],color: cDefault},
  {tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],color: cDefault},
  {tag: [t.meta, t.comment],color: green},
  {tag: t.strong,fontWeight: "bold"},
  {tag: t.emphasis, fontStyle: "italic"},
  {tag: t.strikethrough,textDecoration: "line-through"},
  {tag: t.link,color: white,textDecoration: "underline"},
  {tag: t.heading,fontWeight: "bold",color: cDefault},
  {tag: [t.atom, t.bool, t.special(t.variableName)],color: cDefault },
  {tag: [t.processingInstruction, t.string, t.inserted],color: orange},
  {tag: t.invalid,color: red},
])

/// Extension to enable the One Dark theme (both the editor theme and the highlight style).
export const darkTheme = [oneDarkTheme, syntaxHighlighting(oneDarkHighlightStyle)]