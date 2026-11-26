## Summary

<!-- Describe what changed and why. Link the issue: Fixes #123 -->

## Area

- [ ] Vodka application or VodkaKit
- [ ] VodkaCmd or VodkaThumbnail
- [ ] Runtime assembly or scripts
- [ ] Documentation or localization

## Testing

<!-- Exact commands run and their result. State what could not be run. -->

- [ ] `swift test --package-path VodkaKit` (when application logic changed)
- [ ] Built the affected Xcode scheme (when application or UI changed)
- [ ] `swiftformat --lint . && swiftlint --strict`
- [ ] `./scripts/british-english.py --check` (when strings changed)
- [ ] `./scripts/scan-secrets.sh`
- [ ] Screenshots or recordings attached (when UI changed)

## Checklist

- [ ] One focused change; no unrelated reformatting or refactoring
- [ ] Swift files retain the GPL header; new application-target files are in `Vodka.xcodeproj`
- [ ] Changelog updated under `[Unreleased]` for user-facing changes
- [ ] Documentation updated where behaviour or paths changed
- [ ] No secrets, keys, certificates or personal diagnostics in the diff
- [ ] Commits are scoped and signed off (`git commit -s`)
- [ ] Working branch to be deleted after merge

## Notes for reviewers

<!-- Trade-offs, follow-ups, known limitations. -->
