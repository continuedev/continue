# Installation
> `npm install --save @types/linkify-it`

# Summary
This package contains type definitions for linkify-it (https://github.com/markdown-it/linkify-it).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/linkify-it.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/linkify-it/index.d.ts)
````ts
// Type definitions for linkify-it 3.0.2
// Project: https://github.com/markdown-it/linkify-it
// Definitions by: Lindsey Smith <https://github.com/praxxis>
//                 Robert Coie <https://github.com/rapropos/typed-linkify-it>
//                 Alex Plumb <https://github.com/alexplumb>
//                 Rafa Gares <https://github.com/ragafus>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.2

declare const LinkifyIt: {
    (
        schemas?: LinkifyIt.SchemaRules | LinkifyIt.Options,
        options?: LinkifyIt.Options
    ): LinkifyIt.LinkifyIt;
    new (
        schemas?: LinkifyIt.SchemaRules | LinkifyIt.Options,
        options?: LinkifyIt.Options
    ): LinkifyIt.LinkifyIt;
};

declare namespace LinkifyIt {
    type Validate = (text: string, pos: number, self: LinkifyIt) => number | boolean;

    interface FullRule {
        validate: string | RegExp | Validate;
        normalize?: ((match: Match) => void) | undefined;
    }

    type Rule = string | FullRule;

    interface SchemaRules {
        [schema: string]: Rule;
    }

    interface Options {
        fuzzyLink?: boolean | undefined;
        fuzzyIP?: boolean | undefined;
        fuzzyEmail?: boolean | undefined;
    }

    interface Match {
        index: number;
        lastIndex: number;
        raw: string;
        schema: string;
        text: string;
        url: string;
    }

    interface LinkifyIt {
        // Use overloads to provide contextual typing to `FullRule.normalize`, which is ambiguous with string.normalize
        // This appears unneeded to the unified-signatures lint rule.
        add(schema: string, rule: string): LinkifyIt;
        // tslint:disable-next-line: unified-signatures
        add(schema: string, rule: FullRule | null): LinkifyIt;
        match(text: string): Match[] | null;
        normalize(raw: string): string;
        pretest(text: string): boolean;
        set(options: Options): LinkifyIt;
        test(text: string): boolean;
        testSchemaAt(text: string, schemaName: string, pos: number): number;
        tlds(list: string | string[], keepOld?: boolean): LinkifyIt;
        re: {
            [key: string]: RegExp;
        };
    }
}

export = LinkifyIt;

````

### Additional Details
 * Last updated: Tue, 06 Jul 2021 22:02:41 GMT
 * Dependencies: none
 * Global values: none

# Credits
These definitions were written by [Lindsey Smith](https://github.com/praxxis), [Robert Coie](https://github.com/rapropos/typed-linkify-it), [Alex Plumb](https://github.com/alexplumb), and [Rafa Gares](https://github.com/ragafus).
