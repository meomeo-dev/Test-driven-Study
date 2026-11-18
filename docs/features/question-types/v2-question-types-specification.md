# Curriculum Question Types Specification (v2)

This document specifies the data contracts, JSON schemas, grading mechanisms, and
storage projection rules for extending curriculum question types from the existing 4
basic types to a comprehensive 10-type system.

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
Vocational and academic English curricula (such as `step-up-english-1` and `step-up-english-2`)
require complex evaluation formats that cannot be modeled by simple isolated multiple-choice
options:
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

1. **Declarative JSON Schema Source of Truth**:
   The schema extension adheres to JSON Schema Draft 2020-12, enabling compile-time and
   pre-commit verification via `go run ./cmd/course check`.
2. **Zero-Schema Breaking SQLite Persistence**:
   Both `course_items.payload_json` and `answer_attempts.selected_json` are SQLite `TEXT`
   fields storing serialized JSON. Introducing new payload attributes requires **zero DDL
   migrations** and leaves the 2,177 existing production items completely unaffected.
3. **Graceful Workspace Projection**:
   The runtime projection layer maps legacy items to their existing presentation while
   passing extended payloads (`sub_items`, `blanks`, `rubrics`) through to modern React
   components (`ClozeQuestionCard`, `ListeningQuestionCard`, `WritingQuestionCard`, etc.).

---

## 3. The 6 New Question Types: Data Contracts and Schemas

### 3.1 Cloze (完形填空, `cloze`)
- **Structure**: A passage containing numbered placeholders formatted as `{{1}}`, `{{2}}`.
  Each placeholder references a blank entry with isolated options and grading.
- **Data Contract**:
  ```json
  {
    "id": "item-eng-cloze-001",
    "type": "cloze",
    "stem": "Read the factory safety memo and choose the best word for each blank.",
    "passage": "All technicians must wear protective {{1}} before entering the workshop. If an alarm sounds, immediately shut {{2}} the main power.",
    "blanks": [
      {
        "index": 1,
        "options": [
          {"id": "a", "text": "gear"},
          {"id": "b", "text": "books"},
          {"id": "c", "text": "tickets"},
          {"id": "d", "text": "watches"}
        ],
        "grading": { "choice_ids": ["a"] },
        "explanation": "Protective gear (防护装备) is the standard industrial safety term."
      },
      {
        "index": 2,
        "options": [
          {"id": "a", "text": "up"},
          {"id": "b", "text": "down"},
          {"id": "c", "text": "off"},
          {"id": "d", "text": "in"}
        ],
        "grading": { "choice_ids": ["b"] },
        "explanation": "Shut down (关闭设备/电源) is the correct phrasal verb."
      }
    ]
  }
  ```

### 3.2 True/False with Analysis (判断题, `true_false`)
- **Structure**: A single factual or interpretive statement evaluated as true or false,
  accompanied by mandatory linguistic or technical analysis.
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

### 3.3 Listening Comprehension (听力题, `listening`)
- **Structure**: Contains an audio source (or TTS-synthesizable script), a structured
  transcript with optional speaker tags (`M:`, `W:`), and one or more sub-questions.
