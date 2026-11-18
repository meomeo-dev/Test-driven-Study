# Curriculum Question Types Specification (v2)

Implementation and authoring guidance: [V2 question types](README.md).

This document specifies the data contracts, JSON schemas, grading mechanisms, and
storage projection rules for extending the four existing question types with
five new types. The revised true/false contract keeps its original type ID.

---

## 1. Baseline Architecture and Problem Statement

### 1.1 Existing System Topology
The platform's current question system is defined by three tightly coupled components:
1. **Course Package Schema (`contracts/course/v1/items.schema.json`)**:
   Restricted to 4 basic types: `["single_choice", "multiple_choice", "true_false", "numeric"]`.
   Stems are flat strings; audio is a single optional global track; options are flat arrays.
2. **Storage and Projection (`internal/storage/`)**:
   `course_items` stores the raw item definition in `payload_json` (TEXT). The projection
   function `projectQuestion` (`internal/storage/workspace.go`) maps items to legacy integer
   kinds (1: SingleChoice, 2: MultipleChoice, 3: TrueFalse, 4: Numeric).
3. **Grading Engine (`internal/course/grading.go`, `internal/study/answers.go`)**:
   Evaluates choices by exact integer ID matching and numeric values with absolute tolerance.

### 1.2 Motivation for v2 Extension
Vocational and academic English curricula (such as the `step-up-english-1` demo)
require complex evaluation formats that cannot be modeled by simple isolated multiple-choice
options:
- **Declarative Rich Content / Mixed Inline TTS**: Stems and options can be defined as
  arrays of structured segment objects (`ContentSegment[]`) or simple strings. Any
  segment or option declaring `"tts"` renders playback controls; segments without `"tts"`
  render as plain text. This eliminates fragile regex parsing and prevents reading out
  blanks.
- **Cloze (完形填空)**: Contextual passages with multiple embedded blanks requiring independent
  lexical or grammatical selection.
- **True/False with Analysis (判断题)**: Statements requiring a boolean judgment coupled with
  detailed pedagogical rationale.
- **Listening (听力题)**: Multi-speaker dialogues (`M: ...`, `W: ...`) or recorded technical
  briefings paired with sequential comprehension questions.
- **Reading Comprehension (阅读理解)**: Long authentic technical passages paired with multiple
  sub-questions of varying types.
- **Writing (写作题)**: Sentence construction (`sentence_making`), workplace notices/emails
  (`short_essay`), and argumentative/technical essays (`full_essay`) evaluated via rubrics
  and keyword checkpoints.
- **Translation (翻译题)**: Workplace and technical bidirectional translation (`en_to_zh`,
  `zh_to_en`) with reference answers, acceptable synonym variants, and key terms.

---

## 2. Design Principles and Non-Breaking Storage Architecture

1. **Declarative Rich Content (Array + Object Schema)**:
   Any textual content (`stem`, `passage`, `analysis`) supports polymorphic typing:
   `string | ContentSegment[]`. When defined as an array of objects, content segments
   explicitly declare TTS capability, styling, or blank placeholders.
2. **Zero-Schema Breaking SQLite Persistence**:
   Both `course_items.payload_json` and `answer_attempts.selected_json` are SQLite `TEXT`
   fields storing serialized JSON. Introducing new payload attributes requires **zero DDL
   migrations** and leaves the 2,177 existing production items completely unaffected.
3. **Graceful Workspace Projection**:
   The runtime projection layer maps legacy items to their existing presentation while
   passing extended payloads (`sub_items`, `blanks`, `rubrics`, `content`) through to
   modern React components (`RichContent`, `ClozeQuestionCard`, `ListeningQuestionCard`,
   `WritingQuestionCard`, etc.).

---

## 3. Rich Content Data Contract and In-Line TTS Architecture

### 3.1 Content Segment Schema
```typescript
export interface TTSConfig {
  voice?: 'stella' | 'tide';
  text?: string;        // Spoken text override (if different from visual text)
  speed?: number;       // Playback rate factor (default 1.0)
}

export interface ContentSegment {
  type: 'text' | 'speech' | 'blank';
  text?: string;
  tts?: boolean | TTSConfig;
  index?: number;       // Used when type === 'blank'
}

export type RichContent = string | ContentSegment[];
```

