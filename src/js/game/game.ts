import { draw_rect, draw_circle, type Color } from "../render.ts"

export type Context = {
    canvas_ctx: CanvasRenderingContext2D
    game_width: number
    game_height: number

    elapsed_time: number
    delta_time_secs: number
}

export const LOGICAL_WIDTH = 800
export const LOGICAL_HEIGHT = 600

export function context_init(canvas_element: HTMLCanvasElement): Context {
    const ctx = {
        canvas_ctx: canvas_element.getContext("2d")!,
        game_width: LOGICAL_WIDTH,
        game_height: LOGICAL_HEIGHT,

        elapsed_time: 0,
        delta_time_secs: 0,
    } as Context

    function resize() {
        const r = canvas_element.getBoundingClientRect()
        canvas_element.width = r.width
        canvas_element.height = r.height
    }

    window.addEventListener("DOMContentLoaded", resize)
    window.addEventListener("resize", resize)

    return ctx
}

export function frame_begin(ctx: Context) {
    const cctx = ctx.canvas_ctx
    const scale_x = cctx.canvas.width / ctx.game_width
    const scale_y = cctx.canvas.height / ctx.game_height
    cctx.scale(scale_x, scale_y)
}

export function frame_end(ctx: Context) {
    ctx.canvas_ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}

const PADDLE_WIDTH = 80
const PADDLE_HEIGHT = 10

const PADDLE_SPEED_PER_SECOND = 200
const PADDLE_BOOST_SPEED_PER_SECOND = 800

const BOOST_COOLDOWN_MS = 4000
const BOOST_DURATION_MS = 500

const PADDLE_COLOR = { r: 10, g: 255, b: 247, a: 1 }
const PADDLE_BOOST_COLOR = { r: 239, g: 177, b: 0, a: 1 }

const PADDLE_TRAIL_SPAWN_FREQUENCY_MS = 30

export type Boost_State = "boosting" | "recharging" | "full"

type Paddle_Trail = {
    x: number
    timestamp: number
    alpha: number
}

export type Paddle = {
    w: number
    h: number
    x: number
    y: number

    speed: number
    color: Color
    animating_color: boolean
    animation_start_color: Color
    animation_end_color: Color
    animation_start_timestamp: number
    animation_duration: number

    last_trail_timestamp: number
    trail_alpha: number
    trail_animation_duration: number
    trail: Paddle_Trail[]

    // boost
    boost_state: Boost_State
    boost_state_ui?: Boost_State
    boost_last_used_timestamp: number
    boost_indicator_element?: HTMLDivElement
    boost_indicator_bar_element?: HTMLDivElement
}

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
    }
}

export function paddle_spawn(paddle: Paddle, ctx: Context) {
    paddle.w = PADDLE_WIDTH
    paddle.h = PADDLE_HEIGHT
    paddle.x = ctx.game_width / 2 - PADDLE_WIDTH / 2
    paddle.y = 20
    paddle.speed = PADDLE_SPEED_PER_SECOND
    paddle.color = PADDLE_COLOR
}

export type Paddle_Input = {
    left: boolean
    right: boolean
    space: boolean
}

