# Learning analysis design

The first release describes observed practice performance. It does not infer a
validated mastery probability or claim calibrated real-exam readiness.

## Evidence and time

One immutable record represents one submitted answer: original question and
chapter snapshots, revision, selected and correct answer sets, server grade,
server opening/answer times, first/repeat status, and observed prior exposure.
Manual memorization marks and passive exposure are separate evidence. Useful
principles from [xAPI](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md)
are retained without adding an xAPI server or its complete schema.

Correctness is observable; knowledge remains an inference affected by guessing,
slips, familiarity, and assistance. This distinction is established in
[knowledge-tracing research](https://www.cs.cmu.edu/~listen/pdfs/Beck%20Sison%202006%20jaied%20extended%20version.pdf).
Previously unseen status cannot be guaranteed: earlier passive activity and
external assistance are incompletely observed. First submitted attempt does not
mean first encounter with a question.

Windows are rolling 7, 30, or 90 UTC days, or all records, ending at a server
snapshot time. A timestamp at the lower boundary is included. Future events
are excluded. Daily bins use UTC calendar dates and preserve partial first and
last days; a rolling N-day interval can therefore contain N+1 date bins. The
all-time view limits only its daily chart to the latest 30 days.

The recent-versus-previous comparison uses equal seven-day periods. The current
period includes its lower boundary; the previous period excludes that same
boundary. Changes appear only when both periods have at least five submissions.
This is a display guard, not a statistical significance threshold. Results are
percentage-point changes, with question-composition confounding disclosed.

## Denominators and recent performance

- Attempt accuracy: correct submissions / all submissions in the window.
- First/repeat accuracy: separate submitted-attempt populations.
- Coverage: different questions answered / questions in the subject bank.
- Chapter error rate: incorrect submissions / submissions in that chapter.
- Latest incorrect questions: distinct questions whose latest window result is wrong.
- Improved questions: an earlier wrong result followed by a latest correct result
  within the same window; the old error remains in history.

The recent headline uses one latest attempt per question, so rapid repetition
cannot give that question multiple weights. For age d in days and correctness
y in {0,1}, w = 2^(-d/14), and recent accuracy = 100 × sum(wy) / sum(w).
[NIST's EWMA reference](https://itl.nist.gov/div898/software/dataplot/refman1/auxillar/ewma.htm)
supports recency weighting as a descriptive technique. The 14-day half-life is
an explainable product choice, not a validated human-forgetting constant.
Without new responses the normalized mean does not automatically decline;
staleness is shown by the last-practice timestamp.

## Provisional score

The bank-score estimate is the sum of chapter recent accuracies weighted by
each chapter's fraction of questions in the subject bank. It is withheld until
there are at least 20 different questions and every bank chapter has evidence.
Twenty is a product sparsity guard, not a psychometric calibration result.

The estimate shows sample size, coverage, missing chapters, and an uncalibrated
label. Bank chapter proportions are not asserted to be official exam sampling
weights. Selective practice and answer familiarity limit representativeness.
No pass probability or confidence/prediction interval is presented.

A proportion interval requires assumptions about sampling and independence;
[NIST's guidance](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)
does not justify treating repeated, selected, recency-weighted practice as an
independent representative sample. A future exam forecast should be recorded
before each independent mock and checked against later outcomes using error,
bias, and coverage. [Calibration research](https://proceedings.mlr.press/v70/guo17a.html)
explains why model complexity alone does not establish trustworthy probabilities.

## Advice

Recommendations cite observed chapter errors, remaining latest-wrong questions,
coverage gaps, and wrong-to-correct transitions. They recommend mixed practice,
retrieval, and spaced review rather than claiming measured forgetting.
[Retrieval-practice evidence](https://pubmed.ncbi.nlm.nih.gov/21252317/) and
[spacing research](https://doi.org/10.1111/j.1467-9280.2008.02209.x) support these
broad strategies, not a universal fixed review interval.
