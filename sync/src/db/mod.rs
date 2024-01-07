use rand::Rng;
use rusqlite::{Connection, Result};

#[derive(Debug)]
struct Chunk {
    id: i32,
    content: String,
    embedding: String,
}

pub fn embedding_to_text(embedding: Vec<f32>) -> String {
    return embedding
        .iter()
        .map(|f| f.to_string())
        .collect::<Vec<String>>()
        .join(",");
}

pub fn text_to_embedding(text: String) -> Vec<f32> {
    return text
        .split(',')
        .map(|s| s.parse::<f32>().unwrap())
        .collect::<Vec<f32>>();
}

fn rand_embedding(n: i32) -> Vec<f32> {
    let mut rng = rand::thread_rng();
    (0..n).map(|_| rng.gen()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{Connection, Result};
    use std::time::Instant;

    #[test]
    fn benchmark_load_vectors() {
        let conn = Connection::open("sync.db").unwrap();

        conn.execute(
            "CREATE TABLE chunks (
            id    INTEGER PRIMARY KEY,
            content  TEXT NOT NULL,
            embedding TEXT NOT NULL
        )",
            (), // empty list of parameters.
        )
        .unwrap();

        let time = Instant::now();

        for i in 0..10_000 {
            let chunk = Chunk {
                id: 0,
                content: "Test content".to_string(),
                embedding: embedding_to_text(rand_embedding(384)),
            };
            conn.execute(
                "INSERT INTO chunks (content, embedding) VALUES (?1, ?2)",
                (&chunk.content, &chunk.embedding),
            )
            .unwrap();
        }

        println!("To insert took: {:.2?}", time.elapsed());

        let mut stmt = conn
            .prepare("SELECT id, content, embedding FROM chunks")
            .unwrap();

        let chunk_iter = stmt
            .query_map([], |row| {
                Ok(Chunk {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    embedding: row.get(2)?,
                })
            })
            .unwrap();

        println!("To load took: {:.2?}", time.elapsed());

        let mut i = 0;
        for chunk in chunk_iter {
            i += 1;
            let embedding = text_to_embedding(chunk.unwrap().embedding);
        }

        println!("Found {} chunks", i);
        println!("To convert took: {:.2?}", time.elapsed());
    }
}
