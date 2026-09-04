# MV-Platform ECC 선택 설치

이 디렉터리는 ECC 저장소 루트의 `mv-configs/`에 둔다. 플러그인 전체 설치 대신 Claude와 Codex에 동일한 Base/스택 구성을 선별 설치한다.

## Claude Base

```bash
./mv-configs/install-base.sh --dry-run
./mv-configs/install-base.sh
```

첫 실행은 자동 hook runtime을 설치하지 않는다. 재실행은 이전에 명시한 hook 선택을 보존한다. Claude hook까지 사용할 때만 권한 범위를 확인한 뒤 명시적으로 opt-in한다.

```bash
./mv-configs/install-base.sh --enable-hooks --dry-run
./mv-configs/install-base.sh --enable-hooks
```

이미 설치한 hook을 끄려면 기존 관리 파일을 안전하게 제거한 뒤 Base를 다시 설치한다.

```bash
node scripts/uninstall.js --target claude
./mv-configs/install-base.sh --no-hooks
```

## Codex Base

Codex의 `ecc@ecc` 플러그인이 설치되어 있으면 286개 전체가 계속 노출되므로 먼저 제거한다.

```bash
codex plugin remove ecc@ecc

./mv-configs/install-base-codex.sh --dry-run
./mv-configs/install-base-codex.sh
```

Codex Base는 공식 `core` 프로필과 MV Base 스킬의 합집합 54개를 Codex의 정식 사용자 스킬 경로인 `~/.agents/skills`에 설치한다. ECC 설치기가 먼저 생성하는 구 경로 `~/.codex/skills`에서는 이 래퍼가 관리하는 스킬만 안전하게 이동·정리한다. 기존 `~/.codex/config.toml`은 변경하지 않으며, 기존 `~/.codex/AGENTS.md`의 사용자 내용도 보존하고 MV 관리 규칙 블록만 추가하거나 갱신한다. 이전 wrapper가 전역 파일에 잘못 복사한 저장소 전용 Codex 지침은 제거하므로 `docs/CODEX-NAVIGATION-GUIDE.md` 누락 오류도 재설치 시 정리된다. ECC 원본에서 누락된 Codex agent role의 필수 `name`과 `description`도 `docs-researcher`, `explorer`, `reviewer`에 자동 보정한다.

설치 후 Codex를 다시 시작하고 `/skills`를 실행하거나 `$`를 입력하면 선별 설치된 스킬을 확인하고 호출할 수 있다. 수동 셸 설치는 플러그인 설치가 아니므로 `codex plugin list`에는 나타나지 않는다.

이전 wrapper로 이미 설치했다면 새 `mv-configs`로 교체한 뒤 Base를 한 번 더 실행하면 된다. 관리 대상 스킬은 구 경로에서 공식 사용자 경로로 자동 이전된다. 재실행 후 아래 결과가 `54`인지 확인하고 Codex를 완전히 종료했다가 다시 시작한다.

```bash
find "$HOME/.agents/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l
```

## 프로젝트 스택

공식 빠른 설치 명령은 Claude Code에 `ecc@ecc` 전체 플러그인을 설치한다.

```bash
npx ecc-universal setup
```

전체 플러그인은 286개 스킬을 모두 노출하므로 컨텍스트를 작게 유지하려는 이 가이드에서는 사용하지 않는다. 위에서 Base만 설치한 다음, 프로젝트 루트에서 현재 프로젝트에 필요한 스택 래퍼만 실행한다.

| 스택 | Claude | Codex |
|---|---|---|
| React + Vite | `~/Tools/ecc/mv-configs/install-react-vite.sh` | `~/Tools/ecc/mv-configs/install-react-vite-codex.sh` |
| Android + Kotlin | `~/Tools/ecc/mv-configs/install-android.sh` | `~/Tools/ecc/mv-configs/install-android-codex.sh` |
| iOS + Swift | `~/Tools/ecc/mv-configs/install-ios.sh` | `~/Tools/ecc/mv-configs/install-ios-codex.sh` |
| React Native | `~/Tools/ecc/mv-configs/install-react-native.sh` | `~/Tools/ecc/mv-configs/install-react-native-codex.sh` |
| Spring Boot + Kotlin | `~/Tools/ecc/mv-configs/install-spring-kotlin.sh` | `~/Tools/ecc/mv-configs/install-spring-kotlin-codex.sh` |
| FastAPI | `~/Tools/ecc/mv-configs/install-fastapi.sh` | `~/Tools/ecc/mv-configs/install-fastapi-codex.sh` |
| Django | `~/Tools/ecc/mv-configs/install-django.sh` | `~/Tools/ecc/mv-configs/install-django-codex.sh` |
| Infra | `~/Tools/ecc/mv-configs/install-infra.sh` | `~/Tools/ecc/mv-configs/install-infra-codex.sh` |

실제 설치 전에 선택한 명령 끝에 `--dry-run`을 붙여 설치 범위를 확인한다.

```bash
~/Tools/ecc/mv-configs/install-spring-kotlin-codex.sh --dry-run
~/Tools/ecc/mv-configs/install-spring-kotlin-codex.sh
```

Codex 프로젝트 스킬은 `.agents/skills/<skill>`에 설치한다. 프로젝트 규칙 원본은 `.agents/rules/ecc`에 보관하고, Codex가 실제로 읽을 수 있도록 기존 `AGENTS.md`를 보존하면서 MV 관리 블록으로 합친다.

모든 래퍼는 재실행할 수 있으며 `--dry-run`에서는 파일을 생성하거나 복사하지 않는다.
