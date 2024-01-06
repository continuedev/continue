use std::path::Path;
mod db;
mod gitignore;
mod sync;
mod utils;

//     Vec<(String, String)>,
//     Vec<(String, String)>,
//     Vec<(String, String)>,
//     Vec<(String, String)>,

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

fn sync_results(mut cx: FunctionContext) -> JsResult<JsObject> {
    let dir = cx.argument::<JsString>(0)?.value(&mut cx);
    let branch = cx.argument::<JsString>(1)?.value(&mut cx);

    let results = sync::sync(Path::new(&dir), Some(&branch)).unwrap();

    let final_object = JsObject::new(&mut cx);
    let compute = build_js_array(results.0, &mut cx);
    final_object.set(&mut cx, "compute", compute)?;

    let delete = build_js_array(results.1, &mut cx);
    final_object.set(&mut cx, "delete", delete)?;

    let add_label = build_js_array(results.2, &mut cx);
    final_object.set(&mut cx, "add_label", add_label)?;

    let remove_label = build_js_array(results.3, &mut cx);
    final_object.set(&mut cx, "remove_label", remove_label)?;

    Ok(final_object)
}

fn get_num_cpus(mut cx: FunctionContext) -> JsResult<JsNumber> {
    Ok(cx.number(2.0 as f64))
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("get", get_num_cpus)?;
    cx.export_function("sync_results", sync_results)?;
    Ok(())
}
