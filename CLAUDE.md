# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server with Shopify CLI (includes Prisma migrations and Remix dev)
- `npm run build` - Build the application for production
- `npm run lint` - Run ESLint checks
- `npm run setup` - Generate Prisma client and deploy migrations (required for initial setup and production)

### Shopify CLI Commands
- `npm run config:link` - Link app configuration to Shopify Partners
- `npm run generate` - Generate Shopify app extensions or other resources
- `npm run deploy` - Deploy app to Shopify
- `npm run config:use` - Switch between app configurations
- `npm run env` - Show/manage environment variables

### Database Commands
- `npm run prisma` - Access Prisma CLI directly
- Prisma migrations are handled automatically during `npm run dev`
- For production: `npm run setup` handles both `prisma generate` and `prisma migrate deploy`

## Architecture Overview

### Tech Stack
- **Framework**: Remix (React-based full-stack framework)
- **Database**: SQLite with Prisma ORM (easily configurable for other databases)
- **UI**: Shopify Polaris components + App Bridge for embedded Shopify admin integration
- **API**: Shopify Admin GraphQL API (January 2025 version)
- **Authentication**: Shopify App OAuth with session storage via Prisma

### Project Structure
- `app/` - Main application code (Remix convention)
  - `routes/` - File-based routing with nested routes
  - `shopify.server.ts` - Shopify app configuration and authentication
  - `db.server.ts` - Database connection
- `prisma/` - Database schema and migrations
- `extensions/` - Shopify app extensions (if any)

### Key Configuration Files
- `shopify.app.toml` - Shopify app configuration (scopes: write_products)
- `shopify.web.toml` - Web component configuration 
- `vite.config.ts` - Build configuration with Shopify-specific HMR setup
- `prisma/schema.prisma` - Database schema with Session model for Shopify auth

### Authentication & API Access
- All admin routes require authentication via `authenticate.admin(request)`
- GraphQL queries use `admin.graphql()` method from authenticated context
- Session data stored in SQLite database via Prisma adapter
- App is embedded in Shopify admin by default

### Routes Pattern
- `app._index.tsx` - Main dashboard with product creation demo
- `app.additional.tsx` - Additional page example
- `auth.*.tsx` - Authentication flow handling
- `webhooks.*.tsx` - Webhook endpoints for app lifecycle events

### Important Notes
- Uses modern Remix v2 features with Vite bundler
- Configured for App Store distribution
- Supports both development stores and production environments
- Environment variables managed through Shopify CLI (`npm run env`)
- Database migrations handled automatically in development

## Curved Text Implementation

### Overview
The curved text feature in `proxy.designer.tsx` provides advanced typography controls for product customization, allowing text to be rendered along circular paths with dynamic radius adjustment and orientation flipping.

### Key Concepts

1. **Top-Edge Pinning**: When the text orientation is flipped, the text's top edge remains fixed at its original position. This creates an intuitive user experience where the text appears to "flip around" its top edge rather than jumping to a new location.

2. **Text Flipping**: The implementation supports two orientations:
   - **Normal (not flipped)**: Text curves upward along the path
   - **Flipped**: Text curves downward, with the baseline and text direction inverted

3. **Dynamic Radius**: Users can adjust the curve radius from 50px to 500px:
   - Smaller radius values create tighter, more dramatic curves
   - Larger radius values create gentler, more subtle curves

### Implementation Details

- **SVG Path Rendering**: The curved text is rendered using SVG `<textPath>` elements that follow circular arc paths
- **Path Calculation**: The implementation dynamically calculates the SVG path based on:
  - Current radius value
  - Flip state (normal or inverted)
  - Text dimensions and positioning
- **State Management**: React state manages:
  - `text`: The input text string
  - `radius`: Current curve radius (50-500px)
  - `isFlipped`: Boolean for text orientation
- **Responsive Controls**: Polaris components provide the UI:
  - TextField for text input
  - RangeSlider for radius adjustment
  - Checkbox for flip toggle

### Canvas Architecture
The designer canvas in `proxy.designer.tsx` uses a component-based architecture where each design element (like curved text) can be independently controlled and rendered. The canvas maintains a 600x400px viewport with centered content positioning.