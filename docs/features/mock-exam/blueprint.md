# Theory syllabus and paper blueprint

Scope: modular course mock examination paper blueprint.
Reviewed: 2026-11-03. Rule version: `2026-11-03.3`.

The [2022 MOT/MPS examination syllabus][syllabus] replaces the 2016 edition.
[GA 1026-2022][standard] remains the current mandatory content/method standard.
National examination content and pass standards apply; this does not eliminate
the local-question component or establish local-bank completeness.

## Type composition and scoring

| Setting | Subject 1 | Subject 3 safety/civilized knowledge (Subject 4) |
| --- | ---: | ---: |
| Questions | 100 | 50 |
| Judgment | 40 | 20 |
| Single choice | 60 | 20 |
| Multiple choice | 0 | 10 |
| Minutes | 45 | 45 |
| Points per question | 1 | 2 |
| Total / pass | 100 / 90 | 100 / 90 |

Type proportions follow clauses 4.1.3.1 and 4.3.2.3 of the
[police-published standard text][released]. Each new paper enforces the type
counts independently. Insufficient eligible questions of a required type cause
creation to fail; another type is not substituted. Question IDs are unique.

Questions are randomized within each type section. The selected recording's
Subject 1 format places judgment first, followed by single choice. The Subject 4
adaptation uses judgment, single choice, then ten multiple-choice items. Section
ordering is a documented simulator configuration.
Choice options are randomized for single/multiple choice; judgment retains its
conventional true/false order. Saved papers retain their exact presentation.
Stable option signs determine grading regardless of displayed A–D letters.

## Subject 1 content targets

GA 1026-2022 Table 1, passenger-car column. Counts derive from a 100-question paper.

| Content group | Share | Target questions |
| --- | ---: | ---: |
| Driving-license and vehicle administration | 20% | 20 |
| Road-access conditions and traffic rules | 25% | 25 |
| Traffic offenses and penalties | 25% | 25 |
| Accident-handling rules | 10% | 10 |
| Basic vehicle knowledge | 10% | 10 |
| Local legislation | 10% | 10 |

The separate large/medium vehicle brakes and safety-devices row is 0% for this
vehicle scope. Motorcycle, heavy-vehicle, full-points-learning and qualification
restoration tables must not be substituted.

## Safety/civilized content targets

GA 1026-2022 Table 4. Counts derive from a 50-question paper.

| Content group | Share | Target questions |
| --- | ---: | ---: |
| Safe driving | 20% | 10 |
| Civilized driving | 18% | 9 |
| Traffic signals applied in traffic scenarios | 8% | 4 |
| Adverse weather and complex roads | 16% | 8 |
| Emergency avoidance | 10% | 5 |
| Secondary-accident prevention and first aid | 12% | 6 |
| Typical accident analysis | 6% | 3 |
| Local questions | 10% | 5 |

These are reference targets, **not achieved content quotas in generated papers**.
The 2022 syllabus defines the knowledge points and mastery levels; the numeric
shares come from the released standard text, not from bank chapter sizes.

## Local-bank coverage

Run `npm run audit:exam-bank` to inspect the imported metadata without writing to
the bank or application database.

| Bank | Questions | Judgment | Single | Multiple | Province/city IDs |
| --- | ---: | ---: | ---: | ---: | --- |
| Subject 1 | 1,734 | 809 | 925 | 0 | All zero |
| Safety/civilized | 1,413 | 763 | 444 | 206 | All zero |

Current sampling enforces unit type quotas. The API returns
`blueprint.content_alignment = "unverified"`; preparation and rule dialogs show
the same status when detailed topic targets are not formally configured.

## Evidence qualifications

The government-hosted Word attachment contains the release/effective dates and
the tables above, but reserves the final typeset publication. A second public
released-text copy agrees. The official standards viewer currently exposes a
seven-page approval draft with `XXXX` dates; it is not a final-text authority.
Catalog status alone does not authenticate every clause in a secondary copy.

[GA/T 2355-2025][organization], effective 2026-05-01, is the current organization
procedure standard. Its final theory-organization chapter has not been inspected;
no additional stopping, order or UI behavior is inferred from its catalog entry.

[GA 1027-2026][management], effective 2026-07-01, replaces GA 1027-2017 as the
current examination-management system standard. Its catalog entry verifies
identity and status, not particular sampling or candidate-interface behavior.

Per-question locking, skip/review behavior, exact-set multiple-choice grading,
Subject 1 automatic stopping and the earned-points display at early termination
remain documented simulator policies.

[syllabus]: https://xxgk.mot.gov.cn/2020/jigou/ysfws/202203/t20220325_3647756.html
[standard]: https://std.samr.gov.cn/hb/search/stdHBDetailed?id=E424B54CA6246DD7E05397BE0A0A5C54
[released]: https://www.fogang.gov.cn/ywdt/gggs/tzgg/content/post_1879985.html
[safety]: https://ga.chengde.gov.cn/art/2023/11/24/art_3027_970866.html
[organization]: https://ywtb.mps.gov.cn/gabzh/portal/stdDetail/309752
[management]: https://ywtb.mps.gov.cn/gabzh/portal/stdDetail/313661
