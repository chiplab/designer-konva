import { LoaderFunction } from "@remix-run/node";
import path from "path";
import fs from "fs/promises";

export const loader: LoaderFunction = async ({ params }) => {
  const assetPath = params["*"];
  
  if (!assetPath) {
    return new Response("Not found", { status: 404 });
  }

  // Security: Only allow specific file extensions
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const ext = path.extname(assetPath).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Construct the full path to the file in public directory
  const publicPath = path.join(process.cwd(), 'public', assetPath);
  
  try {
    // Check if file exists and is within public directory
    const resolvedPath = path.resolve(publicPath);
    const publicDir = path.resolve(process.cwd(), 'public');
    
    if (!resolvedPath.startsWith(publicDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    // Read the file
    const file = await fs.readFile(resolvedPath);
    
    // Determine content type
    const contentType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';

    // Return the file with proper headers
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*', // Allow cross-origin requests from themes
      },
    });
  } catch (error) {
    return new Response("Not found", { status: 404 });
  }
};