export function paddle_update(paddle: Paddle, ctx: Context, input: Paddle_Input) {
    {
        // animate color
        if (paddle.animating_color) {
            if (paddle.animation_start_timestamp + paddle.animation_duration < ctx.elapsed_time) {
                paddle.animating_color = false
                paddle.color = paddle.animation_end_color
            } else {
                const fraction =
                    (ctx.elapsed_time - paddle.animation_start_timestamp) /
                    paddle.animation_duration

                const r = lerp(
                    paddle.animation_start_color.r,
                    paddle.animation_end_color.r,
                    fraction,
                )
                const g = lerp(
                    paddle.animation_start_color.g,
                    paddle.animation_end_color.g,
                    fraction,
                )
                const b = lerp(
                    paddle.animation_start_color.b,
                    paddle.animation_end_color.b,
                    fraction,
                )
                const a = lerp(
                    paddle.animation_start_color.a,
                    paddle.animation_end_color.a,
                    fraction,
                )
                paddle.color = { r, g, b, a }
            }
        }
    }

    {
        // animate trail
        for (let i = 0; i < paddle.trail.length; ) {
            const trail = paddle.trail[i]

            if (trail.timestamp + paddle.trail_animation_duration < ctx.elapsed_time) {
                paddle.trail.splice(i, 1)
                continue
            }

            const fraction = (ctx.elapsed_time - trail.timestamp) / paddle.trail_animation_duration
            const alpha_range = paddle.trail_alpha
            trail.alpha = alpha_range * (1 - fraction)

            i++
        }
    }

    function animation_begin(paddle: Paddle, end_color: Color) {
        paddle.animating_color = true
        paddle.animation_start_timestamp = ctx.elapsed_time
        paddle.animation_start_color = paddle.color
        paddle.animation_end_color = end_color
    }

    switch (paddle.boost_state) {
        case "boosting": {
            if (paddle.boost_last_used_timestamp + BOOST_DURATION_MS < ctx.elapsed_time) {
                paddle.boost_state = "recharging"
                animation_begin(paddle, PADDLE_COLOR)
            }

            if (paddle.last_trail_timestamp + PADDLE_TRAIL_SPAWN_FREQUENCY_MS < ctx.elapsed_time) {
                paddle.trail.push({
                    x: paddle.x,
                    timestamp: ctx.elapsed_time,
                    alpha: paddle.trail_alpha,
                })
                paddle.last_trail_timestamp = ctx.elapsed_time
            }

            break
        }
        case "recharging": {
            if (
                paddle.boost_last_used_timestamp + BOOST_COOLDOWN_MS + BOOST_DURATION_MS <
                ctx.elapsed_time
            ) {
                paddle.boost_state = "full"
            }
            break
        }
        case "full": {
            if (input.space) {
                paddle.boost_state = "boosting"
                paddle.boost_last_used_timestamp = ctx.elapsed_time
                animation_begin(paddle, PADDLE_BOOST_COLOR)
            }
            break
        }
    }

    const speed =
        paddle.boost_state === "boosting" ? PADDLE_BOOST_SPEED_PER_SECOND : PADDLE_SPEED_PER_SECOND
    const d = speed * ctx.delta_time_secs

    if (input.left) {
        paddle.x -= d
        if (paddle.x < 0) {
            paddle.x = 0
        }
    }
    if (input.right) {
        paddle.x += d
        if (paddle.x + paddle.w > ctx.game_width) {
            paddle.x = ctx.game_width - paddle.w
        }
    }
}

