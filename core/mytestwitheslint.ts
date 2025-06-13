async function testPromise() {
  return new Promise((resolve) =>
    setTimeout(() => {
      console.log("done");
      resolve("done");
    }, 1),
  );
}

async function check() {
  const t = testPromise();
  if (!!t) {
    console.log("there should be an error");
  }

  const tt = (val = "str") => t;

  await new Promise<void>(async (resolve) => {
    await tt();
    resolve();
  });

  console.log({ foo: 42, ...tt() });
}
