# MV-Platform ECC 선택 설치

이 디렉터리는 ECC 저장소 루트의 `mv-configs/`에 둔다. 기본 구성은 공통 11개와 8개 역할의 고유 스킬 38개를 합친 **49개 공용 통합 설치**다.

## Claude: 유니버설 설치 후 통합 49개

먼저 공식 유니버설 안내형 설치에서 **Global user**, **Hooks off**를 선택한다. 설치 직후 전체 플러그인을 비활성화한다.

```bash
npx ecc-universal setup
claude plugin disable ecc@ecc --scope user
```

이후 통합 스크립트로 49개만 사용자 범위에 설치한다. `ecc@ecc`를 다시 활성화하면 전체 플러그인 스킬이 로드되므로 비활성 상태를 유지한다.

```bash
./mv-configs/install-unified.sh --dry-run
./mv-configs/install-unified.sh
```

첫 실행은 자동 hook runtime을 설치하지 않는다. 공통 규칙만 사용자 범위에 적용하며 스택별 규칙 팩은 설치하지 않는다.

기존 프로젝트에서 플러그인을 local 또는 project 범위로 켰다면 해당 범위도 비활성화한다. 프로젝트별 스킬 복사는 더 이상 필요하지 않다.

## Codex: 통합 49개

Codex의 `ecc@ecc` 플러그인을 사용 중이라면 제거한 뒤 통합 설치한다.

```bash
./mv-configs/install-unified-codex.sh --dry-run
./mv-configs/install-unified-codex.sh
```

Claude는 `~/.claude/skills`, Codex는 `~/.agents/skills`에 49개를 설치한다. `continuous-learning` v1은 제외하고 v2를 포함한다.

## 공통 11개만 선택할 때

통합 설치 대신 공통 스킬만 쓰는 환경에서는 기존 Base 스크립트를 실행할 수 있다.

```bash
./mv-configs/install-base.sh --dry-run
./mv-configs/install-base.sh
```

Claude hook까지 사용할 때만 권한 범위를 확인한 뒤 명시적으로 opt-in한다.

```bash
./mv-configs/install-base.sh --enable-hooks --dry-run
./mv-configs/install-base.sh --enable-hooks
```

이미 설치한 hook을 끄려면 기존 관리 파일을 안전하게 제거한 뒤 Base를 다시 설치한다.

```bash
node scripts/uninstall.js --target claude
./mv-configs/install-base.sh --no-hooks
```

### Codex Base

Codex의 `ecc@ecc` 플러그인이 설치되어 있으면 286개 전체가 계속 노출되므로 먼저 제거한다.

```bash
codex plugin remove ecc@ecc

./mv-configs/install-base-codex.sh --dry-run
./mv-configs/install-base-codex.sh
```

Codex Base는 동일한 공용 스킬 11개를 Codex의 사용자 스킬 경로인 `~/.agents/skills`에 설치한다. 기존 `~/.codex/config.toml`과 `~/.codex/AGENTS.md`의 사용자 내용을 보존하며 MV 관리 규칙 블록만 추가하거나 갱신한다. 이전 wrapper가 전역 파일에 잘못 복사한 저장소 전용 Codex 지침도 정리한다. Codex agent role의 필수 `name`과 `description`은 `docs-researcher`, `explorer`, `reviewer`에 자동 보정한다.

설치 후 Codex를 다시 시작하고 `/skills`를 실행하거나 `$`를 입력하면 선별 설치된 스킬을 확인하고 호출할 수 있다. 수동 셸 설치는 플러그인 설치가 아니므로 `codex plugin list`에는 나타나지 않는다.

이전 53개 Base를 설치한 사용자에게는 재실행만으로 기존 스킬 디렉터리가 삭제되지 않는다. 개인 수정 내역과 다른 설치의 소유권을 확인한 뒤 이전 스킬을 별도로 정리한다. 다른 사용자 스킬이 없는 깨끗한 설치 환경에서는 아래 결과가 `11`인지 확인하고 Codex를 완전히 종료했다가 다시 시작한다.

```bash
find "$HOME/.agents/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l
```

## 프로젝트 스택

통합 49개 대신 공통 11개만 설치한 환경에서, 특정 프로젝트에 필요한 역할 스킬만 추가할 때 아래 스택 래퍼를 실행한다.

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
