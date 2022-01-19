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

let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
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

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "languageServerExample",
    });
    documentSettings.set(resource, result);
  }
  return result;
}

documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    try {
      let docs = documents.get(_textDocumentPosition.textDocument.uri);
      if (!docs) throw "failed to find document";
      let languageId = docs.languageId;
      let content = docs.getText();
      let linenr = _textDocumentPosition.position.line;
      let line = String(content.split(/\r?\n/g)[linenr]);
      let character = _textDocumentPosition.position.character;
      let extractPosition =
        languageId != "css"
          ? extract(line, character)
          : extract(line, character, { type: "stylesheet" });

      if (extractPosition?.abbreviation == undefined) {
        throw "failed to parse line";
      }

      let left = extractPosition.start;
      let right = extractPosition.end;
      let abbreviation = extractPosition.abbreviation;
      let textResult = "";
      const htmlLanguages = ["html", "blade", "twig", "eruby", "erb"];
      if (htmlLanguages.includes(languageId)) {
        const htmlconfig = resolveConfig({
          options: {
            "output.field": (index, placeholder) =>
              `\$\{${index}${placeholder ? ":" + placeholder : ""}\}`,
          },
        });
        const markup = parseMarkup(abbreviation, htmlconfig);
        textResult = stringifyMarkup(markup, htmlconfig);
      } else {
        const cssConfig = resolveConfig({
          type: "stylesheet",
          options: {
            "output.field": (index, placeholder) =>
              `\$\{${index}${placeholder ? ":" + placeholder : ""}\}`,
          },
        });
        const markup = parseStylesheet(abbreviation, cssConfig);
        textResult = stringifyStylesheet(markup, cssConfig);
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
