// types.ts — shared TypeScript types for Game Hub
export interface Player {
  id: 1 | 2;
  name: string;
  score: number;
  color: string;
}
export interface GameState {
  status: 'idle' | 'playing' | 'paused' | 'gameover';
  currentPlayer: Player;
  players: [Player, Player];
  round: number;
  winner: Player | null;
}
export interface Vec2 { x: number; y: number; }
export interface Rect { x: number; y: number; w: number; h: number; }
export interface CarPhysics {
  pos: Vec2;
  vel: Vec2;
  angle: number;        // radians
  speed: number;
  steering: number;
  throttle: number;
  brake: number;
  drift: number;
}
export type GameName = 'boxing' | 'racing' | 'tictactoe' | 'pingpong' | 'connectfour' | 'battleship';
export interface GameConfig {
  name: GameName;
  title: string;
  players: 2;
  controls: { p1: string; p2: string };
}
// Runtime utility (works in browser too)
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}
