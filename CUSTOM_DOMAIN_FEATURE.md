# Custom Domain Feature Implementation

## Overview
This feature allows users to connect their own custom domain (e.g., `buysial.com`) to their e-commerce store, which is currently accessible at `web.buysial.com`. When visitors access the custom domain, they will automatically see the e-commerce product catalog.

## What Was Implemented

### 1. Backend Changes

#### User Model (`backend/src/modules/models/User.js`)
- Added `customDomain` field to store the user's custom domain name
- Field is trimmed and stored in lowercase for consistency

#### API Endpoints (`backend/src/modules/routes/users.js`)
- **GET `/api/user/custom-domain`** - Retrieve the current user's custom domain setting
- **POST `/api/user/custom-domain`** - Save/update the custom domain setting
  - Validates domain format (e.g., `buysial.com`, `www.example.com`)
  - Normalizes domain to lowercase
- **GET `/api/user/by-domain/:domain`** - Public endpoint to look up which user owns a domain
  - Used by the frontend to detect custom domains and load the appropriate store

### 2. Frontend Changes

#### Profile Settings Page (`frontend/src/pages/user/ProfileSettings.jsx`)
- Added new "Custom Domain" configuration card with:
  - Input field for entering domain name
  - Setup instructions with DNS configuration steps
  - Current domain display with clickable link
  - Save button to persist changes

#### App Router (`frontend/src/App.jsx`)
- Added `CustomDomainRouter` component that:
  - Detects the current hostname
  - Checks if it's a registered custom domain via API
  - Automatically displays the product catalog for custom domains
  - Shows normal routing for `web.buysial.com` and `localhost`

## How to Use

### For Users (Store Owners)

1. **Navigate to Profile Settings**
   - Go to `https://web.buysial.com/user/profile-settings`
   - Scroll down to the "Custom Domain" section

2. **Enter Your Domain**
   - Type your domain name (e.g., `buysial.com`)
   - Click "Save Custom Domain"

3. **Configure DNS Settings**
   - Go to your domain registrar's DNS management panel
   - Add a CNAME record:
     ```
     Type: CNAME
     Host: @ (or your subdomain, e.g., www)
     Value: web.buysial.com
     TTL: Auto or 3600
     ```

4. **Wait for DNS Propagation**
   - DNS changes typically take 5-10 minutes
   - Can take up to 24-48 hours in some cases

5. **Test Your Domain**
   - Visit your custom domain in a browser
   - Your e-commerce store should load automatically

### Example DNS Configuration

For `buysial.com` pointing to `web.buysial.com`:

```
Type    Host    Value               TTL
CNAME   @       web.buysial.com     3600
CNAME   www     web.buysial.com     3600
```

## Technical Details

### Domain Detection Flow
1. User visits a custom domain (e.g., `https://buysial.com`)
2. Frontend checks the hostname
3. If hostname is NOT `web.buysial.com` or `localhost`, it calls `/api/user/by-domain/:domain`
4. If a matching user is found, the store info is saved to sessionStorage
5. The product catalog is automatically displayed
6. All e-commerce functionality works normally (products, cart, checkout)

### Security & Validation
- Domain format is validated using regex pattern
- Domains are normalized to lowercase
- Only users with role `user` can set custom domains
- Public lookup endpoint only returns basic, non-sensitive user info

## Files Modified

### Backend
- `backend/src/modules/models/User.js` - Added customDomain field
- `backend/src/modules/routes/users.js` - Added 3 new endpoints

### Frontend
- `frontend/src/pages/user/ProfileSettings.jsx` - Added custom domain UI and logic
- `frontend/src/App.jsx` - Added custom domain detection and routing

## Testing Checklist

- [ ] User can save a custom domain in profile settings
- [ ] Domain validation rejects invalid formats
- [ ] Custom domain setting persists after page reload
- [ ] Visiting custom domain shows product catalog
- [ ] Visiting `web.buysial.com` shows normal site/dashboard
- [ ] DNS CNAME properly resolves to the platform
- [ ] Multiple users can have different custom domains
- [ ] Removing custom domain (empty string) works correctly

## Future Enhancements

Potential improvements for this feature:

1. **SSL Certificate Management**
   - Automatic SSL certificate provisioning for custom domains
   - Let's Encrypt integration

2. **Domain Verification**
   - Verify DNS configuration before activating
   - Show verification status in the UI

3. **Multi-Domain Support**
   - Allow users to connect multiple domains
   - Primary/secondary domain configuration

4. **Analytics**
   - Track traffic sources by domain
   - Domain-specific conversion metrics

5. **Branding Per Domain**
   - Different logos/colors per domain
   - Domain-specific product catalogs

## Support

If users encounter issues:
1. Verify DNS configuration is correct
2. Wait for DNS propagation (can take up to 48 hours)
3. Clear browser cache and try incognito mode
4. Check that domain is properly saved in profile settings
5. Contact support if issues persist after 48 hours

## Notes

- The custom domain feature is currently available for users with the `user` role
- Only the e-commerce catalog is shown on custom domains (no admin/dashboard access)
- Users can still access their admin dashboard at `web.buysial.com/user`
