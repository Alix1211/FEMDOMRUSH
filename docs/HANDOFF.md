# 이어서 작업할 때 읽는 메모 (2026-10-07)

## 완료
- assets: map(50), characters(102 원본 WebP), units(아군 u01~u23 / 적 e01~e34, 정면·뒷면·왼쪽·오른쪽 스트립 + units.json), ui/parts(24부품), items(36), data/maps.json(전투맵 35장의 적 이동 길 + 배치 자리 자동 추출)
- js/data.js: 월드 7, 스테이지 70(맵 5장×2회), 클래스/아군/적 임시 수치
- js/battle.js: 전투 로직(DP, 배치+방향, 막기, 스킬, 웨이브, 강화, 별 계산). 노드 시뮬레이션으로 1-1 클리어 확인
- js/game.js: 로딩, 타이틀+월드맵, 월드 스테이지 화면, 출격 준비, 설정/도감 모달 (미시험)

## 남은 일
1. js/game.js 에 BattleScreen(전투 화면 HUD: 시안 3번째 배치), 결과 화면, 일시정지, 메인 루프(requestAnimationFrame) 추가
2. index.html / styles.css 를 새 구조로 교체 (canvas#gameCanvas + js/data.js, battle.js, game.js 순서)
3. Playwright 로 실제 화면 확인 → 어긋난 곳 수정
4. 임시 항목 확정 필요: 아군 이름/클래스(외형 기준 임시), 적 유형 배정, 스탯 스케일, 데미지 최소 비율

## 추가 반영 (최신)
- 첫 화면: assets/ui/title_key.webp(대치 일러스트)가 배경. "시작"을 누르면 약 1.3초 교차 페이드로 월드맵으로 전환 (js/game.js의 World, fk/logoK).
- 배포 주소: https://alix1211.github.io/FEMDOMRUSH/ (저장소 이름이 대문자 FEMDOMRUSH입니다. 소문자 주소는 404).
- 캐시 방지: pages.yml이 배포할 때 index.html의 __BUILD__를 커밋 해시로 바꿔 스크립트·이미지·JSON에 ?v= 버전을 붙입니다. index.html의 __BUILD__ 표기는 지우지 마세요.
- 전투 화면은 여전히 미구현 (BattleScreen 임시 안내만 있음). 시안 3번 기준, 만들기 전에 케인과 배치 상의.
