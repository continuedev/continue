import * as lancedb from "vectordb";

(async () => {
  console.log("Hello!");
  const uri = "data/sample-lancedb";
  const db = await lancedb.connect(uri);
  const tb = await db.createTable("myTable", [
    { vector: [3.1, 4.1], item: "foo", price: 10.0 },
    { vector: [5.9, 26.5], item: "bar", price: 20.0 },
  ]);
  const query = await tb.search([100, 100]).limit(2).execute();
  console.log(query);
  console.log("DONE");
})();
