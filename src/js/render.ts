export type Render_Context = {
  canvas_ctx: CanvasRenderingContext2D;
  game_height: number;
  game_width: number;
};

export type Color = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function draw_rect(ctx: Render_Context, rect: Rect, color: Color) {
  const cctx = ctx.canvas_ctx;
  cctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
  const canvas_y = ctx.game_height - rect.y - rect.h;
  cctx.fillRect(rect.x, canvas_y, rect.w, rect.h);
}

export function draw_circle(
  ctx: Render_Context,
  x: number,
  y: number,
  radius: number,
  color: Color,
) {
  const cctx = ctx.canvas_ctx;
  cctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;

  const canvas_y = ctx.game_height - y;
  cctx.beginPath();
  cctx.arc(x, canvas_y, radius, 0, 2 * Math.PI);
  cctx.fill();
}
