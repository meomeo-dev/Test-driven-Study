# Examination rules and interface evidence

Reviewed: **2026-11-03**. Scope: modular course mock examination simulator.
Regulations, specifications and standards records provide context for timed testing
and question selection; the application provides a local simulation environment
tailored for self-paced practice and testing.

## Verified rules

| Evidence | Published/effective | Supported conclusion |
| --- | --- | --- |
| [MPS Order 172, consolidated regulation](https://www.beijing.gov.cn/zhengce/zhengcefagui/qtwj/202412/t20241231_3978134.html) | Effective 2025-01-01 | Nationally unified examination content/pass standards; both theory components total 100 points and require 90. |
| [Suzhou government / police guidance](https://www.suzhou.gov.cn/szsrmzf/mszx/202606/0775c0a0e68d477f87cad2fcfa941b54.shtml) | 2026-06-15 | Car Subject 1 has 100 questions, safety/civilized knowledge has 50; both last 45 minutes. |
| [Hunan provincial police FAQ](https://gat.hunan.gov.cn/gat/ztzl2/jgywzl/jgdt/202207/t20220715_27559094.html) | 2022-07-15 | Subject 1 uses judgment and single-choice questions, scored out of 100. |
| [Chengde police guidance](https://ga.chengde.gov.cn/art/2023/11/24/art_3027_970866.html) | 2023-11-24 | Safety/civilized knowledge uses two points per question, 40 single-answer items including judgment, followed by ten multiple-choice items; six errors terminate the examination. |
| [GA 1026-2022 standards record](https://std.samr.gov.cn/hb/search/stdHBDetailed?id=E424B54CA6246DD7E05397BE0A0A5C54) | Published 2022-03-29; effective 2022-04-01 | Current mandatory national examination content/method standard. |
| [2022 MOT/MPS syllabus](https://xxgk.mot.gov.cn/2020/jigou/ysfws/202203/t20220325_3647756.html) | Effective 2022-04-01 | Replaces the 2016 syllabus; defines knowledge points and mastery requirements. |
| [Police-published GA 1026-2022 attachment](https://www.fogang.gov.cn/ywdt/gggs/tzgg/content/post_1879985.html) | Police notice 2024-06-14 | Released-text type proportions and topic tables; attachment reserves the final typeset publication. |
| [MPS GA/T 1028.2-2022 record](https://ywtb.mps.gov.cn/gabzh/portal/stdDetail/309763), [SAMR record](https://std.samr.gov.cn/hb/search/stdHBDetailed?id=E43305AC7637D074E05397BE0A0AD741) | Published 2022-03-29; effective 2022-04-01 | Current theory examination system standard. |
| [MPS GA 1027-2026 record](https://ywtb.mps.gov.cn/gabzh/portal/stdDetail/313661) | Published 2026-02-28; effective 2026-07-01 | Current examination-management system standard, replacing GA 1027-2017; body uninspected. |

## Interface scope

The implementation provides a dedicated simulation terminal. Preparation, the fixed candidate/question/table
regions, lower image region, next-question assessment, wrong-answer dialog and
submission/result dialogs follow clean exam terminal design. The terminal has its own fixed
palette and controls, without the learning site's sidebar or theme switch.

A publicly accessible copy attributed to GA/T 1028.2-2022 describes keyboard
navigation, automatic assessment, a dynamic countdown and a five-minute warning.
Its non-government host and draft/excerpt caveats prevent treating it as an
inspected final official standard. The official records above verify identity
and status, not every clause in that copy. Those useful controls are implemented
as explicit simulation features.

## Application policies and limits

- Subject 1 awards one point per question, consistent with its 100-question,
  100-point format. A direct current official per-question statement was not found.
- New papers enforce Subject 1's 40 judgment / 60 single-choice split and safety's
  20 judgment / 20 single-choice / 10 multiple-choice split. See the
  [blueprint and evidence qualifications](blueprint.md).
- Exact-set multiple-choice grading and draft/commit locking remain explicit
  simulator policies. Next commits and advances in one transaction; previous and
  answer-table navigation extend the same policy to avoid dropping selections.
  Only committed questions reveal correctness/answers during an active paper.
  The wrong-answer dialog follows the selected video; full explanations remain
  a post-examination review feature. Enter invokes next/commit once.
- Subject 1 early termination at 11 errors is a simulator policy: the maximum
  possible final score is then 89. The automatic-stop rule itself was not verified
  from a current official source.
- Physical-driving examinations, eligibility verification, official booking,
  identities, face recognition and credited training are outside this feature.

The official standards preview exposes an approval draft with placeholder dates;
it is not treated as final text. The police-published released-text attachment
provides stronger clause evidence but reserves the final typeset publication.
GA/T 2355-2025, effective 2026-05-01, is current.