### 3.2 Option Data Contract with Speech Support
```typescript
export interface CourseOption {
  id: string;
  text: string;
  value?: boolean;
  tts?: boolean | TTSConfig;
}
```

### 3.3 Option-Level Anti-Leakage Uniformity Rule (防剧透一致性法则)
To prevent learner answer leakage ("spoiler"), option-level TTS must be applied uniformly:
- **Rule**: If any option in a multiple-choice question or cloze blank specifies `tts`,
  **ALL options in that question (or blank) MUST uniformly provide TTS**.
- Enabling audio exclusively on the correct answer allows learners to determine the
  correct choice simply by inspecting which option renders speaker buttons, destroying
  pedagogical validity.

---

## 4. New Question Types and the Revised True/False Contract

### 4.1 Cloze (完形填空, `cloze`)
- **Structure**: A passage defined as plain text with `{{1}}`, `{{2}}` markers or an array
  of segments mixing text and blank objects (`{ "type": "blank", "index": 1 }`).
  Each blank references an entry with isolated options, answer grading, and explanation.
- **Data Contract**:
  ```json
  {
    "id": "item-eng-cloze-001",
    "type": "cloze",
    "stem": "Read the factory safety memo and choose the best word for each blank.",
    "passage": [
      { "type": "text", "text": "All technicians must wear protective " },
      { "type": "blank", "index": 1 },
      { "type": "text", "text": " before entering the workshop. If an alarm sounds, immediately shut " },
      { "type": "blank", "index": 2 },
      { "type": "text", "text": " the main power." }
    ],
    "blanks": [
      {
        "index": 1,
        "options": [
          {"id": "a", "text": "gear", "tts": true},
          {"id": "b", "text": "books", "tts": true},
          {"id": "c", "text": "tickets", "tts": true},
          {"id": "d", "text": "watches", "tts": true}
        ],
        "grading": { "choice_ids": ["a"] },
        "explanation": "Protective gear (防护装备) is the standard industrial safety term."
      },
      {
        "index": 2,
        "options": [
          {"id": "a", "text": "up", "tts": true},
          {"id": "b", "text": "down", "tts": true},
          {"id": "c", "text": "off", "tts": true},
          {"id": "d", "text": "in", "tts": true}
        ],
        "grading": { "choice_ids": ["b"] },
        "explanation": "Shut down (关闭设备/电源) is the correct phrasal verb."
      }
    ]
  }
  ```

### 4.2 True/False with Analysis (判断题, `true_false`)
- **Structure**: A statement evaluated as true or false, accompanied by mandatory
  linguistic or technical rationale.
- **Data Contract**:
  ```json
  {
    "id": "item-eng-tf-001",
    "type": "true_false",
    "stem": "The third-person singular form of the verb 'watch' is 'watchs'.",
    "grading": { "value": false },
    "analysis": "Verbs ending in sibilant sounds (-ch, -sh, -s, -x, -z) take '-es' in the third-person singular. The correct form is 'watches' /wɒtʃɪz/."
  }
  ```

### 4.3 Listening Comprehension (听力题, `listening`)
- **Structure**: Contains audio metadata, a structured multi-speaker transcript or passage,
  and one or more sub-questions. Each line in the transcript declares its speaker and
  voice config directly.
