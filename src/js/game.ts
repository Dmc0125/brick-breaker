import {
    draw_rect,
    draw_circle,
    type Render_Context,
    type Color,
} from "./render.ts";

const BALL_SPEED_PER_SECOND = 300;
const PADDLE_SPEED_PER_SECOND = 300;
const PADDLE_BOOST_SPEED_PER_SECOND = 800;
const PARTICLE_MAX_SPEED_PER_SECOND = 40;
const BOOST_COOLDOWN_MS = 4000;
const BOOST_DURATION_MS = 500;

const PADDLE_COLOR = { r: 10, g: 255, b: 247, a: 1 };

type Rect = {
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

type Paddle = {
    w: number;
    h: number;
    x: number;
    y: number;
};

function paddle_rect(paddle: Paddle): Rect {
    return {
        left: paddle.x,
        right: paddle.x + paddle.w,
        top: paddle.y + paddle.h,
        bottom: paddle.y,
    };
}

const brick_color: Color[] = [
    { r: 219, g: 83, b: 117, a: 1 },
    { r: 236, g: 146, b: 145, a: 1 },
    { r: 223, g: 190, b: 153, a: 1 },
];

type Brick = {
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

function brick_init(x: number, y: number, w: number, h: number): Brick {
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

function brick_rect(brick: Brick): Rect {
    return {
        left: brick.x,
        right: brick.x + brick.w,
        top: brick.y + brick.h,
        bottom: brick.y,
    };
}

function brick_begin_animation(brick: Brick, time: number) {
    if (brick.animating) {
        return;
    }

    brick.animating = true;
    brick.anim_start_color = brick.color;
    brick.anim_start_time = time;
}

function brick_animate(brick: Brick, time: number) {
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

type Brick_Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    gravity: number;

    lifetime: number;
    timestamp: number;
    alpha: number;
};

function brick_particles_create(
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

export type Key_Code = "Left" | "Right" | "R" | "O" | "P" | "Space";
export type Boost_State = "boosting" | "recharging" | "full";

export type Game_Context = {
    elapsed_time: number;
    delta_time_secs: number;
    keys_records: Map<Key_Code, number>;
    game_phase: Game_Phase;
    render_ctx: Render_Context;

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
    ctx.render_ctx = {
        canvas_ctx,
    } as Render_Context;
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
