# MV-Platform ECC 선택 설치

이 디렉터리는 ECC 저장소 루트의 `mv-configs/`에 둔다. 플러그인 전체 설치 대신 Claude와 Codex에 동일한 Base/스택 구성을 선별 설치한다.

## Claude Base

```bash
./mv-configs/install-base.sh --dry-run
./mv-configs/install-base.sh
```

## Codex Base

Codex의 `ecc@ecc` 플러그인이 설치되어 있으면 286개 전체가 계속 노출되므로 먼저 제거한다.

```bash
codex plugin remove ecc@ecc

./mv-configs/install-base-codex.sh --dry-run
./mv-configs/install-base-codex.sh
```

Codex Base는 공식 `core` 프로필의 Codex 스킬 47개와 MV Base 스킬 6개를 Codex의 정식 사용자 스킬 경로인 `~/.agents/skills`에 설치한다. ECC 설치기가 먼저 생성하는 구 경로 `~/.codex/skills`에서는 이 래퍼가 관리하는 53개만 안전하게 이동·정리한다. 기존 `~/.codex/config.toml`은 변경하지 않으며, 기존 `~/.codex/AGENTS.md` 내용도 보존하고 MV 관리 규칙 블록만 추가하거나 갱신한다. ECC 원본에서 누락된 Codex agent role의 필수 `name`과 `description`도 `docs-researcher`, `explorer`, `reviewer`에 자동 보정한다.

설치 후 Codex를 다시 시작하고 `/skills`를 실행하거나 `$`를 입력하면 선별 설치된 스킬을 확인하고 호출할 수 있다. 수동 셸 설치는 플러그인 설치가 아니므로 `codex plugin list`에는 나타나지 않는다.

이전 wrapper로 이미 설치했다면 새 `mv-configs`로 교체한 뒤 Base를 한 번 더 실행하면 된다. 관리 대상 스킬은 구 경로에서 공식 사용자 경로로 자동 이전된다. 재실행 후 아래 결과가 `53`인지 확인하고 Codex를 완전히 종료했다가 다시 시작한다.

```bash
find "$HOME/.agents/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l
```

## 프로젝트 스택

설치할 프로젝트 루트에서 실행한다.

Claude 예:

```bash
~/Tools/ECC/mv-configs/install-spring-kotlin.sh --dry-run
~/Tools/ECC/mv-configs/install-spring-kotlin.sh
```

Codex 예:

```bash
~/Tools/ECC/mv-configs/install-spring-kotlin-codex.sh --dry-run
~/Tools/ECC/mv-configs/install-spring-kotlin-codex.sh
```

사용 가능한 스택 이름:

```text
react-vite
android
ios
react-native
spring-kotlin
fastapi
django
infra
```

Codex 프로젝트 스킬은 `.agents/skills/<skill>`에 설치한다. 프로젝트 규칙 원본은 `.agents/rules/ecc`에 보관하고, Codex가 실제로 읽을 수 있도록 기존 `AGENTS.md`를 보존하면서 MV 관리 블록으로 합친다.

모든 래퍼는 재실행할 수 있으며 `--dry-run`에서는 파일을 생성하거나 복사하지 않는다.