- **Data Contract**:
  ```json
  {
    "id": "item-eng-list-001",
    "type": "listening",
    "stem": "Listen to the conversation between an engineer and a technician, then answer the questions.",
    "audio": {
      "mode": "dialogue",
      "voice_male": "tide",
      "voice_female": "stella"
    },
    "transcript": [
      {
        "speaker": "M",
        "text": "Excuse me, where can I find the replacement fuses for Machine 4?",
        "tts": { "voice": "tide" }
      },
      {
        "speaker": "W",
        "text": "They are stored in Cabinet B on the second shelf, right next to the multimeter.",
        "tts": { "voice": "stella" }
      },
      {
        "speaker": "M",
        "text": "Thanks! Do I need a supervisor sign-off before taking one?",
        "tts": { "voice": "tide" }
      },
      {
        "speaker": "W",
        "text": "No sign-off is needed for standard fuses, but remember to log it on the clipboard.",
        "tts": { "voice": "stella" }
      }
    ],
    "sub_questions": [
      {
        "id": "sq-1",
        "type": "single_choice",
        "stem": "Where are the replacement fuses located?",
        "options": [
          {"id": "a", "text": "In Cabinet A on the top shelf"},
          {"id": "b", "text": "In Cabinet B on the second shelf"},
          {"id": "c", "text": "Under the workbench"},
          {"id": "d", "text": "In the supervisor's office"}
        ],
        "grading": { "choice_ids": ["b"] },
        "explanation": "The technician explicitly states: 'Cabinet B on the second shelf'."
      },
      {
        "id": "sq-2",
        "type": "true_false",
        "stem": "The engineer must obtain a supervisor sign-off before taking a fuse.",
        "grading": { "value": false },
        "analysis": "The technician clarifies that no sign-off is needed, although logging on the clipboard is required."
      }
    ]
  }
  ```

### 4.4 Reading Comprehension (阅读理解, `reading_comprehension`)
- **Structure**: A technical passage or authentic document paired with multiple sub-questions.
- **Data Contract**:
  ```json
  {
    "id": "item-eng-read-001",
    "type": "reading_comprehension",
    "stem": "Read the standard operating procedure (SOP) below and answer the questions.",
    "passage": "EMERGENCY SHUTDOWN PROCEDURE\n1. In the event of hydraulic pressure loss exceeding 15%, immediately press the red EMERGENCY STOP pushbutton located on the control console.\n2. Do NOT attempt to restart the motor until an authorized safety officer has inspected the pressure relief valve.\n3. Log the incident in the shift handover report within 30 minutes of occurrence.",
    "sub_questions": [
      {
        "id": "sq-1",
        "type": "single_choice",
        "stem": "What pressure loss threshold triggers the emergency stop?",
        "options": [
          {"id": "a", "text": "5%"},
          {"id": "b", "text": "10%"},
          {"id": "c", "text": "15%"},
          {"id": "d", "text": "20%"}
        ],
        "grading": { "choice_ids": ["c"] },
        "explanation": "Section 1 states: 'hydraulic pressure loss exceeding 15%'."
      }
    ]
  }
  ```

### 4.5 Writing (写作题, `writing`)
- **Structure**: Divided into `sentence_making` (造句), `short_essay` (小作文), and
  `full_essay` (大作文). Graded against rubric dimensions, reference sample responses,
  and keyword checkpoints.
- **Data Contract**:
  ```json
  {
    "id": "item-eng-write-001",
    "type": "writing",
    "subtype": "short_essay",
    "stem": "You are a quality inspector. Write an email to Mr. Zhang notifying him of a shipment delay due to a packaging defect. (80-120 words)",
    "requirements": [
      "State the reason for the delay clearly.",
      "Provide the revised delivery schedule (Friday, 3 PM).",
      "Offer an apology for the inconvenience."
    ],
    "keywords": ["shipment", "delay", "packaging defect", "rescheduled", "apologize"],
    "min_words": 80,
    "max_words": 120,
    "sample_response": "Dear Mr. Zhang,\n\nI am writing to inform you that shipment #4092 will be delayed due to a minor packaging defect detected during final inspection. To ensure product integrity, the items are being repacked.\n\nThe revised shipment is rescheduled for delivery this Friday at 3:00 PM. We sincerely apologize for any inconvenience this may cause to your production timeline.\n\nBest regards,\nQuality Assurance Team",
    "rubric": {
      "task_completion": 40,
      "language_accuracy": 30,
      "coherence": 30
    }
  }
  ```

