import { countdown_start, game_context_init, game_start, process_keys, update_and_render, type Game_Context, type Key_Code } from "./game.ts";

const canvas_element = document.getElementById("canvas")! as HTMLCanvasElement;

const game_ctx = {
    game_phase: "start",
    keydown: new Map<Key_Code, boolean>(),
    render_ctx: {
        canvas_ctx: canvas_element.getContext("2d")!,
    },
} as Game_Context;
game_context_init(game_ctx);

window.addEventListener("keydown", function(e) {
    switch (e.key) {
        case "ArrowLeft":
            game_ctx.keydown.set("Left", true);
            break;
        case "ArrowRight":
            game_ctx.keydown.set("Right", true);
            break;
        case "r":
        case "R":
            game_ctx.keydown.set("R", true);
            break;
        case "o":
        case "O":
            game_ctx.keydown.set("O", true);
            break;
        case "p":
        case "P":
            game_ctx.keydown.set("P", true);
            break;
        case "Control":
            // keymod.set("CTRL", true);
            break;
        case "Shift":
            // keymod.set("SHIFT", true);
            break;
    }
});

window.addEventListener("keyup", function(e) {
    switch (e.key) {
        case "ArrowLeft":
            game_ctx.keydown.set("Left", false);
            break;
        case "ArrowRight":
            game_ctx.keydown.set("Right", false);
            break;
        case "r":
        case "R":
            game_ctx.keydown.set("R", false);
            break;
        case "o":
        case "O":
            game_ctx.keydown.set("O", false);
            break;
        case "p":
        case "P":
            game_ctx.keydown.set("P", false);
            break;
        case "Control":
            // keymod.set("CTRL", false);
            break;
        case "Shift":
            // keymod.set("SHIFT", false);
            break;
    }
});

function set_canvas_size() {
    const rect = canvas_element.getBoundingClientRect();
    canvas_element.width = rect.width;
    canvas_element.height = rect.height;

    game_ctx.render_ctx.game_width = canvas_element.width;
    game_ctx.render_ctx.game_height = canvas_element.height;
}

window.addEventListener("DOMContentLoaded", set_canvas_size);
window.addEventListener("resize", set_canvas_size);

game_ctx.start_button_element.addEventListener("click", function() {
    countdown_start(game_ctx)
});

game_ctx.restart_button_element.addEventListener("click", function() {
    countdown_start(game_ctx)
});

game_ctx.resume_button_element.addEventListener("click", function() {
    countdown_start(game_ctx)
});

function frame(elapsed_time: number) {
    game_ctx.elapsed_time = elapsed_time;

    process_keys(game_ctx)
    update_and_render(game_ctx)

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
