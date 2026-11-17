---
id: 0006
type: fix
status: closed
closed-by: 6e291c0
labels: []
branch: fix/0006-recover-missing-original-question-images
created: 2026-11-01
---
# Recover missing original question images

## 背景 / 目标

Question 160034 references 202309141.jpg, which is absent locally while the
mobile application displays it. All 1434 bundled images match the source by
filename and SHA-256. None of the 135 missing references exists elsewhere in
the 3969-file extracted source directory. The original application contains
https://img3.drivedu.com.cn/ as its image base URL. The referenced image is
publicly available there and depicts the expected original road sign.

## 关键功能清单（Key Feature List，KFL）

- Recover available referenced images from the original image server.
- Require an explicit proxy for subsequent downloads, with no direct fallback.
- Keep bundled assets, original question data, and migration baseline intact.
- Record recovery URLs, HTTP metadata, byte lengths, and SHA-256 checksums.
- Verify source-copy integrity separately from supplemental recovered assets.
- Display recovered images locally; describe any remaining local gaps accurately.

## 改造面

- assets/img/ and data/ supplemental recovery/integrity records.
- web/src/features/memorization/QuestionImage.tsx and browser acceptance.
- README.md, docs/data/, and existing migration checker under /tmp/.

## 非目标

Replacing original pictures with generated/guessed images, modifying original
questions or answers, accessing mobile user accounts, external uploads,
background runtime downloads, new dependencies, and linked worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: All 1434 bundled image names, bytes, and hashes remain identical.
- AC2: Successful recovery records identify exact original filenames and URLs.
- AC3: Recovered bytes match their manifest hashes and decode as images.
- AC4: Question 160034 reports image_available=true and renders its real image.
- AC5: Remaining missing references are enumerated; no recovery result is
  misrepresented as a source-directory copy.
- AC6: Missing versus failed-loading UI copy reflects local availability.
- AC7: Migration and supplement integrity checks, browser workflows, and
  production build pass without modifying personal study progress.

## 讨论

The source directory is an extracted installation package, not the mobile
application's downloaded cache. Original image URLs are read from the local
application package; no source code or credentials are sent to an external
service. Implementation and commits remain on main.

Acceptance: recovered all 135 original images through the dedicated explicit
proxy; all re-fetched hashes match the first copies. All 1434 bundled source
images remain byte-identical, and all 1359 referenced filenames are local.
The independent checker passes 10 integrity gates; all 135 recovered files
decode, 8 frontend tests pass, strict types/production builds pass, and all 19
browser workflows pass. Question 160034 renders the restored original locally.
The temporary proxy is stopped and its private configuration removed.
