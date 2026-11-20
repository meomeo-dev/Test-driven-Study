# English vocabulary notebook

The memorization toolbar offers **生词本** for an installed course version with
a declared word list. Learners can browse the displayed question, the current
unit, or the whole course, and can search in English or Chinese.

## Author a word list

Add `"vocabulary_file": "assets/vocabulary/english.json"` to the v2 course
manifest. The field enables the notebook for that course version. The manifest
`language` field can continue to describe the presentation language.
The asset is a nonempty array validated by the
[vocabulary schema](../../../contracts/course/v2/vocabulary.schema.json).

```json
[
  {
    "id": "visitor-badge",
    "unit_id": "extended-practice",
    "term": "visitor badge",
    "meaning": "访客证",
    "category": "word_group",
    "question_ids": ["sue1-extended-reading"],
    "term_tts": {"voice": "stella"},
    "example": "Please wear your visitor badge in the workshop.",
    "example_translation": "在车间里请佩戴访客证。",
    "example_tts": {"voice": "stella"}
  }
]
```

Use one unique slug per entry within the course. `unit_id` refers to a declared
unit. Optional `question_ids` use original question IDs from that unit. Add
`example` and `example_translation` together when including an example.
Keep entries useful for study and keep grading answers in the question bank.

Optional audio and grammar fields:

- `term_tts` and `example_tts` accept a `TTSConfig` object (`voice`, `text`,
  `speed`). `example_tts` requires `example`. Use `text` overrides when the
  displayed string contains placeholders such as `…` or non-speakable text.
- `pos` accepts `n`, `v`, `adj`, `adv`, `prep`, `pron`, `num`, `conj`, or
  `interj`. Prefer setting `pos` on `word` entries when helpful, and omit it
  when `category` already conveys the structural role.
- `grammar_note` is a concise Chinese usage or morphology note (up to 120
  characters, non-whitespace). Keep it minimalist and omit it when no
  non-obvious rule applies.

| Category | Display label |
| --- | --- |
| `word` | 词 |
| `word_group` | 词组 |
| `phrase` | 短语 |
| `collocation` | 固定搭配 |
| `idiom` | 习语／惯用语 |
| `function_phrase` | 介词／功能短语 |

Increment the package version when changing the word list. Validate and
install through the standard [course workflow](../../../README.md#author-a-course).
The package stores the vocabulary asset with its version and serves it via the
installed course asset route.
