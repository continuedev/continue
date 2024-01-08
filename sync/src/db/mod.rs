use ndarray::{Array1, Array2};
use rusqlite::Connection;
use std::fs;

fn get_top_n(v: Vec<f32>, vectors: Vec<Vec<f32>>, d: usize, top_n: usize) -> Vec<usize> {
    let n = vectors.len();
    let a: Array2<f32> = Array2::from_shape_fn((n, d), |(i, j)| vectors[i][j]);
    let b: Array1<f32> = Array1::from_shape_fn(d, |i| v[i]);

    let result = a.dot(&b);
    let mut indexed_result: Vec<(usize, &f32)> = result.iter().enumerate().collect();
    indexed_result.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());

    let top_n_indices: Vec<usize> = indexed_result
        .into_iter()
        .map(|(index, _value)| index)
        .take(top_n)
        .collect();

    return top_n_indices;
}

#[derive(Debug, Clone)]
pub struct Chunk {
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

fn get_conn() -> Connection {
    let path = dirs::home_dir()
        .unwrap()
        .join(".continue")
        .join("index")
        .join("sync.db");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    return Connection::open(path).unwrap();
}

pub fn create_database() {
    let conn = get_conn();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS chunks (
            id    INTEGER PRIMARY KEY,
            hash TEXT NOT NULL,
            content  TEXT NOT NULL,
            embedding TEXT NOT NULL
        )",
        (),
    )
    .unwrap();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tags (
            id    INTEGER PRIMARY KEY,
            chunk_hash TEXT NOT NULL,
            tag  TEXT NOT NULL
        )",
        (),
    )
    .unwrap();
}

pub fn add_chunk(hash: String, content: String, tags: Vec<String>, embedding: Vec<f32>) {
    let conn = get_conn();

    conn.execute(
        "INSERT INTO chunks (hash, content, embedding) VALUES (?1, ?2, ?3)",
        (&hash, &content, &embedding_to_text(embedding)),
    )
    .unwrap();

    for tag in tags {
        conn.execute(
            "INSERT INTO tags (chunk_hash, tag) VALUES (?1, ?2)",
            (&hash, &tag),
        )
        .unwrap();
    }
}

pub fn remove_chunks_for_hash(hash: String) {
    let conn = get_conn();

    conn.execute("DELETE FROM chunks WHERE hash=?1", (&hash,))
        .unwrap();

    conn.execute("DELETE FROM tags WHERE chunk_hash=?1", (&hash,))
        .unwrap();
}

pub fn add_tag(hash: String, tag: String) {
    let conn = get_conn();

    conn.execute(
        "INSERT INTO tags (chunk_hash, tag) VALUES (?1, ?2)",
        (&hash, &tag),
    )
    .unwrap();
}

pub fn remove_tag(hash: String, tag: String) {
    let conn = get_conn();

    conn.execute(
        "DELETE FROM tags WHERE chunk_hash=?1 AND tag=?2",
        (&hash, &tag),
    )
    .unwrap();
}

pub fn retrieve(n: usize, tags: Vec<String>, v: Vec<f32>) -> Vec<Chunk> {
    let conn = get_conn();

    let mut stmt = conn
        .prepare(&format!(
            "
        SELECT * FROM chunks
        WHERE hash IN (
            SELECT chunk_hash
            FROM tags
            WHERE tag IN (?1)
        )",
        ))
        .unwrap();
    let chunk_rows = stmt
        .query_map((tags.join(", "),), |row| {
            Ok(Chunk {
                id: row.get(0)?,
                content: row.get(1)?,
                embedding: row.get(2)?,
            })
        })
        .unwrap();

    let mut chunks = Vec::new();
    let mut vectors: Vec<Vec<f32>> = Vec::new();
    for chunk in chunk_rows {
        let chunk = chunk.unwrap();
        chunks.push(chunk.clone());
        let vector = text_to_embedding(chunk.embedding);
        vectors.push(vector);
    }

    let top_n_indices = get_top_n(v, vectors, 384, n);
    return chunks
        .iter()
        .cloned()
        .enumerate()
        .filter(|(index, _chunk)| top_n_indices.contains(index))
        .map(|(_index, chunk)| chunk)
        .collect::<Vec<Chunk>>();
}

#[cfg(test)]
mod tests {
    use super::*;
    use ndarray::{Array1, Array2};
    use rand::Rng;
    use rusqlite::Connection;
    use std::time::Instant;

    fn rand_embedding(n: i32) -> Vec<f32> {
        let mut rng = rand::thread_rng();
        (0..n).map(|_| rng.gen()).collect()
    }

    #[test]
    fn test_create_database() {
        create_database();

        let conn = get_conn();
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap();
        let mut table_names = stmt
            .query_map([], |row| row.get::<usize, String>(0))
            .unwrap();

        assert!(table_names.any(|table_name| table_name.unwrap().eq("chunks")));
        assert!(table_names.any(|table_name| table_name.unwrap().eq("tags")))
    }

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

        for _ in 0..10_000 {
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
            let _ = text_to_embedding(chunk.unwrap().embedding);
        }

        println!("Found {} chunks", i);
        println!("To convert took: {:.2?}", time.elapsed());
    }

    #[test]
    fn benchmark_ndarray() {
        let mut rng = rand::thread_rng();
        let n = 10_000;
        let d = 384;
        let a: Array2<f32> = Array2::from_shape_fn((n, d), |_| rng.gen::<f32>());
        let b: Array1<f32> = Array1::from_shape_fn(d, |_| rng.gen::<f32>());

        let time = Instant::now();

        let result = a.dot(&b);
        let mut indexed_result: Vec<(usize, &f32)> = result.iter().enumerate().collect();
        indexed_result.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());

        let top_n = 50;
        let _: Vec<usize> = indexed_result
            .into_iter()
            .map(|(index, _value)| index)
            .take(top_n)
            .collect();

        let elapsed = time.elapsed();
        println!("Elapsed time: {:.2?}", elapsed);
    }
}
