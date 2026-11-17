# Local issues

One numbered issue corresponds to one ordinary branch in the primary checkout.
Git worktrees are prohibited for development in this repository.

1. Run `npm run issue:new -- --type feat "Title"` in the primary checkout on main.
2. Complete every required section and run `npm run issue:check`.
3. Commit the issue and any input assets on main before implementation.
4. Run `git switch -c type/NNNN-slug main` in the primary checkout.
5. Implement and validate in that same checkout.
6. Close the issue with a commit or PR reference, then integrate into main.

The shared contract is in `scripts/issue-lib.mjs`; synchronize the template when
changing required sections. Frozen input evidence belongs in `_assets/NNNN-slug/`.
The legacy `npm run issue:worktree` command reports the development-policy violation.