export function paddle_render(ctx: Context, paddle: Paddle) {
    // boost indicator
    const color_transition = "background-color 200ms ease-in-out"

    if (paddle.boost_state_ui !== paddle.boost_state) {
        if (paddle.boost_state === "boosting") {
            // started boosting
            paddle.boost_state_ui = "boosting"

            if (paddle.boost_indicator_element && paddle.boost_indicator_bar_element) {
                const boost_indicator_element = paddle.boost_indicator_element
                const boost_indicator_bar_element = paddle.boost_indicator_bar_element
                boost_indicator_bar_element.style.transition = `width ${BOOST_DURATION_MS}ms linear, ${color_transition}`
                boost_indicator_bar_element.classList.remove("bg-cyan-500", "w-full")
                boost_indicator_bar_element.classList.add("bg-yellow-500", "w-0")
                boost_indicator_element.classList.remove("bg-cyan-500/20")
                boost_indicator_element.classList.add("bg-yellow-500/20")
            }
        } else if (paddle.boost_state === "recharging") {
            // finished boosting
            paddle.boost_state_ui = "recharging"

            if (paddle.boost_indicator_element && paddle.boost_indicator_bar_element) {
                const boost_indicator_element = paddle.boost_indicator_element
                const boost_indicator_bar_element = paddle.boost_indicator_bar_element
                boost_indicator_bar_element.style.transition = `width ${BOOST_COOLDOWN_MS}ms linear, ${color_transition}`
                boost_indicator_bar_element.classList.remove("bg-yellow-500", "w-0")
                boost_indicator_bar_element.classList.add("bg-gray-500", "w-full")
                boost_indicator_element.classList.remove("bg-yellow-500/20")
                boost_indicator_element.classList.add("bg-gray-500/20")
            }
        } else if (paddle.boost_state === "full") {
            // finished recharging
            if (paddle.boost_indicator_element && paddle.boost_indicator_bar_element) {
                const boost_indicator_element = paddle.boost_indicator_element
                const boost_indicator_bar_element = paddle.boost_indicator_bar_element
                paddle.boost_state_ui = "full"
                boost_indicator_bar_element.classList.remove("bg-gray-500")
                boost_indicator_bar_element.classList.add("bg-cyan-500")
                boost_indicator_element.classList.remove("bg-gray-500/20")
                boost_indicator_element.classList.add("bg-cyan-500/20")
            }
        }
    }

    // trail
    const cctx = ctx.canvas_ctx

    for (const trail of paddle.trail) {
        const color = { ...PADDLE_BOOST_COLOR }
        color.a = trail.alpha

        cctx.save()
        cctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
        draw_rect(ctx, { x: trail.x, y: paddle.y, w: paddle.w, h: paddle.h }, 5)
        cctx.restore()
    }

    // paddle

    const color = paddle.color
    cctx.save()
    cctx.shadowBlur = 25
    cctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
    cctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
    draw_rect(ctx, paddle, 5)
    cctx.restore()
}

export const PARTICLE_MAX_SPEED_PER_SECOND = 40

export const brick_color: Color[] = [
    { r: 219, g: 83, b: 117, a: 1 },
    { r: 236, g: 146, b: 145, a: 1 },
    { r: 223, g: 190, b: 153, a: 1 },
]

type Brick_State = "alive" | "exploding" | "destroyed"

export type Brick_Particle = {
    size: number

    x: number
    y: number
    vx: number
    vy: number

    angle: number
    spin_speed: number
    alpha: number

    anim_start_time: number
    anim_duration: number
}

export function brick_particles_update(ctx: Context, particles: Brick_Particle[]) {
    for (let i = 0; i < particles.length; ) {
        const p = particles[i]

        if (p.anim_start_time + p.anim_duration < ctx.elapsed_time) {
            particles.splice(i, 1)
            continue
        }

        const alpha_range = 1
        const fraction = 1 - (ctx.elapsed_time - p.anim_start_time) / p.anim_duration
        const eased = 1 - Math.pow(1 - fraction, 2)

        p.x += p.vx * eased * ctx.delta_time_secs
        p.y += p.vy * eased * ctx.delta_time_secs
        p.alpha = alpha_range * eased
        p.angle += p.spin_speed * ctx.delta_time_secs

        i++
    }
}

