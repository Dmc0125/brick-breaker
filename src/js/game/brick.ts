import { type Color } from "../render.ts";
import { type Rect } from "./game.ts";

export const PADDLE_BOOST_SPEED_PER_SECOND = 800;
export const PARTICLE_MAX_SPEED_PER_SECOND = 40;

export const brick_color: Color[] = [
    { r: 219, g: 83, b: 117, a: 1 },
    { r: 236, g: 146, b: 145, a: 1 },
    { r: 223, g: 190, b: 153, a: 1 },
];

export type Brick = {
    x: number;
    y: number;
    w: number;
    h: number;
    hits: number;
    lives: number;
    color: Color;

    // animation
    animating: boolean;
    anim_start_color: Color;
    anim_end_color: Color;
    anim_start_time: number;
    anim_duration: number;
};

export function brick_init(x: number, y: number, w: number, h: number): Brick {
    return {
        w,
        h,
        x,
        y,
        hits: 0,
        lives: 3,
        color: brick_color[0],

        animating: false,
        anim_start_color: { r: 255, g: 255, b: 255, a: 1 },
        anim_end_color: { r: 255, g: 255, b: 255, a: 1 },
        anim_start_time: 0,
        anim_duration: 200,
    };
}

export function brick_rect(brick: Brick): Rect {
    return {
        left: brick.x,
        right: brick.x + brick.w,
        top: brick.y + brick.h,
        bottom: brick.y,
    };
}

export function brick_begin_animation(brick: Brick, time: number) {
    if (brick.animating) {
        return;
    }

    brick.animating = true;
    brick.anim_start_color = brick.color;
    brick.anim_start_time = time;
}

export function brick_animate(brick: Brick, time: number) {
    if (!brick.animating) {
        return;
    }

    if (brick.anim_start_time + brick.anim_duration < time) {
        brick.animating = false;
        brick.color = brick.anim_end_color;
        return;
    }

    const elapsed = time - brick.anim_start_time;
    const progress = elapsed / brick.anim_duration;

    function lerp(a: number, b: number, t: number) {
        return a + (b - a) * t;
    }

    const r = lerp(brick.anim_start_color.r, brick.anim_end_color.r, progress);
    const g = lerp(brick.anim_start_color.g, brick.anim_end_color.g, progress);
    const b = lerp(brick.anim_start_color.b, brick.anim_end_color.b, progress);
    const a = lerp(brick.anim_start_color.a, brick.anim_end_color.a, progress);

    brick.color = { r, g, b, a };
}

export type Brick_Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    gravity: number;

    lifetime: number;
    timestamp: number;
    alpha: number;
};

export function brick_particles_create(
    particles: Brick_Particle[],
    brick_rect: Rect,
    time: number,
) {
    const count = 20;
    const x_range = brick_rect.right - brick_rect.left;
    const y_range = brick_rect.top - brick_rect.bottom;

    for (let i = 0; i < count; i++) {
        const x = Math.random() * x_range + brick_rect.left;
        const y = Math.random() * y_range + brick_rect.bottom;

        const vx =
            (Math.random() > 0.5 ? 1 : -1) * PARTICLE_MAX_SPEED_PER_SECOND;
        const vy =
            (Math.random() > 0.5 ? 1 : -1) * PARTICLE_MAX_SPEED_PER_SECOND;

        particles.push({
            x,
            y,
            vx,
            vy,
            gravity: 0,
            lifetime: 400,
            timestamp: time,
            alpha: 1,
        });
    }
}
