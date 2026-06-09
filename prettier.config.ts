import { type Config } from "prettier";

const config: Config = {
    printWidth: 80,
    tabWidth: 4,
    trailingComma: "all",
    singleQuote: false,
    semi: true,
    bracketSpacing: true,
    plugins: ["prettier-plugin-astro"],
    overrides: [
        {
            files: "*.astro",
            options: {
                parser: "astro",
            },
        },
    ],
};

export default config;
