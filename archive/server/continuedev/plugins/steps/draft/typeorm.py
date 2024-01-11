from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK


class CreateTableStep(Step):
    sql_str: str
    name: str = "Create a table in TypeORM"

    async def run(self, sdk: ContinueSDK):
        # Write TypeORM entity
        entity_name = self.sql_str.split(" ")[2].capitalize()
        await sdk.edit_file(
            f"src/entity/{entity_name}.ts",
            dedent(
                f"""\
            {self.sql_str}
            
            Write a TypeORM entity called {entity_name} for this table, importing as necessary:"""
            ),
        )

        # Add entity to data-source.ts
        await sdk.edit_file(
            filepath="src/data-source.ts", prompt=f"Add the {entity_name} entity:"
        )

        # Generate blank migration for the entity
        out = await sdk.run(
            f"npx typeorm migration:create ./src/migration/Create{entity_name}Table"
        )
        migration_filepath = out.text.split(" ")[1]

        # Wait for user input
        # await sdk.wait_for_user_confirmation("Fill in the migration?")

        # Fill in the migration
        await sdk.edit_file(
            migration_filepath,
            dedent(
                f"""\
                This is the table that was created:
                
                {self.sql_str}
                
                Fill in the migration for the table:"""
            ),
        )

        # Run the migration
        await sdk.run(
            "npx typeorm-ts-node-commonjs migration:run -d ./src/data-source.ts"
        )
