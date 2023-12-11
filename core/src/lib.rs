use std::path::Path;
mod gitignore;
mod sync;
mod utils;

//     Vec<(String, String)>,
//     Vec<(String, String)>,
//     Vec<(String, String)>,
//     Vec<(String, String)>,

use neon::prelude::*;

// fn sync_results(mut cx: FunctionContext) -> JsResult<JsArray> {
//     let dir = cx.argument::<JsString>(0)?;
//     let branch = cx.argument::<JsString>(1)?;

//     let results = sync::sync(Path::new(&dir), Some(&branch))

//     let js_array = JsArray::new(&mut cx, 4);

//     for (i, result) in results.iter().enumerate() {
//         let js_object = JsObject::new(&mut cx);
//         js_object.set(&mut cx, "name", JsString::new(&mut cx, &result.0))?;
//         js_object.set(&mut cx, "status", JsString::new(&mut cx, &result.1))?;
//         js_array.set(&mut cx, i as u32, js_object)?;
//     }

//     Ok(js_array)
// }

// #[neon::main]
// fn main(mut cx: ModuleContext) -> NeonResult<()> {
//     cx.export_function("get", get_num_cpus)?;
//     Ok(())
// }
