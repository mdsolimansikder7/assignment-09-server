import app from "../src/app.js";

// Vercel serverless entry. Exporting the Express app lets Vercel route every
// rewritten request through the same REST API used locally.
export default app;
