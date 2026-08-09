// Feel free to add more!
// See gui/node_modules/highlight.js/lib/languages for the full available list
import clojure from "highlight.js/lib/languages/clojure";
import delphi from "highlight.js/lib/languages/delphi";
import elixir from "highlight.js/lib/languages/elixir";
import julia from "highlight.js/lib/languages/julia";
import lisp from "highlight.js/lib/languages/lisp";
import matlab from "highlight.js/lib/languages/matlab";
import ocaml from "highlight.js/lib/languages/ocaml";
import powershell from "highlight.js/lib/languages/powershell";
import protobuf from "highlight.js/lib/languages/protobuf";
import verilog from "highlight.js/lib/languages/verilog";
import { common } from "lowlight";
import rehypeHighlight, { Options } from "rehype-highlight";

export function rehypeHighlightPlugin() {
  return [
    rehypeHighlight,
    {
      languages: {
        ...common,
        clojure,
        delphi,
        elixir,
        julia,
        protobuf,
        verilog,
        powershell,
        ocaml,
        matlab,
        lisp,
      },
    } as Options,
  ];
}
