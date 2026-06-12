import { draw_rect, draw_circle, type Color } from "../render.ts";

const BALL_SPEED_PER_SECOND = 300;

export type Context = {
    canvas_ctx: CanvasRenderingContext2D;
    game_width: number;
    game_height: number;

    elapsed_time: number;
    delta_time_secs: number;
};

export const LOGICAL_WIDTH = 800;
export const LOGICAL_HEIGHT = 600;

export function context_init(canvas_element: HTMLCanvasElement): Context {
    const ctx = {
        canvas_ctx: canvas_element.getContext("2d")!,
        game_width: LOGICAL_WIDTH,
        game_height: LOGICAL_HEIGHT,

        elapsed_time: 0,
        delta_time_secs: 0,
    } as Context;

    function resize() {
        const r = canvas_element.getBoundingClientRect();
        canvas_element.width = r.width;
        canvas_element.height = r.height;
    }

    window.addEventListener("DOMContentLoaded", resize);
    window.addEventListener("resize", resize);

    return ctx;
}

export function frame_begin(ctx: Context) {
    const cctx = ctx.canvas_ctx;
    const scale_x = cctx.canvas.width / ctx.game_width;
    const scale_y = cctx.canvas.height / ctx.game_height;
    cctx.scale(scale_x, scale_y);
}

export function frame_end(ctx: Context) {
    ctx.canvas_ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

export type Rect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};

type Game_Phase =
    | "start"
    | "countdown_start"
    | "countdown_paused"
    | "playing"
    | "gameover"
    | "paused";

type Ball = {
    radius: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
};

function ball_rect(ball: Ball): Rect {
    return {
        left: ball.x - ball.radius,
        right: ball.x + ball.radius,
        top: ball.y + ball.radius,
        bottom: ball.y - ball.radius,
    };
}

const PADDLE_WIDTH = 80;
const PADDLE_HEIGHT = 10;

const PADDLE_SPEED_PER_SECOND = 300;
const PADDLE_BOOST_SPEED_PER_SECOND = 800;

const BOOST_COOLDOWN_MS = 4000;
const BOOST_DURATION_MS = 500;

const PADDLE_COLOR = { r: 10, g: 255, b: 247, a: 1 };
const PADDLE_BOOST_COLOR = { r: 239, g: 177, b: 0, a: 1 };

const PADDLE_TRAIL_SPAWN_FREQUENCY_MS = 30;

export type Boost_State = "boosting" | "recharging" | "full";

type Paddle_Trail = {
    x: number;
    timestamp: number;
    alpha: number;
};

export type Paddle = {
    w: number;
    h: number;
    x: number;
    y: number;

    speed: number;
    color: Color;
    animating_color: boolean;
    animation_start_color: Color;
    animation_end_color: Color;
    animation_start_timestamp: number;
    animation_duration: number;

    last_trail_timestamp: number;
    trail_alpha: number;
    trail_animation_duration: number;
    trail: Paddle_Trail[];

    // boost
    boost_state: Boost_State;
    boost_state_ui?: Boost_State;
    boost_last_used_timestamp: number;
    boost_indicator_element?: HTMLDivElement;
    boost_indicator_bar_element?: HTMLDivElement;
};

export function paddle_init(
    boost_indicator_element?: HTMLDivElement,
    boost_indicator_bar_element?: HTMLDivElement,
): Paddle {
    return {
        w: PADDLE_WIDTH,
        h: PADDLE_HEIGHT,
        x: 0,
        y: 0,

        speed: PADDLE_SPEED_PER_SECOND,
        color: PADDLE_COLOR,
        animating_color: false,
        animation_start_color: {} as Color,
        animation_end_color: {} as Color,
        animation_start_timestamp: 0,
        animation_duration: 100,

        last_trail_timestamp: 0,
        trail_alpha: 0.2,
        trail_animation_duration: 400,
        trail: [],

        boost_state: "recharging",
        boost_last_used_timestamp: 0,
        boost_indicator_element,
        boost_indicator_bar_element,
    };
}

export function paddle_spawn(paddle: Paddle, ctx: Context) {
    paddle.w = PADDLE_WIDTH;
    paddle.h = PADDLE_HEIGHT;
    paddle.x = ctx.game_width / 2 - PADDLE_WIDTH / 2;
    paddle.y = 20;
    paddle.speed = PADDLE_SPEED_PER_SECOND;
    paddle.color = PADDLE_COLOR;
}