- **Data Contract**:
  ```json
  {
    "id": "item-eng-list-001",
    "type": "listening",
    "stem": "Listen to the conversation between an engineer and a technician, then answer the questions.",
    "audio": {
      "mode": "dialogue",
      "voice_male": "tide",
      "voice_female": "stella",
      "track_url": "/api/audio/dialogues/item-eng-list-001.wav"
    },
    "transcript": [
      {"speaker": "M", "text": "Excuse me, where can I find the replacement fuses for Machine 4?"},
      {"speaker": "W", "text": "They are stored in Cabinet B on the second shelf, right next to the multimeter."},
      {"speaker": "M", "text": "Thanks! Do I need a supervisor sign-off before taking one?"},
      {"speaker": "W", "text": "No sign-off is needed for standard fuses, but remember to log it on the clipboard."}
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

### 3.4 Reading Comprehension (阅读理解, `reading_comprehension`)
- **Structure**: A long passage providing technical documentation, operating procedures,
  or professional correspondence, accompanied by multiple sub-questions.
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

### 3.5 Writing (写作题, `writing`)
- **Structure**: Divided into three distinct task scopes:
  1. `sentence_making`: Constructing a grammatically sound sentence using specified prompt
     words or syntactic patterns.
  2. `short_essay`: Composing an 80–120 word workplace note, notification, or email.
  3. `full_essay`: Composing a 150–200 word structured technical report or argumentative essay.
- **Evaluation Mechanism**: Graded against explicit rubric dimensions (task fulfillment,
  lexical range, grammatical accuracy, coherence) paired with reference sample texts and
  required keyword checkpoints.
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

### 3.6 Translation (翻译题, `translation`)
- **Structure**: Bidirectional translation (`en_to_zh` or `zh_to_en`) of authentic workplace
  statements or technical directives.
- **Evaluation Mechanism**: Evaluated against reference translations, acceptable variant
  renderings, and required technical terminology.
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

## 4. Formal JSON Schema Definitions

The schema additions are incorporated into `contracts/course/v1/items.schema.json`. Below
are the definitive definitions for the new types:

```json
{
  "$defs": {
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
    "DialogueLine": {
      "type": "object",
      "required": ["speaker", "text"],
      "properties": {
        "speaker": { "type": "string", "enum": ["M", "W", "Narrator"] },
        "text": { "type": "string", "minLength": 1 }
      }
    },
    "SubQuestion": {
      "type": "object",
      "required": ["id", "type", "stem", "grading"],
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string", "enum": ["single_choice", "multiple_choice", "true_false", "numeric"] },
        "stem": { "type": "string" },
        "options": {
          "type": "array",
          "items": { "$ref": "#/$defs/Option" }
        },
        "grading": { "type": "object" },
        "explanation": { "type": "string" }
      }
    }
  }
}
```

---

## 5. Grading Engine and Attempt Payload Contracts

### 5.1 Answer Attempt Payload (`selected_json`)
To store learner responses across the 6 new question types, `selected_json` in the
`answer_attempts` table is extended with polymorphic JSON payloads:

- **Cloze**:
  ```json
  { "blanks": { "1": ["a"], "2": ["b"] } }
  ```
- **True/False**:
  ```json
  { "value": false }
  ```
- **Listening / Reading Sub-questions**:
  ```json
  { "sub_answers": { "sq-1": ["b"], "sq-2": false } }
  ```
- **Writing**:
  ```json
  { "text": "Dear Mr. Zhang,\nI am writing to inform you...", "word_count": 86 }
  ```
- **Translation**:
  ```json
  { "translation": "It is strictly prohibited to open the equipment maintenance door before disconnecting the main power." }
  ```

### 5.2 Go Grading Engine Specification (`internal/course/grading.go`)
1. **Cloze Evaluation**: Iterates over all blanks. An attempt is fully correct if all
   blanks match their respective `choice_ids`. Partial credit score is calculated as
   `matched_blanks / total_blanks`.
2. **True/False Evaluation**: Strict boolean equality between `attempt.Value` and
   `grading.Value`.
3. **Compound Questions (Listening & Reading)**: Evaluates each sub-question through its
   standard type grader (`GradeSingleChoice`, `GradeTrueFalse`). Aggregates points
   proportionally.
4. **Writing & Translation Evaluation**:
   - **Automated Check**: Validates word count constraints (`min_words <= words <= max_words`)
     and verifies presence of required `key_terms` via normalized fuzzy string matching.
   - **Model-Assisted Grading**: When LLM service is enabled, dispatches the prompt,
     rubric, sample response, and learner submission to the LLM evaluator for detailed
     rubric scoring.

---

## 6. Ten Golden Sample Items for `step-up-english`

Below are 10 production-ready sample items demonstrating the 6 new question types:

```json
[
  {
    "id": "item-sue1-cloze-001",
    "type": "cloze",
    "stem": "Complete the warehouse inventory guideline.",
    "passage": "Before operating the electric forklift, every worker {{1}} inspect the tire pressure and battery level. If you discover any defect, do not {{2}} the machine.",
    "blanks": [
      {
        "index": 1,
        "options": [
          {"id": "a", "text": "must"},
          {"id": "b", "text": "can't"},
          {"id": "c", "text": "may not"},
          {"id": "d", "text": "used to"}
        ],
        "grading": { "choice_ids": ["a"] },
        "explanation": "'Must' expresses mandatory obligation in operating guidelines."
      },
      {
        "index": 2,
        "options": [
          {"id": "a", "text": "start"},
          {"id": "b", "text": "starting"},
          {"id": "c", "text": "started"},
          {"id": "d", "text": "starts"}
        ],
        "grading": { "choice_ids": ["a"] },
        "explanation": "After auxiliary verb 'do not', use the base verb form 'start'."
      }
    ]
  },
  {
    "id": "item-sue1-cloze-002",
    "type": "cloze",
    "stem": "Complete the email regarding maintenance schedule.",
    "passage": "Please note that the regular maintenance will take place {{1}} Wednesday afternoon. The main power will be off {{2}} two hours.",
    "blanks": [
      {
        "index": 1,
        "options": [
          {"id": "a", "text": "on"},
          {"id": "b", "text": "in"},
          {"id": "c", "text": "at"},
          {"id": "d", "text": "for"}
        ],
        "grading": { "choice_ids": ["a"] },
        "explanation": "Use preposition 'on' before specific days of the week."
      },
      {
        "index": 2,
        "options": [
          {"id": "a", "text": "for"},
          {"id": "b", "text": "since"},
          {"id": "c", "text": "during"},
          {"id": "d", "text": "at"}
        ],
        "grading": { "choice_ids": ["a"] },
        "explanation": "'For' indicates a duration of time (for two hours)."
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
    "stem": "Listen to the supervisor's instruction and answer the question.",
    "audio": { "mode": "monologue", "voice": "tide" },
    "transcript": [
      {"speaker": "Narrator", "text": "Attention all assembly line workers: please ensure your protective goggles are fastened before testing the soldering unit."}
    ],
    "sub_questions": [
      {
        "id": "sq-1",
        "type": "single_choice",
        "stem": "What equipment must workers fasten before testing?",
        "options": [
          {"id": "a", "text": "Protective goggles"},
          {"id": "b", "text": "Safety gloves"},
          {"id": "c", "text": "Earplugs"},
          {"id": "d", "text": "Hard hats"}
        ],
        "grading": { "choice_ids": ["a"] },
        "explanation": "The instruction specifically mandates 'protective goggles'."
      }
    ]
  },
  {
    "id": "item-sue1-list-002",
    "type": "listening",
    "stem": "Listen to the shift handover dialogue and answer the questions.",
    "audio": { "mode": "dialogue", "voice_male": "tide", "voice_female": "stella" },
    "transcript": [
      {"speaker": "W", "text": "Has Batch 204 passed the tolerance check?"},
      {"speaker": "M", "text": "Yes, all 50 units met the 0.02 mm specification. They are ready for packaging."}
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
    "id": "item-sue1-write-002",
    "type": "writing",
    "subtype": "short_essay",
    "stem": "Write a 50-80 word notification informing the team that Workshop Room 3 will be closed for floor maintenance this Friday.",
    "requirements": ["Mention Workshop Room 3.", "Mention the closing reason (floor maintenance).", "State the date (this Friday)."],
    "keywords": ["Workshop Room 3", "closed", "maintenance", "Friday"],
    "min_words": 50,
    "max_words": 80,
    "sample_response": "Notice to All Staff:\nPlease be advised that Workshop Room 3 will be closed all day this Friday for routine floor maintenance. All scheduled calibration sessions have been relocated to Room 5. Please ensure all personal tools are cleared from the area by Thursday evening.\n\nThank you for your cooperation.",
    "rubric": { "task_completion": 40, "clarity": 30, "grammar": 30 }
  },
  {
    "id": "item-sue1-trans-001",
    "type": "translation",
    "direction": "zh_to_en",
    "stem": "请将下列操作规范翻译为英文：",
    "source_text": "在开始工作之前，请务必检查急停按钮是否灵敏。",
    "reference_translation": "Before starting work, make sure to check whether the emergency stop button is responsive.",
    "acceptable_alternates": [
      "Always check if the emergency stop button is working properly before beginning operation.",
      "Be sure to inspect the emergency stop button for responsiveness before starting work."
    ],
    "key_terms": [
      {"term": "emergency stop button", "variants": ["E-stop button", "emergency stop"]},
      {"term": "responsive", "variants": ["working properly", "functional", "sensitive"]}
    ],
    "explanation": "'emergency stop button' 是工业设备标准术语，'make sure to check' 表达'务必检查'。"
  }
]
```
