#!/usr/bin/env node

import {
  extract,
  parseMarkup,
  parseStylesheet,
  resolveConfig,
  stringifyMarkup,
  stringifyStylesheet,
} from "emmet";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  DidChangeConfigurationNotification,
  InitializeParams,
  InitializeResult,
  InsertTextFormat,
  ProposedFeatures,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";

const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const triggerCharacters = [
    ">",
    ")",
    "]",
    "}",

    "@",
    "*",
    "$",
    "+",

    // alpha
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",

    // num
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
  ];

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: triggerCharacters,
      },
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

// The example settings
interface ExampleSettings {
  maxNumberOfProblems: number;
}

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// For list of language identifiers, see:
// https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocumentItem
// For list of supported syntax options, see:
// https://github.com/emmetio/emmet/blob/master/src/config.ts#L280-L283
const markupIdentifierOverrides = {
  // Identifiers not in stylesheetIdentifiers are treated as markup.
  // Markup languages are treated as html syntax by default.
  // So html, blade, razor and the like don't need to be listed.
  javascriptreact: 'jsx',
  typescriptreact: 'jsx',
} as { [key: string]: string | undefined };
const stylesheetIdentifiers = [
  'css',
  'sass',
  'scss',
  'less'
];

connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    try {
      const docs = documents.get(_textDocumentPosition.textDocument.uri);
      if (!docs) throw "failed to find document";
      const languageId = docs.languageId;
      const content = docs.getText();
      const linenr = _textDocumentPosition.position.line;
      const line = String(content.split(/\r?\n/g)[linenr]);
      const character = _textDocumentPosition.position.character;

      // Non-stylesheet identifiers are treated as markup.
      const isStylesheet = stylesheetIdentifiers.includes(languageId);
      // Emmet syntax names are the same as language server identifiers for stylesheets,
      // but not for markup languages.
      // Treat markup languages as html if not in markupIdentifierOverrides.
      const syntax = isStylesheet ? languageId : markupIdentifierOverrides[languageId] ?? 'html';
      const type = isStylesheet ? 'stylesheet' : 'markup';

      const extractedPosition = extract(line, character, { type });

      if (extractedPosition?.abbreviation == undefined) {
        throw "failed to parse line";
      }

      const left = extractedPosition.start;
      const right = extractedPosition.end;
      const abbreviation = extractedPosition.abbreviation;

      const emmetConfig = resolveConfig({
        syntax,
        type,
        options: {
          "output.field": (index, placeholder) =>
            `\$\{${index}${placeholder ? ":" + placeholder : ""}\}`,
        },
      });

      let textResult = "";
      if (!isStylesheet) {
        const markup = parseMarkup(abbreviation, emmetConfig);
        textResult = stringifyMarkup(markup, emmetConfig);
      } else {
        const markup = parseStylesheet(abbreviation, emmetConfig);
        textResult = stringifyStylesheet(markup, emmetConfig);
      }
      const range = {
        start: {
          line: linenr,
          character: left,
        },
        end: {
          line: linenr,
          character: right,
        },
      };

      return [
        {
          insertTextFormat: InsertTextFormat.Snippet,
          label: abbreviation,
          detail: abbreviation,
          documentation: textResult,
          textEdit: {
            range,
            newText: textResult,
            // newText: textResult.replace(/\$\{\d*\}/g,''),
          },
          kind: CompletionItemKind.Snippet,
          data: {
            range,
            textResult,
          },
        },
      ];
    } catch (error) {
      connection.console.log(`ERR: ${error}`);
    }

    return [];
  }
);

documents.listen(connection);

connection.listen();
