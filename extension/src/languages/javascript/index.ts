import { LanguageLibrary } from "../index.d";
import { notImplemented } from "../notImplemented";

const NI = (propertyName: string) => notImplemented(propertyName, "javascript");

const javascriptLangaugeLibrary: LanguageLibrary = {
  language: "javascript",
  fileExtensions: [".js", ".jsx", ".ts", ".tsx"],
  parseFirstStacktrace: NI("parseFirstStacktrace"),
  lineIsFunctionDef: NI("lineIsFunctionDef"),
  parseFunctionDefForName: NI("parseFunctionDefForName"),
  lineIsComment: NI("lineIsComment"),
  writeImport: NI("writeImport"),
};

export default javascriptLangaugeLibrary;
