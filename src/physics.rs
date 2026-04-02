//! physics.rs — Racing game physics engine (Rust / WebAssembly)
//!
//! This module is designed to be compiled to WebAssembly via wasm-pack:
//!   wasm-pack build --target web
//!
//! In the browser build, JavaScript calls these functions directly.
//! The pure-JS fallback in racing/racing.js mirrors this logic.

use std::f64::consts::PI;

#[derive(Debug, Clone, Copy)]
pub struct Vec2 {
    pub x: f64,
    pub y: f64,
}

impl Vec2 {
    pub fn new(x: f64, y: f64) -> Self { Vec2 { x, y } }
    pub fn length(&self) -> f64 { (self.x * self.x + self.y * self.y).sqrt() }
    pub fn normalized(&self) -> Self {
        let len = self.length();
        if len < 1e-9 { return Vec2::new(0.0, 0.0); }
        Vec2::new(self.x / len, self.y / len)
    }
    pub fn dot(&self, other: &Vec2) -> f64 { self.x * other.x + self.y * other.y }
}

#[derive(Debug, Clone)]
pub struct CarState {
    pub pos: Vec2,
    pub vel: Vec2,
    pub angle: f64,       // radians, 0 = right
    pub speed: f64,
    pub lap: u32,
    pub checkpoint: u32,
}

impl CarState {
    pub fn new(x: f64, y: f64) -> Self {
        CarState {
            pos: Vec2::new(x, y),
            vel: Vec2::new(0.0, 0.0),
            angle: 0.0,
            speed: 0.0,
            lap: 0,
            checkpoint: 0,
        }
    }
}

const MAX_SPEED: f64 = 6.0;
const ACCELERATION: f64 = 0.18;
const BRAKE_FORCE: f64 = 0.28;
const FRICTION: f64 = 0.96;
const STEERING_SPEED: f64 = 0.045;

/// Integrate one physics tick (call at 60Hz).
pub fn tick(car: &mut CarState, throttle: f64, brake: f64, steer: f64) {
    // Steering
    if car.speed.abs() > 0.1 {
        car.angle += steer * STEERING_SPEED * (car.speed / MAX_SPEED).min(1.0);
    }

    // Throttle / brake
    if throttle > 0.0 {
        car.speed += ACCELERATION * throttle;
    }
    if brake > 0.0 {
        car.speed -= BRAKE_FORCE * brake;
    }

    // Clamp speed
    car.speed = car.speed.clamp(-MAX_SPEED * 0.4, MAX_SPEED);

    // Friction
    car.speed *= FRICTION;

    // Integrate position
    car.vel.x = car.angle.cos() * car.speed;
    car.vel.y = car.angle.sin() * car.speed;
    car.pos.x += car.vel.x;
    car.pos.y += car.vel.y;
}

/// Reflect velocity off a wall normal (used for boundary collisions).
pub fn reflect_velocity(vel: Vec2, normal: Vec2) -> Vec2 {
    let dot = vel.dot(&normal);
    Vec2::new(
        vel.x - 2.0 * dot * normal.x,
        vel.y - 2.0 * dot * normal.y,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn car_accelerates_forward() {
        let mut car = CarState::new(0.0, 0.0);
        tick(&mut car, 1.0, 0.0, 0.0);
        assert!(car.speed > 0.0);
    }

    #[test]
    fn friction_slows_car() {
        let mut car = CarState::new(0.0, 0.0);
        car.speed = 5.0;
        tick(&mut car, 0.0, 0.0, 0.0);
        assert!(car.speed < 5.0);
    }
}
