# Project Goal and Handoff

Last reviewed: 2026-10-25. This inventory reflects features described in the current README and workflow/source layout; validate the fork's implementation before assuming upstream documentation proves every path works.

## Goal
Maintain a usable, open-source mobile AI chat application that supports local GGUF models and remote providers, with practical model/chat management and a native Android build.

## Feature inventory

### Implemented / documented in the current README
- Remote provider connections, including API-compatible providers and self-hosted LiteLLM-style endpoints.
- Curated model downloads and importing local GGUF files.
- Conversation creation, rename/delete, JSON export/import, and per-session generation parameters.
- Global system prompt and assistant/persona configuration.
- Voice output integration through Maise.
- Material You light/dark theming.
- Android build/test workflows are present in `.github/workflows/`.

### Partial / needs verification
- Every listed provider/model/download path needs verification against the current code and provider API; a README list is not evidence that all endpoints still work.
- Build, test, and release outputs must be checked on the current branch. Use physical-device testing for Android-specific behavior.
- Confirm whether this fork has intentional behavior differences from upstream Maid before changing or deleting inherited components.

### Not yet specified
- The current root README does not provide a clear fork-specific backlog of unimplemented features. Do not invent a roadmap; add concrete missing items when confirmed from code, issues, or owner direction.

## Handoff notes for the next agent
1. Inspect `package.json`, `app/`, native modules, and the workflows before choosing a build command.
2. The README documents `yarn install`, `yarn test`, and `yarn build-android`; verify those scripts still exist before running them.
3. Keep local-model/privacy behavior and user-owned chat data intact.
4. When documenting a missing or completed feature, distinguish upstream documentation from this fork's actual implementation.
5. Update this file after each substantive change with test outcomes and remaining blockers.
