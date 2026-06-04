import {
  draw_rect,
  draw_circle,
  type Render_Context,
  type Color,
} from "./render.ts";

type Game_Phase = "start" | "countdown" | "playing" | "gameover" | "paused";

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
let bricks = [] as Brick[];

function generate_bricks(cols: number, rows: number) {
  bricks = [];

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

      bricks.push({
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

type Key_Code = "Left" | "Right" | "R" | "O" | "P";
type Key_Mod = "CTRL" | "SHIFT";

const ball = {
  radius: 5,
} as Ball;

const paddle = {
  w: 80,
  h: 10,
  speed: 2,
} as Paddle;

type Game_State = {
  phase: Game_Phase;

  countdown: number;
  last_countdown_update: number;
};

const canvas_element = document.getElementById("canvas")! as HTMLCanvasElement;

const render_ctx = {
  canvas_ctx: canvas_element.getContext("2d")!,
} as Render_Context;

const keydown = new Map<Key_Code, boolean>();
const keymod = new Map<Key_Mod, boolean>();

window.addEventListener("keydown", function (e) {
  switch (e.key) {
    case "ArrowLeft":
      keydown.set("Left", true);
      break;
    case "ArrowRight":
      keydown.set("Right", true);
      break;
    case "r":
    case "R":
      keydown.set("R", true);
      break;
    case "o":
    case "O":
      keydown.set("O", true);
      break;
    case "p":
    case "P":
      keydown.set("P", true);
      break;
    case "Control":
      keymod.set("CTRL", true);
      break;
    case "Shift":
      keymod.set("SHIFT", true);
      break;
  }
});
window.addEventListener("keyup", function (e) {
  switch (e.key) {
    case "ArrowLeft":
      keydown.set("Left", false);
      break;
    case "ArrowRight":
      keydown.set("Right", false);
      break;
    case "r":
    case "R":
      keydown.set("R", false);
      break;
    case "o":
    case "O":
      keydown.set("O", false);
      break;
    case "p":
    case "P":
      keydown.set("P", false);
      break;
    case "Control":
      keymod.set("CTRL", false);
      break;
    case "Shift":
      keymod.set("SHIFT", false);
      break;
  }
});

let game_state: Game_State = {
  phase: "start",
  countdown: 3,
  last_countdown_update: 0,
};

function set_canvas_size() {
  const rect = canvas_element.getBoundingClientRect();
  canvas_element.width = rect.width;
  canvas_element.height = rect.height;

  render_ctx.game_width = canvas_element.width;
  render_ctx.game_height = canvas_element.height;
}

window.addEventListener("DOMContentLoaded", set_canvas_size);
window.addEventListener("resize", set_canvas_size);

const start_button_element = document.getElementById(
  "start-button",
)! as HTMLButtonElement;
const start_menu_element = document.getElementById(
  "start-menu",
)! as HTMLDivElement;
const restart_button_element = document.getElementById(
  "restart-button",
)! as HTMLButtonElement;
const resume_button_element = document.getElementById(
  "resume-button",
)! as HTMLButtonElement;

start_button_element.addEventListener("click", function () {
  if (game_state.phase === "start") {
    countdown_start();
  }
});
restart_button_element.addEventListener("click", function () {
  if (game_state.phase === "gameover") {
    countdown_start();
  }
});
resume_button_element.addEventListener("click", function () {
  if (game_state.phase === "paused") {
    const paused_element = document.getElementById("paused")! as HTMLDivElement;
    paused_element.classList.add("hidden");
    game_state.phase = "playing";
  }
});

const countdown_element = document.getElementById(
  "countdown",
)! as HTMLDivElement;
const gameover_element = document.getElementById("gameover")! as HTMLDivElement;

function countdown_start() {
  render_ctx.canvas_ctx.clearRect(
    0,
    0,
    render_ctx.game_width,
    render_ctx.game_height,
  );

  game_state.phase = "countdown";
  game_state.countdown = 3;
  game_state.last_countdown_update = performance.now();

  start_menu_element.classList.add("hidden");
  gameover_element.classList.add("hidden");

  countdown_element.classList.remove("hidden");
  countdown_element.innerText = `${game_state.countdown}`;
}

function game_start() {
  start_menu_element.classList.add("hidden");
  countdown_element.classList.add("hidden");
  gameover_element.classList.add("hidden");

  game_state.phase = "playing";

  paddle.x = render_ctx.game_width / 2 - paddle.w / 2;
  paddle.y = 20;

  ball.x = render_ctx.game_width / 2 - ball.radius;
  ball.y = 20 + paddle.h + ball.radius;
  ball.vx = (Math.random() > 0.2 ? 1 : -1) * 2;
  ball.vy = 2;

  generate_bricks(8, 5);

  countdown_element.classList.add("hidden");
}

type Collision_Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
type Collision_Result = { vx: number; vy: number };

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

function frame(elapsed_time: number) {
  if (keydown.get("R")) {
    game_start();
    requestAnimationFrame(frame);
    return;
  } else if (keydown.get("O")) {
    start_menu_element.classList.add("hidden");
    countdown_element.classList.add("hidden");

    game_state.phase = "gameover";
    gameover_element.classList.remove("hidden");

    requestAnimationFrame(frame);
    return;
  } else if (keydown.get("P")) {
    const paused_element = document.getElementById("paused")! as HTMLDivElement;
    paused_element.classList.remove("hidden");
    game_state.phase = "paused";

    requestAnimationFrame(frame);
    return;
  }

  switch (game_state.phase) {
    case "countdown":
      if (elapsed_time - game_state.last_countdown_update >= 1000) {
        game_state.countdown -= 1;
        game_state.last_countdown_update = elapsed_time;

        countdown_element.innerText = `${game_state.countdown}`;

        if (game_state.countdown === -1) {
          game_start();
        }
      }

      break;
    case "playing":
      // update paddle
      if (keydown.get("Left")) {
        paddle.x -= paddle.speed;
      }
      if (keydown.get("Right")) {
        paddle.x += paddle.speed;
      }

      const paddle_r = paddle_rect(paddle);

      {
        // paddle collisions
        const { left, right } = paddle_r;

        if (left < 0) {
          paddle.x = 0;
        } else if (right > render_ctx.game_width) {
          paddle.x = render_ctx.game_width - paddle.w;
        }
      }

      // update ball
      ball.x += ball.vx;
      ball.y += ball.vy;

      const ball_r = ball_rect(ball);

      {
        // check for ball collisions
        const { left, top, right, bottom } = ball_r;

        if (left < 0) {
          ball.x = ball.radius;
          ball.vx = -ball.vx;
        } else if (right > render_ctx.game_width) {
          ball.x = render_ctx.game_width - ball.radius;
          ball.vx = -ball.vx;
        } else if (bottom < 0) {
          game_state.phase = "gameover";
          gameover_element.classList.remove("hidden");
        } else if (top > render_ctx.game_height) {
          ball.y = render_ctx.game_height - ball.radius;
          ball.vy = -ball.vy;
        }
      }

      {
        // check collisions between ball and paddle
        const collision = check_collision(ball_r, paddle_r);

        if (collision) {
          ball.vx *= collision.vx;
          ball.vy *= collision.vy;
        }
      }

      {
        // check collisions between ball and bricks
        for (const brick of bricks) {
          const brick_r = brick_rect(brick);
          const collision = check_collision(ball_r, brick_r);

          if (collision) {
            ball.vx *= collision.vx;
            ball.vy *= collision.vy;

            brick.hits += 1;
            if (brick.hits >= brick.lives) {
              bricks.splice(bricks.indexOf(brick), 1);
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
      draw_circle(render_ctx, ball.x, ball.y, ball.radius, {
        r: 255,
        g: 0,
        b: 0,
        a: 1,
      });

      // render paddle
      draw_rect(
        render_ctx,
        paddle,
        {
          r: 0,
          g: 255,
          b: 0,
          a: 1,
        },
        5,
      );

      // render bricks
      for (const brick of bricks) {
        const color = brick_color[brick.lives - brick.hits];
        draw_rect(render_ctx, brick, color, 5);
      }

      break;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