### 4.6 Translation (翻译题, `translation`)
- **Structure**: Bidirectional translation (`en_to_zh` or `zh_to_en`) of workplace
  statements or technical directives. Includes reference translation, acceptable variant
  renderings, and key terms.
- **Data Contract**:
  ```json
  {
    "id": "item-eng-trans-001",
    "type": "translation",
    "direction": "zh_to_en",
    "stem": "将下列生产车间安全指令翻译成英文：",
    "source_text": "在未切断主电源之前，严禁打开设备检修门。",
    "reference_translation": "It is strictly prohibited to open the equipment maintenance door before turning off the main power.",
    "acceptable_alternates": [
      "Do not open the machine maintenance door until the main power supply has been shut off.",
      "Opening the service door is strictly forbidden before disconnecting the main power."
    ],
    "key_terms": [
      {"term": "strictly prohibited", "variants": ["strictly forbidden", "not allowed"]},
      {"term": "main power", "variants": ["main power supply", "master power"]},
      {"term": "maintenance door", "variants": ["service door", "access panel"]}
    ],
    "explanation": "'It is strictly prohibited to do sth' 是工业安全规范中标准的警示句型。"
  }
  ```

---

## 5. Formal JSON Schema Definitions

The [v2 item schema](../../../contracts/course/v2/items.schema.json) reuses
common definitions from v1. The following excerpt describes the shared
content structures:

```json
{
  "$defs": {
    "RichContent": {
      "oneOf": [
        { "type": "string" },
        {
          "type": "array",
          "items": { "$ref": "#/$defs/ContentSegment" }
        }
      ]
    },
    "ContentSegment": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": { "type": "string", "enum": ["text", "speech", "blank"] },
        "text": { "type": "string" },
        "tts": {
          "oneOf": [
            { "type": "boolean" },
            { "$ref": "#/$defs/TTSConfig" }
          ]
        },
        "index": { "type": "integer" }
      }
    },
    "TTSConfig": {
      "type": "object",
      "properties": {
        "voice": { "type": "string", "enum": ["stella", "tide"] },
        "text": { "type": "string" },
        "speed": { "type": "number", "minimum": 0.5, "maximum": 2.0 }
      }
    },
    "ClozeBlank": {
      "type": "object",
      "required": ["index", "options", "grading"],
      "properties": {
        "index": { "type": "integer", "minimum": 1 },
        "options": {
          "type": "array",
          "minItems": 2,
          "items": { "$ref": "#/$defs/Option" }
        },
        "grading": { "$ref": "#/$defs/ChoiceGrading" },
        "explanation": { "type": "string" }
      }
    },
    "TranscriptLine": {
      "type": "object",
      "required": ["speaker", "text"],
      "properties": {
        "speaker": { "type": "string" },
        "text": { "type": "string" },
        "tts": {
          "oneOf": [
            { "type": "boolean" },
            { "$ref": "#/$defs/TTSConfig" }
          ]
        }
      }
    }
  }
}
```

---

## 6. Grading Engine and Attempt Payload Contracts

### 6.1 Answer Attempt Payload (`selected_json`)
Polymorphic attempt structures persisted in SQLite `answer_attempts.selected_json`:

- **Cloze**: `{ "blanks": { "1": ["a"], "2": ["b"] } }`
- **True/False**: `{ "value": false }`
- **Listening / Reading Sub-questions**: `{ "sub_answers": { "sq-1": ["b"], "sq-2": false } }`
- **Writing**: `{ "text": "Dear Mr. Zhang,\nI am writing to inform you...", "word_count": 86 }`
- **Translation**: `{ "translation": "It is strictly prohibited to open the equipment maintenance door..." }`

### 6.2 Go Grading Engine Specification (`internal/course/grading.go`)
1. **Cloze Evaluation**: Iterates over all blanks. An attempt is fully correct if all
   blanks match their respective `choice_ids`. Partial credit score is calculated as
   `matched_blanks / total_blanks`.
2. **True/False Evaluation**: Strict boolean equality between `attempt.Value` and
   `grading.Value`.
