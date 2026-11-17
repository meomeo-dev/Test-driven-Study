---
id: 0054
type: fix
status: closed
closed-by: 7c25ba68b770a091648285de74a9b179ae3a466a
labels: []
branch: fix/0054-redraw-elementary-chinese-question-illustrations
created: 2026-11-17
---
# Redraw elementary Chinese question illustrations

## 背景 / 目标

The cropped source illustrations in the first-grade pinyin worksheet are hard
to distinguish at practice size. Redraw them in a consistent color textbook style.

## 关键功能清单（Key Feature List，KFL）

- Twelve color illustrations for the same objects and actions as the worksheet.
- One versioned course update used by study, practice and new mock exam papers.

## 改造面

Elementary Chinese course images and manifest. The source drawings are tracked
in the previous package revision, referenced by [issue #53](0053-feat-add-elementary-chinese-pinyin-worksheet.md).

## 非目标

Question wording, choices, answer keys, lesson content and shared workspace changes.

## 验收标准（Acceptance Criteria，AC）

- Every illustrated item resolves to its matching, legible, unlabelled color image.
- The installed course uses the new images with stable item IDs and preserved
  learning records. Previously installed course revisions remain readable.

## 讨论

Use the cropped question illustrations as references for composition and meaning.
Assess new images at both ordinary practice size and the enlarged size.

## Illustration prompts

The built-in ImageGen tool used the corresponding 1.0.0 crop as the edit target
for each image. Each request combined the following shared prompt and one
subject line.

```text
Use case: style-transfer. Redraw the attached small printed exercise illustration as one sharp full-color spot illustration for a first-grade Mandarin pinyin textbook. Use clean hand-drawn contours, softly shaded colored-pencil and opaque gouache fills, warm cheerful natural colors, smooth white (#FFFFFF) paper background. Make a compact centered square composition with the complete silhouette, substantial visual scale and generous blank white margins. The picture must read immediately at small size. Draw only this one prompt's clearly identifiable subject and its necessary visual cues. No labels, words, letters, pinyin, answer marks, borders, mockups, or watermarks. Avoid photographic or glossy 3-D rendering.
```

- `thunderstorm`

  Subject: A single rounded slate-blue storm cloud, bright diagonal yellow lightning and
  several blue rain streaks underneath. Keep rain and lightning equally easy to see. Use
  a simple standalone weather vignette.
- `scarf`

  Subject: One warm striped red-and-golden knitted winter scarf laid out in a loose
  inverted U, folded once at the top with two long flat ends and visible tassels.
  Clearly a scarf, without a wearer.
- `folding-clothes`

  Subject: Two first-grade children at a low cream table visibly folding clothes. Show
  one child bringing one side of a bright blue long-sleeve shirt inward with both hands,
  and a small tidy stack of folded garments beside it. Make the folding action
  unmistakable.
- `watering-can`

  Subject: One garden watering can with recognizable rounded turquoise body, a curved
  handle, long upward angled spout and round perforated sprinkler rose. Show it clearly
  in side view on its own.
- `willow`

  Subject: A single green weeping willow with a gently curved brown trunk and a broad
  canopy of long, fine green leafy branches visibly hanging almost to the ground. Keep
  the full tree in the frame.
- `blowing-balloon`

  Subject: One young child in a simple yellow top in profile, lips clearly on the neck
  of a partially inflated coral-red party balloon. Both hands are gently holding the
  balloon neck while blowing, cheeks a little puffed. Keep the balloon visually
  unmistakable.
- `door`

  Subject: One complete closed blue classroom door, face-on, with a simple frame, small
  rectangular glass window in the upper portion and a round brass knob. Show the whole
  door from lintel to threshold, isolated.
- `butterfly`

  Subject: One orange and yellow butterfly front view, with symmetrical open wings,
  simple small dark spots and two curly antennae. Preserve the open-wing silhouette in
  the source.
- `scissors`

  Subject: One pair of small classroom craft scissors with teal oval finger loops,
  realistic two short blunt silver blades slightly open, pivot clearly visible, arranged
  diagonally. Isolated object.
- `bed`

  Subject: One cozy single wooden bed in three-quarter view, with a rounded wooden
  headboard, white pillow and folded-back sky-blue quilt. Keep all legs and the full
  length of the bed visible.
- `spring-festival`

  Subject: One smiling child in a red Chinese New Year jacket with gold trim, holding a
  traditional red round lantern with a golden tassel. Add a tiny pair of red festival
  firecracker decorations as an additional Spring Festival cue. Keep this as one simple
  vignette on blank white. The lantern and all decoration surfaces are free of written
  characters.
- `dancing`

  Subject: One cheerful child in a light lilac dance skirt, turning mid-dance with arms
  gracefully curved outward and one pointed foot raised. Add two small curved motion
  strokes near the skirt to show a twirl. Keep the full dancer visible.
