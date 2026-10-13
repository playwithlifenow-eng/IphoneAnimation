# Run the PoC

Use the existing checkout. Preserve unrelated uncommitted changes before switching branches.

```powershell
cd 'C:\Users\matth\Desktop\R3F Repo\IphoneAnimation-live\IphoneAnimation\studio'
git fetch origin
git switch studio/visual-instruments-poc
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:5173/ . Node must be >=22.13.0.
If the local branch already exists, use `git pull --ff-only origin studio/visual-instruments-poc` after switching.

Five-minute test:
1. Examples → Olympic editorial. Focus artboard. Select Coast, bypass Parallax Window, restore it and change Depth. Select Headline and try Soft Rise. Preview and scroll both ways.
2. Click the A Desktop title, then Ctrl & D. Change the new variant; compare using Fit All. Undo.
3. Examples → iGlass. Scrub Story, change Product size, observe headline clearance. Drag to orbit, release, then change glass separation and glint.
4. Select Reveal, change the pose or text endpoint, then scrub the resulting transition. Drag the Story Beat end handle.
5. Export intent. Unzip it and serve the folder with `python -m http.server 8080`; open http://127.0.0.1:8080/ . Compare its replay and captured storyboard.

Test suites:
```powershell
npm test
npx playwright install chromium
npm run test:browser
npm run demo:poc
```