3. **Compound Questions (Listening & Reading)**: Evaluates each sub-question through its
   standard type grader (`GradeSingleChoice`, `GradeTrueFalse`). Aggregates points
   proportionally.
4. **Writing & Translation Evaluation**:
   - Validates word count constraints (`min_words <= words <= max_words`) and verifies
     presence of required `key_terms` via normalized fuzzy string matching.
   - When LLM service is enabled, dispatches the prompt, rubric, sample response, and
     learner submission to the LLM evaluator for detailed rubric scoring.

---

## 7. Ten Production-Grade Golden Samples for `step-up-english`

```json
[
  {
    "id": "item-sue1-sc-mixed-001",
    "type": "single_choice",
    "stem": [
      { "type": "text", "text": "在装配线工作时，机器突然发生故障，工友大声对你说：" },
      { "type": "text", "text": "Stop!", "tts": { "voice": "tide" } },
      { "type": "text", "text": " 此时你应该：" }
    ],
    "options": [
      { "id": "a", "text": "立即按下红色急停按钮并停止操作" },
      { "id": "b", "text": "继续操作并等待班长到来" },
      { "id": "c", "text": "关掉车间总照明灯" },
      { "id": "d", "text": "大声向工友回复无需惊慌" }
    ],
    "grading": { "choice_ids": ["a"] },
    "explanation": "'Stop!' 是最高优先级的紧急指令，应立即按下急停按钮。"
  },
  {
    "id": "item-sue1-sc-tts-opt-002",
    "type": "single_choice",
    "stem": "工人向维修工汇报车间照明指示灯故障时，最地道规范的英文表达是：",
    "options": [
      { "id": "a", "text": "The light doesn't work.", "tts": { "voice": "stella" } },
      { "id": "b", "text": "The light is dead person.", "tts": { "voice": "stella" } },
      { "id": "c", "text": "No light working now.", "tts": { "voice": "stella" } },
      { "id": "d", "text": "The light loses power heart.", "tts": { "voice": "stella" } }
    ],
    "grading": { "choice_ids": ["a"] },
    "explanation": "'The light doesn't work' 是描述机器或灯具故障的标准口语表达。全部选项统一提供 TTS，防止视觉差异泄露答案。"
  },
  {
    "id": "item-sue1-sc-grammar-003",
    "type": "single_choice",
    "stem": [
      { "type": "text", "text": "在车间向同事介绍自己的家乡时，想表达“我来自云南”，横线处应填入哪个介词？\n" },
      { "type": "text", "text": "I am ___ Yunnan." }
    ],
    "options": [
      { "id": "a", "text": "from" },
      { "id": "b", "text": "at" },
      { "id": "c", "text": "in" },
      { "id": "d", "text": "on" }
    ],
    "grading": { "choice_ids": ["a"] },
    "explanation": "'be from + 地名' 表示'来自某地'。此处无 TTS 声明，纯文本展示。"
  },
  {
    "id": "item-sue1-cloze-001",
    "type": "cloze",
    "stem": "Complete the warehouse inventory guideline.",
    "passage": [
      { "type": "text", "text": "Before operating the electric forklift, every worker " },
      { "type": "blank", "index": 1 },
      { "type": "text", "text": " inspect the tire pressure and battery level. If you discover any defect, do not " },
      { "type": "blank", "index": 2 },
      { "type": "text", "text": " the machine." }
    ],
    "blanks": [
      {
        "index": 1,
        "options": [
          {"id": "a", "text": "must", "tts": true},
          {"id": "b", "text": "can't", "tts": true},
          {"id": "c", "text": "may not", "tts": true},
          {"id": "d", "text": "used to", "tts": true}
        ],
        "grading": { "choice_ids": ["a"] },
        "explanation": "'Must' expresses mandatory obligation in operating guidelines."
      },
      {
        "index": 2,
        "options": [
          {"id": "a", "text": "start", "tts": true},
          {"id": "b", "text": "starting", "tts": true},
          {"id": "c", "text": "started", "tts": true},
          {"id": "d", "text": "starts", "tts": true}
        ],
        "grading": { "choice_ids": ["a"] },
        "explanation": "After auxiliary verb 'do not', use the base verb form 'start'."
      }
    ]
  },
  {
    "id": "item-sue1-tf-001",
    "type": "true_false",
    "stem": "The word 'equipment' can be pluralized into 'equipments' when referring to multiple devices.",
    "grading": { "value": false },
    "analysis": "'Equipment' is an uncountable noun in standard English. To indicate multiple items, use 'pieces of equipment' or 'devices'."
  },
  {
    "id": "item-sue1-tf-002",
    "type": "true_false",
    "stem": "In the sentence 'She checks the gauge every morning', 'checks' is the third-person singular present form.",
    "grading": { "value": true },
    "analysis": "The subject 'She' is third-person singular, so the base verb 'check' takes suffix '-s'."
  },
  {
    "id": "item-sue1-list-001",
    "type": "listening",
    "stem": "Listen to the shift handover dialogue and answer the question.",
    "transcript": [
      { "speaker": "W", "text": "Has Batch 204 passed the tolerance check?", "tts": { "voice": "stella" } },
      { "speaker": "M", "text": "Yes, all 50 units met the 0.02 mm specification. They are ready for packaging.", "tts": { "voice": "tide" } }
    ],
    "sub_questions": [
      {
        "id": "sq-1",
        "type": "single_choice",
        "stem": "How many units were checked in Batch 204?",
        "options": [
          {"id": "a", "text": "20 units"},
          {"id": "b", "text": "50 units"},
          {"id": "c", "text": "204 units"},
          {"id": "d", "text": "500 units"}
        ],
        "grading": { "choice_ids": ["b"] },
        "explanation": "The speaker confirms 'all 50 units met the specification'."
      }
    ]
  },
  {
    "id": "item-sue1-read-001",
    "type": "reading_comprehension",
    "stem": "Read the workplace notice and answer the question.",
    "passage": "NOTICE: Digital Caliper Calibration\nAll digital calipers in Sector C must undergo monthly recalibration by the QA Department on the first Monday of each month. Operators who use uncalibrated instruments after the grace period of 24 hours will face inspection disqualification.",
    "sub_questions": [
      {
        "id": "sq-1",
        "type": "single_choice",
        "stem": "How long is the grace period for caliper recalibration?",
        "options": [
          {"id": "a", "text": "12 hours"},
          {"id": "b", "text": "24 hours"},
          {"id": "c", "text": "48 hours"},
          {"id": "d", "text": "One week"}
        ],
        "grading": { "choice_ids": ["b"] },
        "explanation": "The text states: 'after the grace period of 24 hours'."
      }
    ]
  },
  {
    "id": "item-sue1-write-001",
    "type": "writing",
    "subtype": "sentence_making",
    "stem": "Use the words 'safety switch', 'emergency', and 'press' to make a complete instructional sentence.",
    "requirements": ["Must contain all three prompt words.", "Must be grammatically correct."],
    "keywords": ["safety switch", "emergency", "press"],
    "sample_response": "Press the safety switch immediately in case of an emergency.",
    "rubric": { "grammar": 50, "keyword_usage": 50 }
  },
  {
    "id": "item-sue1-trans-001",
    "type": "translation",
    "direction": "zh_to_en",
    "stem": "请将下列操作规范翻译为英文：",
    "source_text": "在未切断主电源之前，严禁打开设备检修门。",
    "reference_translation": "It is strictly prohibited to open the equipment maintenance door before turning off the main power.",
    "acceptable_alternates": [
      "Do not open the machine maintenance door until the main power supply has been shut off.",
      "Opening the service door is strictly forbidden before disconnecting the main power."
    ],
    "key_terms": [
      {"term": "strictly prohibited", "variants": ["strictly forbidden", "not allowed"]},
      {"term": "main power", "variants": ["main power supply", "master power"]},
      {"term": "maintenance door", "variants": ["service door", "access panel"]}
    ],
    "explanation": "'emergency stop button' 是工业设备标准术语，'make sure to check' 表达'务必检查'。"
  }
]
```
