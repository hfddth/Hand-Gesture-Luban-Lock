# Shadow Art V10 integration

Adapted from the user's `Shadow_Art_V10_手势识别与真实轮廓修复版.zip` and `shadow-lab (4)(1).html`. Both HTML inputs were identical (SHA-256 `129c043a65220731023529f109479c8a344f684498f1d6374a04f40d7df09e2b`). Original files remain in `imports/shadow-v80/`; the game loads only the adapted modules.

## Preserved processing

- Three seconds of continuous empty-background sampling, mean RGB and luminance variance.
- Weighted background difference, adaptive noise margin, optional hand-area and sampled skin-chroma assistance.
- Small-neighborhood cleanup, local hole repair, asymmetric temporal smoothing, and connected foreground components.
- Up to two hands; overlapping hands remain a single real foreground silhouette.
- Body/object exclusion rectangles with confirmed hand-region override.
- MediaPipe Hands assists localization only: final silhouette pixels come from the video image, not landmark strokes.
- Hand assistance uses the supplied `.48` detection and `.47` tracking confidence, complexity 1, two-hand setting. Runtime version is pinned to `0.4.1675469240`.

## Game adaptation

- Process a mirrored, aspect-preserving center crop at 320×240; use the same frame for hand localization and pixel segmentation.
- Default square hand workspace maps into the existing 128×128 matching mask. Projection zoom is adjustable without replacing the player's silhouette with a preset.
- Match the current level's target using the existing overlap score, threshold and two-second continuous hold. Calibration, empty video, paused dialogs and stale frames cannot accumulate progress.
- Preserve the ten existing targets, hints, artwork, saved completion and demo separation. Demo completion never records a real clear.
- Add in-frame background capture, capture progress, region/exclusion editing, tolerance/repair/skin/zoom controls, disconnect and permission failure handling.
- Keep PC proportions for landscape mobile. No separate portrait game layout.
- Segmentation and matching run in the browser. No captured video is uploaded by these modules. First use of the optional hand model needs network access; pure background subtraction remains available if it cannot load.

## Verification

`scripts/test-shadow-camera-v86.cjs` checks segmentation, two foreground regions, exclusions, guided override, temporal clearing, calibration, a synthetic video stream through the actual camera processing loop, continuous matching and unlock, permission denial, model loading failure, disconnect and landscape display. This is automated synthetic-input validation, not a physical webcam usability trial.

`scripts/test-shadow-v59.cjs` checks all ten level assets, matching and hold rules, demo separation, completion saving, hints, artwork and landscape UI.
