import {
    countdown_start,
    game_context_init,
    update_and_render,
    type Key_Code,
} from "./game.ts";

const canvas_element = document.getElementById("canvas")! as HTMLCanvasElement;
const game_ctx = game_context_init(canvas_element.getContext("2d")!);

const keys_pressed: Key_Code[] = [];

function press_key(key_code: Key_Code) {
    if (!keys_pressed.includes(key_code)) {
        keys_pressed.push(key_code);
    }
}

function unpress_key(key_code: Key_Code) {
    for (let i = 0; i < keys_pressed.length; i++) {
        if (keys_pressed[i] === key_code) {
            keys_pressed.splice(i, 1);
            break;
        }
    }
}

window.addEventListener("keydown", function(e) {
    switch (e.key) {
        case "ArrowLeft":
            press_key("Left");
            break;
        case "ArrowRight":
            press_key("Right");
            break;
        case "r":
        case "R":
            press_key("R");
            break;
        case "o":
        case "O":
            press_key("O");
            break;
        case "p":
        case "P":
            press_key("P");
            break;
        case " ":
            e.preventDefault();
            press_key("Space");
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
            unpress_key("Left");
            break;
        case "ArrowRight":
            unpress_key("Right");
            break;
        case "r":
        case "R":
            unpress_key("R");
            break;
        case "o":
        case "O":
            unpress_key("O");
            break;
        case "p":
        case "P":
            unpress_key("P");
            break;
        case " ":
            e.preventDefault();
            unpress_key("Space");
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
    countdown_start(game_ctx);
});

game_ctx.restart_button_element.addEventListener("click", function() {
    countdown_start(game_ctx);
});

game_ctx.resume_button_element.addEventListener("click", function() {
    countdown_start(game_ctx);
});

let last_frame_time = 0

function frame(elapsed_time: number) {
    game_ctx.elapsed_time = elapsed_time;
    game_ctx.delta_time = (elapsed_time - last_frame_time) / 1000;
    last_frame_time = elapsed_time;

    // process_keys(game_ctx)
    update_and_render(game_ctx, keys_pressed);

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