export type Paddle_Input = {
    left: boolean;
    right: boolean;
    space: boolean;
};

export function paddle_update(
    paddle: Paddle,
    ctx: Context,
    input: Paddle_Input,
) {
    {
        // animate color
        if (paddle.animating_color) {
            if (
                paddle.animation_start_timestamp + paddle.animation_duration <
                ctx.elapsed_time
            ) {
                paddle.animating_color = false;
                paddle.color = paddle.animation_end_color;
            } else {
                const fraction =
                    (ctx.elapsed_time - paddle.animation_start_timestamp) /
                    paddle.animation_duration;

                const r = lerp(
                    paddle.animation_start_color.r,
                    paddle.animation_end_color.r,
                    fraction,
                );
                const g = lerp(
                    paddle.animation_start_color.g,
                    paddle.animation_end_color.g,
                    fraction,
                );
                const b = lerp(
                    paddle.animation_start_color.b,
                    paddle.animation_end_color.b,
                    fraction,
                );
                const a = lerp(
                    paddle.animation_start_color.a,
                    paddle.animation_end_color.a,
                    fraction,
                );
                paddle.color = { r, g, b, a };
            }
        }
    }

    {
        // animate trail
        for (let i = 0; i < paddle.trail.length; ) {
            const trail = paddle.trail[i];

            if (
                trail.timestamp + paddle.trail_animation_duration <
                ctx.elapsed_time
            ) {
                paddle.trail.splice(i, 1);
                continue;
            }

            const fraction =
                (ctx.elapsed_time - trail.timestamp) /
                paddle.trail_animation_duration;
            const alpha_range = paddle.trail_alpha;
            trail.alpha = alpha_range * (1 - fraction);

            i++;
        }
    }

    function animation_begin(paddle: Paddle, end_color: Color) {
        paddle.animating_color = true;
        paddle.animation_start_timestamp = ctx.elapsed_time;
        paddle.animation_start_color = paddle.color;
        paddle.animation_end_color = end_color;
    }

    switch (paddle.boost_state) {
        case "boosting": {
            if (
                paddle.boost_last_used_timestamp + BOOST_DURATION_MS <
                ctx.elapsed_time
            ) {
                paddle.boost_state = "recharging";
                animation_begin(paddle, PADDLE_COLOR);
            }

            if (
                paddle.last_trail_timestamp + PADDLE_TRAIL_SPAWN_FREQUENCY_MS <
                ctx.elapsed_time
            ) {
                paddle.trail.push({
                    x: paddle.x,
                    timestamp: ctx.elapsed_time,
                    alpha: paddle.trail_alpha,
                });
                paddle.last_trail_timestamp = ctx.elapsed_time;
            }

            break;
        }
        case "recharging": {
            if (
                paddle.boost_last_used_timestamp +
                    BOOST_COOLDOWN_MS +
                    BOOST_DURATION_MS <
                ctx.elapsed_time
            ) {
                paddle.boost_state = "full";
            }
            break;
        }
        case "full": {
            if (input.space) {
                paddle.boost_state = "boosting";
                paddle.boost_last_used_timestamp = ctx.elapsed_time;
                animation_begin(paddle, PADDLE_BOOST_COLOR);
            }
            break;
        }
    }

    const speed =
        paddle.boost_state === "boosting"
            ? PADDLE_BOOST_SPEED_PER_SECOND
            : PADDLE_SPEED_PER_SECOND;
    const d = speed * ctx.delta_time_secs;

    if (input.left) {
        paddle.x -= d;
        if (paddle.x < 0) {
            paddle.x = 0;
        }
    }
    if (input.right) {
        paddle.x += d;
        if (paddle.x + paddle.w > ctx.game_width) {
            paddle.x = ctx.game_width - paddle.w;
        }
    }
}

