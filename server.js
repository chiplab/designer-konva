import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import express from "express";

installGlobals();

const app = express();

// Increase body size limit for large images (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS middleware for app proxy routes
app.use((req, res, next) => {
  const origin = req.get('origin') || req.get('referer');
  
  // Allow Shopify domains and handle dynamic imports
  if (origin && (origin.includes('.myshopify.com') || origin.includes('admin.shopify.com'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Add CORS headers for module scripts
    if (req.path.includes('/assets/')) {
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    }
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

// Debug middleware to log requests
app.use((req, res, next) => {
  if (req.path.startsWith('/assets/') || req.path.startsWith('/build/')) {
    console.log(`Static file request: ${req.method} ${req.path}`);
  }
  next();
});

// Serve static files
app.use(express.static("public"));

// Serve Remix assets - IMPORTANT: must match Remix's expected paths
app.use("/build", express.static("build/client"));

// CRITICAL: Serve assets from the correct nested build path
// Vite builds them to build/client/build/assets due to our assetsDir config
app.use("/build/assets", express.static("build/client/build/assets", {
  maxAge: "1y",
  immutable: true
}));

// Also serve at /assets for backward compatibility
app.use("/assets", express.static("build/client/build/assets", {
  maxAge: "1y",
  immutable: true
}));

// Handle Shopify app proxy requests
if (process.env.NODE_ENV === 'production') {
  // Set proper Content-Type for Shopify proxy routes
  app.use('/apps/designer', (req, res, next) => {
    res.setHeader("Content-Type", "application/liquid");
    next();
  });
}

// Remix handler - MUST BE LAST
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