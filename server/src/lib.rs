use pyo3::{exceptions, prelude::*};
use std::path::Path;
mod gitignore;
mod sync;

#[pyfunction]
fn sync_results(
    dir: String,
    branch: String,
) -> PyResult<(Vec<(String, String)>, Vec<(String, String)>)> {
    return sync::sync(Path::new(&dir), Some(&branch))
        .map_err(|err| PyErr::new::<exceptions::PyException, _>(format!("{}", err)));
}

#[pymodule]
fn continuedev(_py: Python<'_>, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(sync_results, m)?)?;
    Ok(())
}
