#[cfg(test)]
mod tests {
    use super::*;
    use ndarray::{Array1, Array2};
    use rand::Rng;
    use std::time::Instant;
    #[test]
    fn test_ndarray() {
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
        let top_n_indices: Vec<usize> = indexed_result
            .into_iter()
            .map(|(index, _value)| index)
            .take(top_n)
            .collect();

        let elapsed = time.elapsed();
        println!("Elapsed time: {:.2?}", elapsed);
    }
}
