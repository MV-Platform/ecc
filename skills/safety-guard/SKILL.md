---
name: safety-guard
description: "Guard against destructive operations with three modes: Careful intercepts dangerous commands (rm -rf, git push --force, DROP TABLE) for confirmation, Freeze locks writes to one directory, and Guard combines both via PreToolUse hooks. Use when working on production systems, running agents autonomously, restricting edits to a directory, or during migrations, deploys, and data changes."
metadata:
  origin: ECC
---

# Safety Guard — Prevent Destructive Operations

## When to Use

- When working on production systems
- When agents are running autonomously (full-auto mode)
- When you want to restrict edits to a specific directory
- During sensitive operations (migrations, deploys, data changes)

## Scope

This skill provides review guidance for the modes below. It does not include a
`/safety-guard` command or a PreToolUse hook that enforces them. Treat directory
limits as instructions unless a separate, tested enforcement mechanism is
configured. Do not claim that a command was blocked by this skill.

## How to Use the Guidance

Three modes of protection:

### Mode 1: Careful Mode

Review destructive commands before execution and warn about:

```
Watched patterns:
- rm -rf (especially /, ~, or project root)
- git push --force
- git reset --hard
- git checkout . (discard all changes)
- DROP TABLE / DROP DATABASE
- docker system prune
- kubectl delete
- chmod 777
- sudo rm
- npm publish (accidental publishes)
- Any command with --no-verify
```

When detected: explain what the command does, ask for confirmation, and suggest
a safer alternative.

### Mode 2: Freeze Mode

Limit planned file edits to a specific directory tree:

```
Apply freeze guidance to src/components/
```

Review each proposed Write/Edit against `src/components/`. A separate hook or
policy is required to block writes outside that directory automatically.

### Mode 3: Guard Mode (Careful + Freeze combined)

Both protections active. Maximum safety for autonomous agents.

```
Apply guard guidance to src/api/ while allowing reads elsewhere
```

Review writes against `src/api/` and review destructive commands everywhere.
Automatic blocking requires a separate hook or policy.

### Unlock

```
Stop applying the freeze or guard guidance
```

## Enforcement

The ECC repository does not bundle a PreToolUse hook or slash command for this
skill. Installing or invoking it does not enable automatic command blocking,
directory confinement, or a `~/.claude/safety-guard.log` audit log. Configure
and test those controls separately if required for production work.
