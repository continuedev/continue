use std::path::Path;
mod db;
mod gitignore;
mod sync;
mod sync_db;
mod utils;

use neon::prelude::*;

fn build_js_array<'a>(
    rs_array: Vec<(String, String)>,
    cx: &mut FunctionContext<'a>,
) -> Handle<'a, JsArray> {
    let js_array = JsArray::new(cx, rs_array.len() as u32);
    for (i, (name, hash)) in rs_array.iter().enumerate() {
        let js_object = JsObject::new(cx);

        let name = JsString::new(cx, &name);
        let _ = js_object.set(cx, "name", name);
        let hash = JsString::new(cx, &hash);
        let _ = js_object.set(cx, "hash", hash);

        let _ = js_array.set(cx, i as u32, js_object);
    }

    return js_array;
}

fn sync_results(mut cx: FunctionContext) -> JsResult<JsArray> {
    let dir = cx.argument::<JsString>(0)?.value(&mut cx);
    let branch = cx.argument::<JsString>(1)?.value(&mut cx);
    let provider_id = cx.argument::<JsString>(2)?.value(&mut cx);

    let tag = sync::Tag {
        dir: Path::new(&dir),
        branch: &branch,
        provider_id: &provider_id.to_string(),
    };

    let compute = sync_db::sync_db(&tag);
    let compute_js_array = build_js_array(compute, &mut cx);

    return Ok(compute_js_array);
}

fn db_add_chunk(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let chunk_obj = cx.argument::<JsObject>(0)?;

    let hash = chunk_obj
        .get::<JsString, _, _>(&mut cx, "digest")?
        .value(&mut cx);

    let content = chunk_obj
        .get::<JsString, _, _>(&mut cx, "content")?
        .value(&mut cx);

    let start_line = chunk_obj
        .get::<JsNumber, _, _>(&mut cx, "startLine")?
        .value(&mut cx) as usize;

    let end_line = chunk_obj
        .get::<JsNumber, _, _>(&mut cx, "endLine")?
        .value(&mut cx) as usize;

    let file_path = chunk_obj
        .get::<JsString, _, _>(&mut cx, "filepath")?
        .value(&mut cx);

    let index = chunk_obj
        .get::<JsNumber, _, _>(&mut cx, "index")?
        .value(&mut cx) as usize;

    let tags_vec = cx.argument::<JsArray>(1)?.to_vec(&mut cx).unwrap();
    let mut tags: Vec<String> = Vec::new();
    for item in tags_vec {
        let tag = item
            .downcast::<JsString, _>(&mut cx)
            .unwrap()
            .value(&mut cx);
        tags.push(tag);
    }

    let embedding_vec = cx.argument::<JsArray>(2)?.to_vec(&mut cx).unwrap();
    let mut embedding: Vec<f32> = Vec::new();
    for item in embedding_vec {
        let float = item
            .downcast::<JsNumber, _>(&mut cx)
            .unwrap()
            .value(&mut cx) as f32;
        embedding.push(float);
    }

    let chunk = db::Chunk {
        hash,
        content,
        start_line,
        end_line,
        file_path,
        index,
        embedding,
    };

    db::add_chunk(chunk, tags);

    return Ok(JsUndefined::new(&mut cx));
}

fn db_retrieve(mut cx: FunctionContext) -> JsResult<JsArray> {
    let n = cx.argument::<JsNumber>(0)?.value(&mut cx) as usize;

    let tags_vec = cx.argument::<JsArray>(1)?.to_vec(&mut cx).unwrap();
    let mut tags: Vec<String> = Vec::new();
    for item in tags_vec {
        let tag = item
            .downcast::<JsString, _>(&mut cx)
            .unwrap()
            .value(&mut cx);
        tags.push(tag);
    }

    let v_vec = cx.argument::<JsArray>(2)?.to_vec(&mut cx).unwrap();
    let mut v: Vec<f32> = Vec::new();
    for item in v_vec {
        let float = item
            .downcast::<JsNumber, _>(&mut cx)
            .unwrap()
            .value(&mut cx) as f32;
        v.push(float);
    }

    let results = db::retrieve(n, tags, v);

    let js_array = JsArray::new(&mut cx, results.len() as u32);
    for (i, chunk) in results.iter().enumerate() {
        let js_object = JsObject::new(&mut cx);

        let hash = JsString::new(&mut cx, &chunk.hash);
        let _ = js_object.set(&mut cx, "hash", hash);

        let content = JsString::new(&mut cx, &chunk.content);
        let _ = js_object.set(&mut cx, "content", content);

        let start_line = JsNumber::new(&mut cx, chunk.start_line as f64);
        let _ = js_object.set(&mut cx, "startLine", start_line);

        let end_line = JsNumber::new(&mut cx, chunk.end_line as f64);
        let _ = js_object.set(&mut cx, "endLine", end_line);

        let file_path = JsString::new(&mut cx, &chunk.file_path);
        let _ = js_object.set(&mut cx, "filepath", file_path);

        let index = JsNumber::new(&mut cx, chunk.index as f64);
        let _ = js_object.set(&mut cx, "index", index);

        let _ = js_array.set(&mut cx, i as u32, js_object);
    }

    return Ok(js_array);
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    let _ = cx.export_function("sync_results", sync_results)?;
    let _ = cx.export_function("add_chunk", db_add_chunk);
    let _ = cx.export_function("retrieve", db_retrieve);
    Ok(())
}
