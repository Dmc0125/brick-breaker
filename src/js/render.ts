import * as game from "./game/game.ts"

export type Color = {
    r: number
    g: number
    b: number
    a: number
}

export type Rect = {
    x: number
    y: number
    w: number
    h: number
}

export function draw_rect(ctx: game.Context, rect: Rect, border_radius = 0) {
    const cctx = ctx.canvas_ctx
    const canvas_y = ctx.game_height - rect.y - rect.h

    if (border_radius > 0) {
        cctx.beginPath()
        cctx.roundRect(rect.x, canvas_y, rect.w, rect.h, border_radius)
        cctx.fill()
    } else {
        cctx.fillRect(rect.x, canvas_y, rect.w, rect.h)
    }
}

export function draw_circle(ctx: game.Context, x: number, y: number, radius: number) {
    const cctx = ctx.canvas_ctx
    const canvas_y = ctx.game_height - y
    cctx.beginPath()
    cctx.arc(x, canvas_y, radius, 0, 2 * Math.PI)
    cctx.fill()
}
