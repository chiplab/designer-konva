# Customer Design Implementation Plan

## Overview
This document outlines the implementation plan for the CustomerDesign feature, which enables customers to save, share, and manage their custom designs across the product customization workflow.

## Architecture Components

### 1. Database Schema

#### CustomerDesign Model
```prisma
model CustomerDesign {
  id               String    @id @default(cuid())
  shop             String    // For multi-tenant isolation
  customerId       String?   // Shopify customer ID (null for drafts)
  email            String?   // For draft recovery before auth
  
  // Design references
  templateId       String    // Links to Template model
  productId        String    // Shopify product GID
  variantId        String    // Shopify variant GID
  
  // Design data
  canvasState      String    // Full canvas JSON (same format as Template)
  thumbnail        String    // S3 URL
  name             String?   // Customer's name for design
  
  // Status tracking
  status           String    @default("draft") // draft, saved, ordered
  orderId          String?   // Shopify order ID if ordered
  orderLineItemId  String?   // For tracking specific line items
  
  // Sharing & Access
  shareToken       String?   @unique @default(cuid())
  isPublic         Boolean   @default(false)
  
  // Auto-cleanup for drafts
  expiresAt        DateTime? // Set to 30 days for drafts
  
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  
  // Relations
  template         Template  @relation(fields: [templateId], references: [id])
  
  @@index([shop, customerId])
  @@index([shop, email])
  @@index([shareToken])
  @@index([status])
  @@index([expiresAt])
}
```

### 2. S3 Storage Structure

```
customer-designs/
  {shop}/
    drafts/
      {designId}/
        canvas-{timestamp}.json     # Canvas state
        thumbnail-{timestamp}.png   # Preview image
        assets/                     # Any uploaded images
    saved/
      {customerId}/
        {designId}/
          canvas-{timestamp}.json
          thumbnail-{timestamp}.png
          assets/
```

### 3. LocalStorage Schema

```javascript
{
  currentDesign: {
    id: "draft_123",          // CustomerDesign ID
    templateId: "xyz",        // Template ID
    variantId: "123",         // Variant ID
    productId: "456",         // Product ID
    lastModified: 1234567890, // For sync detection
    status: "draft"           // draft, saved, ordered
  },
  
  returnTo: {
    type: "product",          // product, cart, account
    url: "/products/poker-chips",
    context: {}               // Any additional context
  }
}
```

## Implementation Steps

### Phase 1: Database Setup
1. Add CustomerDesign model to Prisma schema
2. Update Template model with relation
3. Run migration
4. Create database indexes

### Phase 2: S3 Infrastructure
1. Update s3.server.ts with new helper functions:
   - `generateCustomerDesignKey()`
   - `uploadCustomerDesignAsset()`
2. Configure S3 lifecycle policy for 30-day draft deletion
3. Add new S3 path structure for customer designs

### Phase 3: API Routes
1. Create `/api/designs/draft.tsx` - Create draft endpoint
2. Create `/api/designs/[id].tsx` - Get/update design endpoint
3. Create `/api/designs/save.tsx` - Convert draft to saved
4. Create `/api/designs/share.tsx` - Generate share links

### Phase 4: Product Customizer Modal Updates
1. Add "Advanced Editor" button
2. Implement draft creation on advanced editor click
3. Add LocalStorage state management
4. Handle return flow from full designer

### Phase 5: Full Designer Integration
1. Copy `hello.tsx` to `full.tsx`
2. Add design loading from URL params
3. Implement save functionality
4. Add share feature
5. Handle auth redirects

### Phase 6: Cart Integration
1. Update cart line item properties with design ID
2. Add "Edit Design" functionality
3. Implement design preview in cart

### Phase 7: Customer Account
1. Create `account.designs.tsx` route
2. List saved designs
3. Add edit/share/reorder actions
4. Implement design management UI

### Phase 8: Order Webhook
1. Create order/created webhook handler
2. Auto-save designs on order completion
3. Update design status and remove expiration

### Phase 9: Share Feature
1. Create public share route
2. Implement share token generation
3. Add share preview page
4. Handle anonymous viewing

### Phase 10: Cleanup & Testing
1. Implement draft cleanup cron job
2. Add error handling
3. Test all workflows
4. Add monitoring

## State Flow Diagrams

### A. New Design Flow
```
Product Page → Modal (Simple) → Advanced Editor → Full Designer → Save
     ↓              ↓                   ↓               ↓           ↓
LocalStorage    Draft Created      LocalStorage    Auth Check   Saved Design
```

### B. Edit Design Flow
```
Cart/Account → Load Design → Full Designer → Update → Return
      ↓            ↓              ↓            ↓         ↓
LocalStorage   From DB      LocalStorage   Save to DB  Original Page
```

### C. Share Design Flow
```
Saved Design → Generate Token → Share URL → Public View → Load on Product
      ↓              ↓              ↓            ↓              ↓
   DB Query    Update Design    Copy Link   Anonymous View  Start Custom
```

## Key Features

1. **Draft Auto-Save**: All work saved to S3, survives browser refresh
2. **30-Day Draft Cleanup**: Automatic S3 lifecycle policy
3. **Passwordless Auth Support**: State persists through auth redirects
4. **Order Auto-Save**: Designs automatically saved when ordered
5. **Shareable Links**: Public URLs for sharing designs
6. **Multi-Device**: Access designs from any device
7. **Edit Anywhere**: Edit from cart, account, or product page

## Success Criteria

- [ ] Customers can save designs without losing work
- [ ] Designs persist through auth flow
- [ ] Drafts auto-delete after 30 days
- [ ] Designs can be shared via URL
- [ ] Orders automatically save designs
- [ ] Customers can manage saved designs
- [ ] Edit flow works from cart and account
- [ ] All states properly sync between LocalStorage and S3

## Timeline

- Phase 1-2: 1 day (Database & S3 setup)
- Phase 3-5: 2 days (Core API & Designer)
- Phase 6-7: 1 day (Cart & Account)
- Phase 8-9: 1 day (Webhooks & Sharing)
- Phase 10: 1 day (Testing & Polish)

Total: ~6 days of implementation