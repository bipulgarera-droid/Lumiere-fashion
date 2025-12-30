# Deployment to Railway

## Goal
Deploy the Lumière Fashion AI web app to Railway for production use.

## Prerequisites
- A valid `GEMINI_API_KEY` with access to `gemini-2.5-flash-image` model
- Railway account with project created

## Inputs
- Source code in repository
- `GEMINI_API_KEY` environment variable

## Steps

### Local Verification (Before Deploy)
1. Run `npm install` to install dependencies
2. Create `.env` file with `GEMINI_API_KEY=your_key`
3. Run `npm run dev` to verify local development
4. Run `npm run build && npm run preview` to verify production build

### Railway Deployment
1. Push code to GitHub repository
2. In Railway dashboard, create new project from GitHub repo
3. Add environment variable: `GEMINI_API_KEY`
4. Railway will auto-detect Dockerfile and build
5. Wait for deployment to complete
6. Test the live URL

## Outputs
- Live production URL from Railway
- Working app accessible publicly

## Edge Cases / Troubleshooting

### Build Failures
- Check that all npm dependencies are installed
- Verify TypeScript compiles without errors: `npx tsc --noEmit`

### API Errors
- Verify `GEMINI_API_KEY` is set correctly in Railway environment variables
- Check Railway logs for error messages
- Ensure API key has access to image generation model

### Port Issues
- Railway automatically assigns `PORT` env variable
- Vite preview binds to `0.0.0.0` for container access

## Related Scripts
- None currently (frontend-only app, API called from browser)
