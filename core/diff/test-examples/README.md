# Diff algorithm tests

Tests are specified as

```
<CODE BEFORE>

---

<CODE AFTER>

---

<EXPECTED DIFF>
```

`---` is the delimeter, and surrounding whitespace will be trimmed.

The expected diff can be generated with the `displayDiff` function.

We make this explicit instead of comparing to the output of `myersDiff` in case the output from that is either unattainable or not exactly what we want.

In order to generate the expected diff, you can first leave it empty and then run the test. The test will catch this and write the _computed_ diff to the test file. It is up to you to correct this to the expected diff.