export function brick_particles_render(ctx: Context, particles: Brick_Particle[]) {
    const cctx = ctx.canvas_ctx
    for (const p of particles) {
        cctx.save()
        cctx.translate(p.x, ctx.game_height - p.y - p.size)
        cctx.rotate((p.angle * Math.PI) / 180)
        cctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`
        cctx.shadowBlur = 5

        cctx.beginPath()
        cctx.fillRect(p.size / -2, p.size / -2, p.size, p.size)
        cctx.fill()

        cctx.restore()
    }
}

export type Brick = {
    x: number
    y: number
    w: number
    h: number
    hits: number
    lives: number
    color: Color
    state: Brick_State
    particles_start_index: number
    particles_count: number

    // animation

    animating: boolean
    anim_start_color: Color
    anim_end_color: Color
    anim_start_time: number
    anim_duration: number
}

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
        particles_start_index: 0,
        particles_count: 0,

        animating: false,
        anim_start_color: { r: 255, g: 255, b: 255, a: 1 },
        anim_end_color: { r: 255, g: 255, b: 255, a: 1 },
        anim_start_time: 0,
        anim_duration: 400,
    }
}

export function brick_take_hit(ctx: Context, brick: Brick) {
    if (brick.state !== "alive") {
        return
    }

    if (brick.hits < brick.lives) {
        brick.hits += 1
    }

    if (brick_color[brick.hits]) {
        brick.color = brick_color[brick.hits]
    }

    if (brick.hits === brick.lives) {
        brick.state = "exploding"
        brick.animating = true
        brick.anim_start_color = brick.color
        brick.anim_end_color = { r: 255, g: 255, b: 255, a: 1 }
        brick.anim_start_time = ctx.elapsed_time
    }
}

export function brick_update(ctx: Context, brick: Brick, particles: Brick_Particle[]) {
    switch (brick.state) {
        case "exploding": {
            if (brick.animating) {
                if (brick.anim_start_time + brick.anim_duration < ctx.elapsed_time) {
                    brick.state = "destroyed"
                    brick.animating = false
                    brick.color = brick.anim_end_color

                    // spawn particles

                    const particles_count = 15
                    brick.particles_start_index = particles.length
                    brick.particles_count = particles_count

                    for (let i = 0; i < particles_count; i++) {
                        const size = Math.random() * 10 + 5

                        const x = brick.x + Math.random() * brick.w
                        const y = brick.y + Math.random() * brick.h

                        // from 35 to 100 px per second
                        let vx = 150 * (0.35 + Math.random() * 0.65)
                        let vy = 150 * (0.35 + Math.random() * 0.65)
                        if (Math.random() > 0.5) {
                            vx *= -1
                        }
                        if (Math.random() > 0.5) {
                            vy *= -1
                        }

                        const angle = Math.random() * Math.PI * 2
                        const spin_speed = (Math.random() - 0.5) * 1000

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
                        })
                    }
                } else {
                    const fraction =
                        (ctx.elapsed_time - brick.anim_start_time) / brick.anim_duration
                    const r = lerp(brick.anim_start_color.r, brick.anim_end_color.r, fraction)
                    const g = lerp(brick.anim_start_color.g, brick.anim_end_color.g, fraction)
                    const b = lerp(brick.anim_start_color.b, brick.anim_end_color.b, fraction)
                    const a = lerp(brick.anim_start_color.a, brick.anim_end_color.a, fraction)
                    brick.color = { r, g, b, a }
                }
            }
            break
        }
    }
}

export function brick_render(ctx: Context, brick: Brick) {
    switch (brick.state) {
        case "alive":
        case "exploding": {
            const cctx = ctx.canvas_ctx
            cctx.save()
            const color = brick.color
            cctx.shadowBlur = 15
            cctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
            cctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
            draw_rect(ctx, brick, 5)
            cctx.restore()
            break
        }
    }
}

const BALL_RADIUS = 5
const BALL_SPEED_PER_SECOND = 300
const BALL_COLOR = { r: 255, g: 0, b: 0, a: 1 }

export type Ball = {
    x: number
    y: number
    vx: number
    vy: number
    color: Color
}

export function ball_init(ctx: Context, paddle: Paddle): Ball {
    const x = ctx.game_width / 2 - BALL_RADIUS / 2
    const y = paddle.y + paddle.h + BALL_RADIUS

    let angle = Math.random() * 50
    if (Math.random() > 0.5) {
        angle *= -1
    }
    const angle_rad = (angle * Math.PI) / 180

    const vx = BALL_SPEED_PER_SECOND * Math.sin(angle_rad)
    const vy = BALL_SPEED_PER_SECOND * Math.cos(angle_rad)

    return {
        x,
        y,
        vx,
        vy,
        color: BALL_COLOR,
    }
}

export function ball_update(ctx: Context, ball: Ball, paddle: Paddle, bricks: Brick[]) {
    ball.x += ball.vx * ctx.delta_time_secs
    ball.y += ball.vy * ctx.delta_time_secs
    ;(function () {
        const b_left = ball.x - BALL_RADIUS
        const b_right = ball.x + BALL_RADIUS
        const b_top = ball.y + BALL_RADIUS
        const b_bottom = ball.y - BALL_RADIUS

        {
            // collisions with walls
            const b_left = ball.x - BALL_RADIUS
            const b_right = ball.x + BALL_RADIUS

            if (b_left < 0) {
                ball.x = BALL_RADIUS
                ball.vx *= -1
                return
            } else if (b_right > ctx.game_width) {
                ball.x = ctx.game_width - BALL_RADIUS
                ball.vx *= -1
                return
            }

            const b_top = ball.y + BALL_RADIUS

            if (b_top > ctx.game_height) {
                ball.y = ctx.game_height - BALL_RADIUS
                ball.vy *= -1
                return
            }
        }

        {
            // collisisons with bricks
            for (const brick of bricks) {
                if (brick.state === "destroyed") {
                    continue
                }

                const br_left = brick.x
                const br_right = brick.x + brick.w
                const br_top = brick.y + brick.h
                const br_bottom = brick.y

                const x_inside = b_right > br_left && b_left < br_right
                const y_inside = b_top > br_bottom && b_bottom < br_top

                if (!(x_inside && y_inside)) {
                    continue
                }

                const overlap_left = b_right - br_left
                const overlap_right = br_right - b_left
                const overlap_top = br_top - b_bottom
                const overlap_bottom = b_top - br_bottom

                const min_x = Math.min(overlap_left, overlap_right)
                const min_y = Math.min(overlap_top, overlap_bottom)

                if (min_x < min_y) {
                    if (overlap_left < overlap_right) {
                        ball.x = br_left - BALL_RADIUS
                    } else {
                        ball.x = br_right + BALL_RADIUS
                    }
                    ball.vx *= -1
                } else {
                    if (overlap_top < overlap_bottom) {
                        ball.y = br_top + BALL_RADIUS
                    } else {
                        ball.y = br_bottom - BALL_RADIUS
                    }
                    ball.vy *= -1
                }

                brick_take_hit(ctx, brick)
                return
            }
        }

        {
            // collisions with paddle
            const p_left = paddle.x
            const p_right = paddle.x + paddle.w
            const p_top = paddle.y + paddle.h
            const p_bottom = paddle.y

            const x_inside = b_right > p_left && b_left < p_right
            const y_inside = b_top > p_bottom && b_bottom < p_top

            if (!(x_inside && y_inside)) {
                return
            }

            const overlap_left = b_right - p_left
            const overlap_right = p_right - b_left
            const overlap_top = p_top - b_bottom

            const min_x = Math.min(overlap_left, overlap_right)

            if (min_x < overlap_top) {
                if (overlap_left < overlap_right) {
                    ball.x = p_left - BALL_RADIUS
                } else {
                    ball.x = p_right + BALL_RADIUS
                }
                ball.vx *= -1
            } else {
                // can only collide from top

                const paddle_center = paddle.x + paddle.w / 2
                const hit = ball.x - paddle_center
                const relative = Math.max(-1, Math.min(1, hit / (paddle.w / 2)))
                const curved = Math.sign(relative) * Math.pow(Math.abs(relative), 1 / 3)
                const angle = curved * 55
                const angle_rad = (angle * Math.PI) / 180

                ball.y = p_top + BALL_RADIUS
                ball.vx = BALL_SPEED_PER_SECOND * Math.sin(angle_rad)
                ball.vy = BALL_SPEED_PER_SECOND * Math.cos(angle_rad)
            }
        }
    })()
}

export function ball_render(ctx: Context, ball: Ball) {
    const cctx = ctx.canvas_ctx
    cctx.save()
    cctx.shadowBlur = 15
    cctx.shadowColor = `rgba(${ball.color.r}, ${ball.color.g}, ${ball.color.b}, ${ball.color.a})`
    cctx.fillStyle = `rgba(${ball.color.r}, ${ball.color.g}, ${ball.color.b}, ${ball.color.a})`
    draw_circle(ctx, ball.x, ball.y, BALL_RADIUS)
    cctx.restore()
}
