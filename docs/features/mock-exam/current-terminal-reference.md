# Examination terminal layout reference

Reviewed **2026-11-03**.
Implementation reference: historical test simulator recording.

The examination terminal provides a standardized examination layout:
- Candidate profile and countdown timer panel
- Clear question prompt with option buttons
- Number-key and click-based option selection
- 10-column interactive answer sheet
- Dedicated submission dialog and immediate score breakdown

## Interface geometry and interaction

The interface establishes:
- Fixed desktop grid keeping question prompt, answer choices, and answer sheet visible simultaneously
- Immediate commit upon advancing
- Confirmation modal before exam submission
- Review view showing marked errors and explanations after finalization
