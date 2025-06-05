import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import express from "express";

installGlobals();

const app = express();

// CORS middleware for app proxy routes
app.use((req, res, next) => {
  const origin = req.get('origin');
  
  // Allow Shopify domains
  if (origin && (origin.includes('.myshopify.com') || origin.includes('admin.shopify.com'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Health check endpoint for App Runner
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Serve static files
app.use(express.static("public"));

// Serve Remix assets - IMPORTANT: must match Remix's expected paths
app.use("/build", express.static("build/client"));

// CRITICAL: Serve assets at /assets/ for production builds
// This is where Remix looks for them when using absolute URLs
app.use("/assets", express.static("build/client/assets"));

// Remix handler
app.all(
  "*",
  createRequestHandler({
    build: await import("./build/server/index.js"),
    mode: process.env.NODE_ENV,
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});