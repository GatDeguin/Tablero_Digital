//! Optional reference only: NOT compiled, benchmarked or integrated in VELORA GT 2.0.
//! Active telemetry is src/core.mjs in a JavaScript Worker. No Rust toolchain was available.
const EARTH_RADIUS: f64 = 6_371_008.8;
fn valid(lat: f64, lon: f64) -> bool {
    lat.is_finite() && lon.is_finite() && lat.abs() <= 90.0 && lon.abs() <= 180.0
}
/// Great-circle distance in metres. Invalid coordinates return NaN.
#[no_mangle]
pub extern "C" fn distance_m(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    if !valid(lat1, lon1) || !valid(lat2, lon2) { return f64::NAN; }
    let a = ((lat2-lat1).to_radians()/2.0).sin().powi(2)
        + lat1.to_radians().cos()*lat2.to_radians().cos()
        * ((lon2-lon1).to_radians()/2.0).sin().powi(2);
    let a = a.clamp(0.0, 1.0);
    EARTH_RADIUS * 2.0 * a.sqrt().atan2((1.0-a).sqrt())
}
/// Initial course in degrees, north = 0. This is NOT a magnetic heading.
#[no_mangle]
pub extern "C" fn initial_bearing(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    if !valid(lat1, lon1) || !valid(lat2, lon2) { return f64::NAN; }
    let d = (lon2-lon1).to_radians();
    let y = d.sin()*lat2.to_radians().cos();
    let x = lat1.to_radians().cos()*lat2.to_radians().sin()
        - lat1.to_radians().sin()*lat2.to_radians().cos()*d.cos();
    (y.atan2(x).to_degrees()+360.0) % 360.0
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn identity() { assert_eq!(distance_m(0.0,0.0,0.0,0.0),0.0); }
    #[test] fn one_degree() { assert!((distance_m(0.0,0.0,0.0,1.0)-111_195.08).abs()<1.0); }
    #[test] fn dateline() { assert!(distance_m(0.0,179.999,0.0,-179.999)<230.0); }
    #[test] fn cardinal() { assert!((initial_bearing(0.0,0.0,0.0,1.0)-90.0).abs()<0.00001); }
    #[test] fn invalid() { assert!(distance_m(91.0,0.0,0.0,0.0).is_nan()); }
}
