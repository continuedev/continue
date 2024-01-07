use std::path::Path;
mod db;
mod gitignore;
mod sync;
mod utils;

use db::{add_tag, remove_chunk, remove_tag};
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
    let tag = format!("{}::{}", dir, branch);

    let results = sync::sync(Path::new(&dir), Some(&branch)).unwrap();

    // Send to IDE Extension to compute embeddings
    let compute = build_js_array(results.0, &mut cx);

    // Delete chunks
    for (_, hash) in results.1 {
        remove_chunk(hash);
    }

    // Add tag from chunks
    for (_, hash) in results.2 {
        add_tag(hash, tag.clone());
    }

    // Remove tag from chunk_rows
    for (_, hash) in results.3 {
        remove_tag(hash, tag.clone());
    }

    Ok(compute)
}

fn db_add_chunk(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let chunk_obj = cx.argument::<JsObject>(0)?;

    let hash = chunk_obj
        .get::<JsString, _, _>(&mut cx, "digest")?
        .value(&mut cx);

    let content = chunk_obj
        .get::<JsString, _, _>(&mut cx, "content")?
        .value(&mut cx);

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
    db::add_chunk(hash, content, tags, embedding);

    return Ok(JsUndefined::new(&mut cx));
}

fn db_retrieve(mut cx: FunctionContext) -> JsResult<JsUndefined> {
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

    db::retrieve(n, tags, v);

    return Ok(JsUndefined::new(&mut cx));
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("sync_results", sync_results)?;
    cx.export_function("add_chunk", db_add_chunk);
    cx.export_function("retrieve", db_retrieve);
    Ok(())
}
