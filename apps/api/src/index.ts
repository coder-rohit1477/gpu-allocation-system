import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`[api] listening on port ${env.port} (${env.nodeEnv})`);
});
