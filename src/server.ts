#!/usr/bin/env node

import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
} from "vscode-languageserver";

import expand, { extract } from "emmet";

import { TextDocument } from "vscode-languageserver-textdocument";

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

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
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

connection.onDidChangeWatchedFiles((_change) => {
  connection.console.log("We received an file change event");
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
      let right = extractPosition.start;
      let abbreviation = extractPosition.abbreviation;
      let expanded =
        languageId != "css"
          ? expand(abbreviation)
          : expand(abbreviation, { type: "stylesheet" });

      return [
        {
          label: abbreviation,
          detail: "emmet",
          documentation: "documentation",
          textEdit: {
            range: {
              start: {
                line: linenr,
                character: left,
              },
              end: {
                line: linenr,
                character: right,
              },
            },
            newText: "" + expanded,
          },
          kind: CompletionItemKind.Snippet,
          data: 1,
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