export function paddle_render(ctx: Context, paddle: Paddle) {
    // boost indicator
    const color_transition = "background-color 200ms ease-in-out";

    if (paddle.boost_state_ui !== paddle.boost_state) {
        if (paddle.boost_state === "boosting") {
            // started boosting
            paddle.boost_state_ui = "boosting";

            if (
                paddle.boost_indicator_element &&
                paddle.boost_indicator_bar_element
            ) {
                const boost_indicator_element = paddle.boost_indicator_element;
                const boost_indicator_bar_element =
                    paddle.boost_indicator_bar_element;
                boost_indicator_bar_element.style.transition = `width ${BOOST_DURATION_MS}ms linear, ${color_transition}`;
                boost_indicator_bar_element.classList.remove(
                    "bg-cyan-500",
                    "w-full",
                );
                boost_indicator_bar_element.classList.add(
                    "bg-yellow-500",
                    "w-0",
                );
                boost_indicator_element.classList.remove("bg-cyan-500/20");
                boost_indicator_element.classList.add("bg-yellow-500/20");
            }
        } else if (paddle.boost_state === "recharging") {
            // finished boosting
            paddle.boost_state_ui = "recharging";

            if (
                paddle.boost_indicator_element &&
                paddle.boost_indicator_bar_element
            ) {
                const boost_indicator_element = paddle.boost_indicator_element;
                const boost_indicator_bar_element =
                    paddle.boost_indicator_bar_element;
                boost_indicator_bar_element.style.transition = `width ${BOOST_COOLDOWN_MS}ms linear, ${color_transition}`;
                boost_indicator_bar_element.classList.remove(
                    "bg-yellow-500",
                    "w-0",
                );
                boost_indicator_bar_element.classList.add(
                    "bg-gray-500",
                    "w-full",
                );
                boost_indicator_element.classList.remove("bg-yellow-500/20");
                boost_indicator_element.classList.add("bg-gray-500/20");
            }
        } else if (paddle.boost_state === "full") {
            // finished recharging
            if (
                paddle.boost_indicator_element &&
                paddle.boost_indicator_bar_element
            ) {
                const boost_indicator_element = paddle.boost_indicator_element;
                const boost_indicator_bar_element =
                    paddle.boost_indicator_bar_element;
                paddle.boost_state_ui = "full";
                boost_indicator_bar_element.classList.remove("bg-gray-500");
                boost_indicator_bar_element.classList.add("bg-cyan-500");
                boost_indicator_element.classList.remove("bg-gray-500/20");
                boost_indicator_element.classList.add("bg-cyan-500/20");
            }
        }
    }

    // trail
    const cctx = ctx.canvas_ctx;

    for (const trail of paddle.trail) {
        const color = { ...PADDLE_BOOST_COLOR };
        color.a = trail.alpha;

        cctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
        draw_rect(
            ctx,
            { x: trail.x, y: paddle.y, w: paddle.w, h: paddle.h },
            5,
        );
    }

    // paddle

    const color = paddle.color;
    cctx.shadowBlur = 25;
    cctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    cctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    draw_rect(ctx, paddle, 5);
}

function paddle_rect(paddle: Paddle): Rect {
    return {
        left: paddle.x,
        right: paddle.x + paddle.w,
        top: paddle.y + paddle.h,
        bottom: paddle.y,
    };
}

export const PARTICLE_MAX_SPEED_PER_SECOND = 40;

export const brick_color: Color[] = [
    { r: 219, g: 83, b: 117, a: 1 },
    { r: 236, g: 146, b: 145, a: 1 },
    { r: 223, g: 190, b: 153, a: 1 },
];

type Brick_State = "alive" | "exploding" | "particles" | "destroyed";

export type Brick_Particle = {
    size: number;

    x: number;
    y: number;
    vx: number;
    vy: number;

    angle: number;
    spin_speed: number;
    alpha: number;

    anim_start_time: number;
    anim_duration: number;
};

export type Brick = {
    x: number;
    y: number;
    w: number;
    h: number;
    hits: number;
    lives: number;
    color: Color;
    state: Brick_State;

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
        state: "alive",

        animating: false,
        anim_start_color: { r: 255, g: 255, b: 255, a: 1 },
        anim_end_color: { r: 255, g: 255, b: 255, a: 1 },
        anim_start_time: 0,
        anim_duration: 400,
    };
}

export function brick_take_hit(ctx: Context, brick: Brick) {
    if (brick.state !== "alive") {
        return;
    }

    if (brick.hits < brick.lives) {
        brick.hits += 1;
    }

    if (brick_color[brick.hits]) {
        brick.color = brick_color[brick.hits];
    }

    if (brick.hits === brick.lives) {
        brick.state = "exploding";
        brick.animating = true;
        brick.anim_start_color = brick.color;
        brick.anim_end_color = { r: 255, g: 255, b: 255, a: 1 };
        brick.anim_start_time = ctx.elapsed_time;
    }
}

