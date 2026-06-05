import { draw_rect, draw_circle, type Render_Context, type Color } from "./render.ts";

type Game_Phase = "start" | "countdown_start" | "countdown_paused" | "playing" | "gameover" | "paused";

type Ball = {
    radius: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
};

function ball_rect(ball: Ball): {
    left: number;
    top: number;
    right: number;
    bottom: number;
} {
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
    speed: number;
};

function paddle_rect(paddle: Paddle): {
    left: number;
    top: number;
    right: number;
    bottom: number;
} {
    return {
        left: paddle.x,
        right: paddle.x + paddle.w,
        top: paddle.y + paddle.h,
        bottom: paddle.y,
    };
}

type Brick = {
    x: number;
    y: number;
    w: number;
    h: number;
    hits: number;
    lives: number;
};

function brick_rect(brick: Brick): {
    left: number;
    top: number;
    right: number;
    bottom: number;
} {
    return {
        left: brick.x,
        right: brick.x + brick.w,
        top: brick.y + brick.h,
        bottom: brick.y,
    };
}

const brick_color: Record<number, Color> = {
    1: { r: 223, g: 190, b: 153, a: 1 },
    2: { r: 236, g: 146, b: 145, a: 1 },
    3: { r: 219, g: 83, b: 117, a: 1 },
};

export type Key_Code = "Left" | "Right" | "R" | "O" | "P" | "Space";

export type Game_Context = {
    elapsed_time: number;
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
    ball: Ball;
    paddle: Paddle;
    bricks: Brick[];
}

export function game_context_init(canvas_ctx: CanvasRenderingContext2D): Game_Context {
    const ctx = {} as Game_Context;

    ctx.game_phase = "start";
    ctx.render_ctx = {
        canvas_ctx,
    } as Render_Context;
    ctx.keys_records = new Map<Key_Code, number>();

    ctx.paddle = {
        w: 80,
        h: 10,
        x: 0,
        y: 0,
        speed: 2,
    }
    ctx.ball = {
        radius: 5,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
    }
    ctx.bricks = [];

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
    ctx.gameover_element = document.getElementById("gameover")! as HTMLDivElement;
    ctx.restart_button_element = document.getElementById(
        "restart-button",
    )! as HTMLButtonElement;
    ctx.paused_element = document.getElementById("paused")! as HTMLDivElement;
    ctx.resume_button_element = document.getElementById(
        "resume-button",
    )! as HTMLButtonElement;

    return ctx;
}

export function countdown_start(ctx: Game_Context) {
    switch (ctx.game_phase) {
        case "start":
        case "gameover":
            const render_ctx = ctx.render_ctx;
            render_ctx.canvas_ctx.clearRect(0, 0, render_ctx.game_width, render_ctx.game_height);

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

export function game_start(ctx: Game_Context, resume: boolean) {
    ctx.game_phase = "playing";

    if (!resume) {
        const { render_ctx } = ctx;

        ctx.paddle.x = render_ctx.game_width / 2 - ctx.paddle.w / 2;
        ctx.paddle.y = 20;

        ctx.ball.x = render_ctx.game_width / 2 - ctx.ball.radius;
        ctx.ball.y = 20 + ctx.paddle.h + ctx.ball.radius;
        ctx.ball.vx = Math.random() * 2 * (Math.random() > 0.5 ? 1 : -1);
        ctx.ball.vy = 2;

        { // generate bricks
            const rows = 5;
            const cols = 8;

            ctx.bricks = [];

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

                    ctx.bricks.push({
                        x,
                        y,
                        w: brick_width,
                        h: brick_height,
                        hits: 0,
                        lives: 3,
                    });
                }
            }
        }
    }

    // ui
    ctx.countdown_element.classList.add("hidden");
}

type Collision_Rect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
type Collision_Result = { vx: number; vy: number };

// TODO: this does not work correclty all the time, sometimes r1 gets stuck
// inside r2, r1 should get pushed out
function check_collision(
    r1: Collision_Rect,
    r2: Collision_Rect,
): Collision_Result | null {
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

    if (min_x < min_y) {
        return { vx: -1, vy: 1 };
    } else {
        return { vx: 1, vy: -1 };
    }
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
    { // process keyboard input
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

        if (ctx.game_phase === "playing") {
            const space = keys_pressed.includes("Space")
            if (ctx.paddle.speed === 2 && space) {
                ctx.paddle.speed = 5;
            } else if (ctx.paddle.speed === 5 && !space) {
                ctx.paddle.speed = 2;
            }

            const arrow_left = keys_pressed.includes("Left")
            if (arrow_left && arrow_left) {
                ctx.paddle.x -= ctx.paddle.speed;
            }

            const arrow_right = keys_pressed.includes("Right")
            if (arrow_right && arrow_right) {
                ctx.paddle.x += ctx.paddle.speed;
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
            ctx.ball.x += ctx.ball.vx;
            ctx.ball.y += ctx.ball.vy;

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
                // TODO: change the ball direction based on where it hits the paddle

                // check collisions between ctx.ball.and paddle
                const collision = check_collision(ball_r, paddle_r);

                if (collision) {
                    ctx.ball.vx *= collision.vx;
                    ctx.ball.vy *= collision.vy;
                }
            }

            {
                // check collisions between ctx.ball.and bricks
                for (const brick of ctx.bricks) {
                    const brick_r = brick_rect(brick);
                    const collision = check_collision(ball_r, brick_r);

                    if (collision) {
                        ctx.ball.vx *= collision.vx;
                        ctx.ball.vy *= collision.vy;

                        brick.hits += 1;
                        if (brick.hits >= brick.lives) {
                            ctx.bricks.splice(ctx.bricks.indexOf(brick), 1);
                        }
                        break;
                    }
                }
            }

            render_ctx.canvas_ctx.clearRect(
                0,
                0,
                render_ctx.game_width,
                render_ctx.game_height,
            );

            // render ball
            draw_circle(render_ctx, ctx.ball.x, ctx.ball.y, ctx.ball.radius, {
                r: 255,
                g: 0,
                b: 0,
                a: 1,
            });

            // render paddle
            draw_rect(
                render_ctx,
                ctx.paddle,
                {
                    r: 0,
                    g: 255,
                    b: 0,
                    a: 1,
                },
                5,
            );

            // render bricks
            for (const brick of ctx.bricks) {
                const color = brick_color[brick.lives - brick.hits];
                draw_rect(render_ctx, brick, color, 5);
            }
            break;
    }
}
