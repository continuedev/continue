use rusqlite::{ffi::sqlite3_auto_extension, Connection, Result};
use sqlite_vss::{sqlite3_vector_init, sqlite3_vss_init};

fn main() -> Result<()> {
    unsafe {
        sqlite3_auto_extension(Some(sqlite3_vector_init));
        sqlite3_auto_extension(Some(sqlite3_vss_init));
    }

    let conn = Connection::open_in_memory()?;

    let (version, vector): (String, String) = conn.query_row(
        "SELECT vss_version(), vector_to_json(?)",
        [[0x00, 0x00, 0x28, 0x42]],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    println!("version={version} vector={vector}");

    conn.execute_batch(
        r"
    CREATE VIRTUAL TABLE vss_demo USING vss0(a(2));
    INSERT INTO vss_demo(rowid, a)
      VALUES
          (1, '[1.0, 2.0]'),
          (2, '[2.0, 2.0]'),
          (3, '[3.0, 2.0]')
    ",
    )?;

    let result: Vec<(i64, f32)> = conn
        .prepare(
            r"
          SELECT
            rowid,
            distance
          FROM vss_demo
          WHERE vss_search(a, '[1.0, 2.0]')
          LIMIT 3
        ",
        )?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;

    for (rowid, distance) in result {
        println!("rowid={rowid}, distance={distance}");
    }

    println!("✅ demo.rs ran successfully. \n");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::TempDirBuilder;
    use std::fs::remove_file;

    #[test]
    fn test_basic_setup() {
        main();
    }
}