export function brick_update(
    ctx: Context,
    brick: Brick,
    particles: Brick_Particle[],
) {
    switch (brick.state) {
        case "exploding": {
            if (brick.animating) {
                if (
                    brick.anim_start_time + brick.anim_duration <
                    ctx.elapsed_time
                ) {
                    brick.state = "particles";
                    brick.animating = false;
                    brick.color = brick.anim_end_color;

                    // spawn particles

                    for (let i = 0; i < 15; i++) {
                        const size = Math.random() * 10 + 5;

                        const x = brick.x + Math.random() * brick.w;
                        const y = brick.y + Math.random() * brick.h;

                        // from 35 to 100 px per second
                        let vx = 150 * (0.35 + Math.random() * 0.65);
                        let vy = 150 * (0.35 + Math.random() * 0.65);
                        if (Math.random() > 0.5) {
                            vx *= -1;
                        }
                        if (Math.random() > 0.5) {
                            vy *= -1;
                        }

                        const angle = Math.random() * Math.PI * 2;
                        const spin_speed = (Math.random() - 0.5) * 1000;

                        particles.push({
                            size,
                            x,
                            y,
                            vx,
                            vy,
                            angle,
                            spin_speed,
                            alpha: 1,
                            anim_start_time: ctx.elapsed_time,
                            anim_duration: 800,
                        });
                    }
                } else {
                    const fraction =
                        (ctx.elapsed_time - brick.anim_start_time) /
                        brick.anim_duration;
                    const r = lerp(
                        brick.anim_start_color.r,
                        brick.anim_end_color.r,
                        fraction,
                    );
                    const g = lerp(
                        brick.anim_start_color.g,
                        brick.anim_end_color.g,
                        fraction,
                    );
                    const b = lerp(
                        brick.anim_start_color.b,
                        brick.anim_end_color.b,
                        fraction,
                    );
                    const a = lerp(
                        brick.anim_start_color.a,
                        brick.anim_end_color.a,
                        fraction,
                    );
                    brick.color = { r, g, b, a };
                }
            }
            break;
        }
        case "particles": {
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                const alpha_range = 1;
                const fraction =
                    1 -
                    (ctx.elapsed_time - p.anim_start_time) / p.anim_duration;
                const eased = 1 - Math.pow(1 - fraction, 2);

                p.x += p.vx * eased * ctx.delta_time_secs;
                p.y += p.vy * eased * ctx.delta_time_secs;
                p.alpha = alpha_range * eased;
                p.angle += p.spin_speed * ctx.delta_time_secs;
            }

            break;
        }
    }
}

export function brick_render(
    ctx: Context,
    brick: Brick,
    particles: Brick_Particle[],
) {
    switch (brick.state) {
        case "alive":
        case "exploding": {
            const cctx = ctx.canvas_ctx;
            cctx.save();
            const color = brick.color;
            cctx.shadowBlur = 25;
            cctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
            cctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
            draw_rect(ctx, brick, 5);
            cctx.restore();
            break;
        }
        case "particles": {
            const cctx = ctx.canvas_ctx;
            for (const p of particles) {
                cctx.save();
                cctx.translate(p.x, ctx.game_height - p.y - p.size);
                cctx.rotate((p.angle * Math.PI) / 180);
                cctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
                cctx.shadowBlur = 5;

                cctx.beginPath();
                cctx.fillRect(p.size / -2, p.size / -2, p.size, p.size);
                cctx.fill();

                cctx.restore();
            }

            break;
        }
    }
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

    const r = lerp(brick.anim_start_color.r, brick.anim_end_color.r, progress);
    const g = lerp(brick.anim_start_color.g, brick.anim_end_color.g, progress);
    const b = lerp(brick.anim_start_color.b, brick.anim_end_color.b, progress);
    const a = lerp(brick.anim_start_color.a, brick.anim_end_color.a, progress);

    brick.color = { r, g, b, a };
}

export type Key_Code = "Left" | "Right" | "R" | "O" | "P" | "Space";

