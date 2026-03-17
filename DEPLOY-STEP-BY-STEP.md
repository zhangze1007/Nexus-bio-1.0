# Non-Coder Friendly Deployment Guide

This guide will help you deploy the Nexus-Bio application to the internet for free, in under 15 minutes.

## Checklist (Estimated Time: 15 mins)

- [ ] 1. Export Code (1 min)
- [ ] 2. Create GitHub Account (2 mins)
- [ ] 3. Upload Code to GitHub (3 mins)
- [ ] 4. Create Vercel Account (2 mins)
- [ ] 5. Connect Vercel to GitHub (2 mins)
- [ ] 6. Configure Build Settings (1 min)
- [ ] 7. Deploy (2 mins)
- [ ] 8. Verify 3D Canvas works (1 min)
- [ ] 9. Verify Search works (1 min)
- [ ] 10. Share your link!

---

## Step-by-Step Instructions (Vercel)

### Step 1: Get the Code
1. In AI Studio, click the **Export** button (usually top right).
2. Download the project as a ZIP file.
3. Extract (unzip) the folder on your computer.

### Step 2: Upload to GitHub
1. Go to [GitHub.com](https://github.com) and sign up for a free account.
2. Click the **+** icon in the top right and select **New repository**.
3. Name it `nexus-bio` and click **Create repository**.
4. On the next page, click the link that says **"uploading an existing file"**.
5. Drag and drop all the files from your unzipped folder into the browser window.
6. Click **Commit changes**.

### Step 3: Deploy to Vercel
1. Go to [Vercel.com](https://vercel.com) and sign up using your GitHub account.
2. Click **Add New...** -> **Project**.
3. You will see a list of your GitHub repositories. Find `nexus-bio` and click **Import**.
4. **Important Settings:**
   - Framework Preset: `Vite` (Vercel usually detects this automatically).
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Deploy**.

### Step 4: Wait and Verify
1. Vercel will now build your app. This takes about 1-2 minutes.
2. Once you see the confetti screen, click **Continue to Dashboard**.
3. Click the **Visit** button to see your live website!

### Troubleshooting
- **Blank Screen?** Ensure your Output Directory is set to `dist`.
- **Build Failed?** Check the Vercel logs. Ensure `package.json` is in the root of your repository.
