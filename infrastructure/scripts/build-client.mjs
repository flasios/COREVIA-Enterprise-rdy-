import path from "node:path";
import { build, createLogger } from "vite";

const root = process.cwd();
const filteredWarning =
  "A PostCSS plugin did not pass the `from` option to `postcss.parse`. This may cause imported assets to be incorrectly transformed. If you've recently added a PostCSS plugin that raised this warning, please contact the package author to fix the issue.";

const viteLogger = createLogger("info", {
  allowClearScreen: false,
});

const customLogger = {
  ...viteLogger,
  warn(message, options) {
    if (message.includes(filteredWarning)) {
      return;
    }

    viteLogger.warn(message, options);
  },
  warnOnce(message, options) {
    if (message.includes(filteredWarning)) {
      return;
    }

    viteLogger.warnOnce(message, options);
  },
};

await build({
  configFile: path.resolve(root, "vite.config.ts"),
  customLogger,
});