export type Game_Context = {
    elapsed_time: number;
    delta_time_secs: number;
    keys_records: Map<Key_Code, number>;
    game_phase: Game_Phase;
    // render_ctx: Render_Context;

    // ui
    start_menu_element: HTMLDivElement;
    start_button_element: HTMLButtonElement;
    countdown_element: HTMLDivElement;
    gameover_element: HTMLDivElement;
    restart_button_element: HTMLButtonElement;
    paused_element: HTMLDivElement;
    resume_button_element: HTMLButtonElement;

    // countdown
    countdown: number;
    last_countdown_update: number;

    // game
    boost_state: Boost_State;
    boost_last_used_timestamp: number;
    boost_indicator_element: HTMLDivElement;
    boost_indicator_inner_element: HTMLDivElement;

    score: number;
    score_text_element: HTMLParagraphElement;

    ball: Ball;
    paddle: Paddle;
    bricks: Brick[];
    brick_particles: Brick_Particle[];
};

export function game_context_init(
    canvas_ctx: CanvasRenderingContext2D,
): Game_Context {
    const ctx = {} as Game_Context;

    ctx.elapsed_time = 0;
    ctx.delta_time_secs = 0;

    ctx.game_phase = "start";
    // ctx.render_ctx = {
    //     canvas_ctx,
    // } as Render_Context;
    ctx.keys_records = new Map<Key_Code, number>();

    ctx.boost_indicator_element = document.getElementById(
        "boost-indicator",
    )! as HTMLDivElement;
    ctx.boost_indicator_inner_element = document.getElementById(
        "boost-indicator-inner",
    )! as HTMLDivElement;

    ctx.paddle = {
        w: 80,
        h: 10,
        x: 0,
        y: 0,

        speed: PADDLE_SPEED_PER_SECOND,
        color: PADDLE_COLOR,
    };
    ctx.ball = {
        radius: 5,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
    };
    ctx.bricks = [];
    ctx.brick_particles = [];

    // ui
    ctx.start_button_element = document.getElementById(
        "start-button",
    )! as HTMLButtonElement;
    ctx.start_menu_element = document.getElementById(
        "start-menu",
    )! as HTMLDivElement;
    ctx.countdown_element = document.getElementById(
        "countdown",
    )! as HTMLDivElement;
    ctx.gameover_element = document.getElementById(
        "gameover",
    )! as HTMLDivElement;
    ctx.restart_button_element = document.getElementById(
        "restart-button",
    )! as HTMLButtonElement;
    ctx.paused_element = document.getElementById("paused")! as HTMLDivElement;
    ctx.resume_button_element = document.getElementById(
        "resume-button",
    )! as HTMLButtonElement;
    ctx.score_text_element = document.getElementById(
        "score-text",
    )! as HTMLParagraphElement;

    return ctx;
}

export function countdown_start(ctx: Game_Context) {
    switch (ctx.game_phase) {
        case "start":
        case "gameover":
            const render_ctx = ctx.render_ctx;
            render_ctx.canvas_ctx.clearRect(
                0,
                0,
                render_ctx.game_width,
                render_ctx.game_height,
            );

            ctx.game_phase = "countdown_start";
            ctx.countdown = 3;
            ctx.last_countdown_update = performance.now();

            // ui
            ctx.countdown_element.classList.remove("hidden");
            ctx.countdown_element.innerText = `${ctx.countdown}`;
            ctx.start_menu_element.classList.add("hidden");
            ctx.gameover_element.classList.add("hidden");

            break;
        case "paused":
            ctx.game_phase = "countdown_paused";
            ctx.countdown = 3;
            ctx.last_countdown_update = performance.now();

            // ui
            ctx.countdown_element.classList.remove("hidden");
            ctx.countdown_element.innerText = `${ctx.countdown}`;
            ctx.start_menu_element.classList.add("hidden");
            ctx.paused_element.classList.add("hidden");

            break;
    }
}

function boost_indicator_start_recharge(ctx: Game_Context) {
    ctx.boost_indicator_inner_element.style.transition = `width ${BOOST_COOLDOWN_MS}ms, background-color 200ms ease-in-out`;

    ctx.boost_indicator_inner_element.classList.add("bg-gray-500", "w-full");
    ctx.boost_indicator_inner_element.classList.remove("bg-yellow-500", "w-0");
    ctx.boost_indicator_element.classList.add("bg-gray-500/20");
    ctx.boost_indicator_element.classList.remove("bg-yellow-500/20");
}

function boost_indicator_use(ctx: Game_Context) {
    ctx.boost_indicator_inner_element.style.transition = `width ${BOOST_DURATION_MS}ms, background-color 200ms ease-in-out`;

    ctx.boost_indicator_inner_element.classList.remove("bg-cyan-500", "w-full");
    ctx.boost_indicator_inner_element.classList.add("bg-yellow-500", "w-0");
    ctx.boost_indicator_element.classList.remove("bg-cyan-500/20");
    ctx.boost_indicator_element.classList.add("bg-yellow-500/20");
}

