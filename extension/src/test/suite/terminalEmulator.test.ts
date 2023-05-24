import { test, describe } from "mocha";
import * as assert from "assert";
import { PythonTracebackSnooper } from "../../terminal/snoopers";

suite("Snoopers", () => {
  suite("PythonTracebackSnooper", () => {
    test("should detect traceback given all at once", async () => {
      let traceback = `Traceback (most recent call last):
              File "/Users/natesesti/Desktop/continue/extension/examples/python/main.py", line 10, in <module>
                sum(first, second)
              File "/Users/natesesti/Desktop/continue/extension/examples/python/sum.py", line 2, in sum
                return a + b
            TypeError: unsupported operand type(s) for +: 'int' and 'str'`;
      let returnedTraceback = await new Promise((resolve) => {
        let callback = (data: string) => {
          resolve(data);
        };
        let snooper = new PythonTracebackSnooper(callback);
        snooper.onData(traceback);
      });
      assert(
        returnedTraceback === traceback,
        "Detected \n" + returnedTraceback
      );
    });
    test("should detect traceback given in chunks", () => {});
  });
});