function boost_indicator_full(ctx: Game_Context) {
    ctx.boost_indicator_inner_element.classList.remove("bg-gray-500");
    ctx.boost_indicator_inner_element.classList.add("bg-cyan-500");
    ctx.boost_indicator_element.classList.remove("bg-gray-500/20");
    ctx.boost_indicator_element.classList.add("bg-cyan-500/20");

    ctx.boost_indicator_inner_element.style.transition = `width ${BOOST_COOLDOWN_MS}ms, background-color 200ms ease-in-out`;
}

function game_set_score(ctx: Game_Context, score: number) {
    ctx.score = score;
    ctx.score_text_element.innerText = `${score}`;
}

export function game_start(ctx: Game_Context, resume: boolean) {
    ctx.game_phase = "playing";

    ctx.boost_state = "recharging";
    ctx.boost_last_used_timestamp = ctx.elapsed_time;

    if (!resume) {
        const { render_ctx } = ctx;

        ctx.paddle.x = render_ctx.game_width / 2 - ctx.paddle.w / 2;
        ctx.paddle.y = 20;

        ctx.ball.x = render_ctx.game_width / 2 - ctx.ball.radius;
        ctx.ball.y = ctx.paddle.y + ctx.paddle.h + ctx.ball.radius;
        ctx.ball.vx =
            Math.random() *
            BALL_SPEED_PER_SECOND *
            (Math.random() > 0.5 ? 1 : -1);
        ctx.ball.vy = BALL_SPEED_PER_SECOND;

        {
            // generate bricks
            const rows = 5;
            const cols = 8;

            ctx.bricks = [];
            ctx.brick_particles = [];

            const margin_side = 20;
            const margin_top = 20;
            const padding = 20;

            const usable_width =
                render_ctx.game_width - margin_side * 2 - padding * (cols - 1);
            const brick_width = usable_width / cols;
            const brick_height = 20;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const x = margin_side + col * (brick_width + padding);
                    const y =
                        render_ctx.game_height -
                        margin_top -
                        row * (brick_height + padding) -
                        brick_height;

                    ctx.bricks.push(
                        brick_init(x, y, brick_width, brick_height),
                    );
                }
            }
        }
    }

    // ui
    ctx.countdown_element.classList.add("hidden");

    // reset boost indicator
    const transition_duration =
        ctx.boost_indicator_inner_element.style.transition;
    ctx.boost_indicator_inner_element.style.transition = `width 0s`;
    ctx.boost_indicator_inner_element.classList.remove("w-full");
    ctx.boost_indicator_inner_element.classList.add("w-0");
    ctx.boost_indicator_inner_element.offsetWidth;
    ctx.boost_indicator_inner_element.style.transition = `width ${transition_duration}, background-color 200ms ease-in-out`;
    boost_indicator_start_recharge(ctx);

    game_set_score(ctx, 0);
}

type Collision_Direction = "horizontal" | "vertical";
type Collision_Result = {
    vx: number;
    vy: number;
    direction: Collision_Direction;
};

// TODO: this does not work correclty all the time, sometimes r1 gets stuck
// inside r2, r1 should get pushed out
function check_collision(r1: Rect, r2: Rect): Collision_Result | null {
    const overlaps_x = r1.right > r2.left && r1.left < r2.right;
    const overlaps_y = r1.bottom < r2.top && r1.top > r2.bottom;

    if (!(overlaps_x && overlaps_y)) {
        return null;
    }

    const overlap_left = r1.right - r2.left;
    const overlap_right = r2.right - r1.left;
    const overlap_top = r1.top - r2.bottom;
    const overlap_bottom = r2.top - r1.bottom;

    const min_x = Math.min(overlap_left, overlap_right);
    const min_y = Math.min(overlap_top, overlap_bottom);

    const result: Collision_Result = { vx: 0, vy: 0, direction: "horizontal" };

    if (min_x < min_y) {
        result.direction = "horizontal";
        result.vx = -1;
        result.vy = 1;
    } else {
        result.direction = "vertical";
        result.vx = 1;
        result.vy = -1;
    }

    return result;
}

const KEY_TIMEOUT = 200;

function can_press_key(ctx: Game_Context, key_code: Key_Code): boolean {
    const last_recorded = ctx.keys_records.get(key_code);
    if (last_recorded === undefined) {
        return true;
    }
    const now = performance.now();
    return now - last_recorded > KEY_TIMEOUT;
}

export function update_and_render(ctx: Game_Context, keys_pressed: Key_Code[]) {
    {
        // process keyboard input
        if (keys_pressed.includes("R") && can_press_key(ctx, "R")) {
            ctx.keys_records.set("R", performance.now());

            ctx.start_menu_element.classList.add("hidden");
            ctx.countdown_element.classList.add("hidden");
            ctx.gameover_element.classList.add("hidden");

            game_start(ctx, false);
        } else if (keys_pressed.includes("O") && can_press_key(ctx, "O")) {
            ctx.keys_records.set("O", performance.now());

            ctx.game_phase = "gameover";

            // ui
            ctx.start_menu_element.classList.add("hidden");
            ctx.countdown_element.classList.add("hidden");
            ctx.gameover_element.classList.add("remove");
        } else if (keys_pressed.includes("P") && can_press_key(ctx, "P")) {
            ctx.keys_records.set("P", performance.now());

            if (ctx.game_phase === "playing") {
                ctx.game_phase = "paused";

                // ui
                ctx.paused_element.classList.remove("hidden");
            }
        }
    }

    switch (ctx.game_phase) {
        case "countdown_start":
        case "countdown_paused":
            if (ctx.elapsed_time - ctx.last_countdown_update >= 1000) {
                ctx.countdown -= 1;
                ctx.last_countdown_update = ctx.elapsed_time;

                ctx.countdown_element.innerText = `${ctx.countdown}`;

                if (ctx.countdown === -1) {
                    game_start(ctx, ctx.game_phase !== "countdown_start");
                }
            }

            break;
        case "playing":
            {
                // paddle movement
                switch (ctx.boost_state) {
                    case "boosting":
                        if (
                            ctx.boost_last_used_timestamp + BOOST_DURATION_MS <
                            ctx.elapsed_time
                        ) {
                            // boost end
                            ctx.boost_state = "recharging";
                            boost_indicator_start_recharge(ctx);
                        }
                        break;
                    case "recharging":
                        if (
                            ctx.boost_last_used_timestamp +
                                BOOST_COOLDOWN_MS +
                                BOOST_DURATION_MS <
                            ctx.elapsed_time
                        ) {
                            // boost recharged
                            ctx.boost_state = "full";
                            boost_indicator_full(ctx);
                        }
                        break;
                    case "full":
                        if (keys_pressed.includes("Space")) {
                            // boost used
                            ctx.boost_state = "boosting";
                            ctx.boost_last_used_timestamp = ctx.elapsed_time;
                            boost_indicator_use(ctx);
                        }
                        break;
                }

                const paddle_speed =
                    ctx.boost_state === "boosting"
                        ? PADDLE_BOOST_SPEED_PER_SECOND
                        : PADDLE_SPEED_PER_SECOND;

                const arrow_left = keys_pressed.includes("Left");
                if (arrow_left && arrow_left) {
                    ctx.paddle.x -= paddle_speed * ctx.delta_time_secs;
                }

                const arrow_right = keys_pressed.includes("Right");
                if (arrow_right && arrow_right) {
                    ctx.paddle.x += paddle_speed * ctx.delta_time_secs;
                }
            }

            const { render_ctx } = ctx;
            const paddle_r = paddle_rect(ctx.paddle);

            {
                // paddle collisions
                const { left, right } = paddle_r;

                if (left < 0) {
                    ctx.paddle.x = 0;
                } else if (right > render_ctx.game_width) {
                    ctx.paddle.x = render_ctx.game_width - ctx.paddle.w;
                }
            }

            // update ball
            ctx.ball.x += ctx.ball.vx * ctx.delta_time_secs;
            ctx.ball.y += ctx.ball.vy * ctx.delta_time_secs;

            const ball_r = ball_rect(ctx.ball);

            {
                // check for ball collisions
                const { left, top, right, bottom } = ball_r;

                if (left < 0) {
                    ctx.ball.x = ctx.ball.radius;
                    ctx.ball.vx = -ctx.ball.vx;
                } else if (right > render_ctx.game_width) {
                    ctx.ball.x = render_ctx.game_width - ctx.ball.radius;
                    ctx.ball.vx = -ctx.ball.vx;
                } else if (bottom < 0) {
                    ctx.game_phase = "gameover";
                    ctx.gameover_element.classList.remove("hidden");
                    return;
                } else if (top > render_ctx.game_height) {
                    ctx.ball.y = render_ctx.game_height - ctx.ball.radius;
                    ctx.ball.vy = -ctx.ball.vy;
                }
            }

            {
                // check collisions between ctx.ball.and paddle
                const collision = check_collision(ball_r, paddle_r);

                if (collision) {
                    switch (collision.direction) {
                        case "horizontal":
                            ctx.ball.vx *= collision.vx;
                            break;
                        case "vertical":
                            const paddle_center =
                                ctx.paddle.x + ctx.paddle.w / 2;
                            const hit = ctx.ball.x - paddle_center;
                            const relative = hit / (ctx.paddle.w / 2);
                            const clamped = Math.max(-1, Math.min(1, relative));
                            const curved =
                                Math.sign(clamped) *
                                Math.pow(Math.abs(clamped), 1 / 3);

                            const angle = curved * 55;
                            const angle_rad = (angle * Math.PI) / 180;

                            ctx.ball.vx =
                                BALL_SPEED_PER_SECOND * Math.sin(angle_rad);
                            ctx.ball.vy =
                                BALL_SPEED_PER_SECOND * Math.cos(angle_rad);
                            ctx.ball.y =
                                ctx.paddle.y + ctx.paddle.h + ctx.ball.radius;

                            break;
                    }
                }
            }

            {
                // animate bricks and delete bricks that are done animating
                for (let i = 0; i < ctx.bricks.length; ) {
                    brick_animate(ctx.bricks[i], ctx.elapsed_time);

                    const b = ctx.bricks[i];
                    if (b.hits >= b.lives && !b.animating) {
                        const brick_r = brick_rect(b);
                        brick_particles_create(
                            ctx.brick_particles,
                            brick_r,
                            ctx.elapsed_time,
                        );

                        ctx.bricks.splice(i, 1);
                        continue;
                    }
                    i++;
                }

                // check collisions between ctx.ball.and bricks
                for (const brick of ctx.bricks) {
                    const brick_r = brick_rect(brick);
                    const collision = check_collision(ball_r, brick_r);

                    if (collision) {
                        ctx.ball.vx *= collision.vx;
                        ctx.ball.vy *= collision.vy;

                        if (brick.hits < brick.lives) {
                            brick.hits += 1;
                            game_set_score(ctx, ctx.score + 1);

                            if (brick_color[brick.hits]) {
                                brick.color = brick_color[brick.hits];
                            }
                        }

                        if (brick.hits >= brick.lives) {
                            brick_begin_animation(brick, ctx.elapsed_time);
                        }
                        break;
                    }
                }
            }

            {
                // update brick particles
                for (let i = 0; i < ctx.brick_particles.length; ) {
                    const p = ctx.brick_particles[i];

                    if (p.timestamp + p.lifetime < ctx.elapsed_time) {
                        ctx.brick_particles.splice(i, 1);
                        continue;
                    }

                    const fraction =
                        (ctx.elapsed_time - p.timestamp) / p.lifetime;
                    p.alpha = 1 - fraction;

                    const vx = p.vx * ctx.delta_time_secs;
                    const vy =
                        p.vy * ctx.delta_time_secs -
                        p.gravity * ctx.delta_time_secs;
                    p.gravity += 200 * ctx.delta_time_secs;
                    p.x += vx;
                    p.y += vy;

                    i++;
                }
            }

            render_ctx.canvas_ctx.clearRect(
                0,
                0,
                render_ctx.game_width,
                render_ctx.game_height,
            );

            // render paddle
            draw_rect(render_ctx, ctx.paddle, PADDLE_COLOR, 5);

            // render bricks
            for (const brick of ctx.bricks) {
                draw_rect(render_ctx, brick, brick.color, 5);
            }

            // render brick particles
            for (const p of ctx.brick_particles) {
                draw_circle(render_ctx, p.x, p.y, 1, {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: p.alpha,
                });
            }

            // render ball
            draw_circle(render_ctx, ctx.ball.x, ctx.ball.y, ctx.ball.radius, {
                r: 255,
                g: 0,
                b: 0,
                a: 1,
            });

            break;
    }
}
