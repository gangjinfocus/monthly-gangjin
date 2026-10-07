# 월간강진 WordPress 이전·운영 매뉴얼

현재 GitHub Pages는 정적 미리보기입니다. ChemiCloud의 실제 WordPress에 아래 플러그인과 테마를 설치하면 기사·예약·이미지·접수를 WordPress에서 운영할 수 있습니다. 도메인 등록만으로 접수 서버가 연결되지 않습니다. 이 작업에서는 외부 사이트·계정·DNS를 변경하지 않았습니다.

## 제공 파일과 의존성

- `wordpress/plugin/monthly-gangjin/`: WordPress 기본 글·분류·태그, `mg_issue` 지난 호, 공개 JSON 가져오기·내보내기, 비공개 접수 DB와 관리 메뉴.
- `wordpress/theme/monthly-gangjin/`: WordPress 동적 PHP 테마, 본문·갤러리·홈·분류·검색·호·소개·폼·정책·사진 출처.
- 패키징 시 `public/site.css`, `public/site.js`를 테마의 `assets/`에, `public/images/`를 `images/`에, `public/fonts/`를 `fonts/`에 복사합니다. 원본 파일은 공유 프런트엔드가 소유하며 PHP 템플릿은 동일한 DOM 클래스와 JS 계약을 사용합니다. 폰트 라이선스 파일도 포함합니다.
- WordPress 6.6 이상, PHP 8.1 이상. 운영은 ChemiCloud의 기존 MySQL/MariaDB를 사용합니다. PHP 이미지 라이브러리 GD/Imagick와 WebP 지원을 확인합니다. 별도 Node 서버나 프런트엔드 프레임워크는 필요하지 않습니다.
- 개인정보 접수는 플러그인의 실제 설치와 HTTPS가 필요합니다. 플러그인을 끄면 테마는 정적 모드로 전환되어 접수 성공을 표시하지 않습니다.

## 설치 전 확인

1. 실제 사용할 도메인, 기존 GitHub 저장소, ChemiCloud 서비스·cPanel·WordPress 설치 위치, Cloudflare DNS 연결을 기존 운영 기록에서 확인합니다. 아직 도메인은 확정되지 않았으므로 IP·DNS 레코드를 추정하여 입력하지 않습니다.
2. ChemiCloud 고객 계정은 `https://chemicloud.com/clientarea.php`입니다. 프로젝트 상위 `AUTHENTICATION.md`와 등록된 DPAPI 자격 정보를 사용하고, 해당 cPanel의 WP Toolkit **Log in** 또는 기존 Softaculous SSO로 들어갑니다. 세션 URL·비밀번호를 문서나 저장소에 남기지 않습니다.
3. 원본 WordPress DB·파일과 Node 운영 DB가 있으면 각각 백업합니다. 공개 콘텐츠 JSON과 비공개 접수 백업은 별도로 취급하며 접수 정보는 Git에 커밋하지 않습니다.
4. 새 설치·별도 테스트 설치에서 먼저 확인합니다. 기존 WordPress 글과 같은 slug가 충돌하면 가져오기가 멈춥니다. 기존 글·파일을 삭제하여 우회하지 않습니다.

## 설치와 콘텐츠 가져오기

1. 플러그인 ZIP 안의 최상위 폴더는 `monthly-gangjin/`이고 테마 ZIP도 `monthly-gangjin/`이어야 합니다. WordPress **플러그인 → 새 플러그인 → 업로드**에서 플러그인을 설치·활성화하고 **외모 → 테마 추가 → 업로드**에서 테마를 설치·활성화합니다.
2. **설정 → 일반**: 사이트 주소·WordPress 주소가 실제 HTTPS 도메인인지, 시간대가 `서울`인지 확인합니다. **설정 → 읽기**의 홈페이지는 최신 글을 사용합니다. 테마가 이를 매거진 홈으로 렌더링합니다.
3. **설정 → 고유주소** 사용자 정의 구조를 `/stories/%postname%/`, 분류 기본 경로를 `category`로 설정하고 저장합니다. 이 단계가 기사·분류 URL 유지에 필요합니다. 기존 다른 URL 구조가 운영 중이면 먼저 기존 URL과 301 목록을 확정합니다.
4. **월간강진 운영 → 콘텐츠 가져오기**에서 `data/content.json` 또는 Node 관리자의 공개 콘텐츠 내보내기를 업로드합니다. 서버 업로드 제한이 파일보다 작다면 cPanel PHP 설정을 먼저 확인합니다. 플러그인 자체 JSON 상한은 20MB입니다.
5. `/images/photo-01.webp` 형식의 사진은 활성 테마 `images/`에 실제 파일이 있어야 합니다. 플러그인은 로컬 파일을 WordPress 미디어 라이브러리로 가져오고 사진 설명·출처·라이선스를 보존합니다. 외부 URL 다운로드, ZIP 추출, 임의 파일 경로는 지원하지 않아 SSRF 경로를 만들지 않습니다. 기존 WordPress 미디어 URL은 같은 사이트 uploads 경로만 허용합니다.
6. 같은 `id`의 재실행은 기존 글·호를 갱신하며 이미 가져온 사진을 재사용합니다. 가져오기는 해당 글의 기존 편집을 대체하므로 백업 후 수행합니다. 입력 검증을 먼저 수행하지만 저장·디스크 오류는 중간에 발생할 수 있습니다. 부분 실패 메시지가 나오면 원인을 해결한 뒤 같은 파일을 다시 가져옵니다. 삭제 동기화는 하지 않습니다.
7. `draft`는 초안, 미래 `scheduled`는 WordPress의 `future`, 이미 지난 예약은 공개로 저장됩니다. 발행 날짜만 있는 값은 사이트 시간대로 해석하고 ISO 일시는 원본 UTC 오프셋을 유지합니다. `published`인데 미래 날짜를 가진 예시 기사는 날짜를 예약으로 바꾸지 않습니다. 원래 날짜를 `editorialDate` 메타데이터로 보존하고 실제 WordPress 공개 시각은 가져온 시각으로 저장하여 공개 상태와 검색 발행 시각을 일치시킵니다. 2027년 1월 같은 호 발행월은 별도의 호 메타데이터를 유지합니다. 공개 내보내기는 공개 글만 포함하므로 초안·미래 예약을 옮길 때는 권한 있는 원본 편집 데이터와 WordPress 전체 백업을 사용해야 합니다.

## WordPress에서 편집하기

- **글**에서 제목·본문·요약·대표 이미지·분류·태그·날짜·예약을 기본 WordPress 편집기로 수정합니다. 기사 본문은 JSON을 반복 렌더링하는 방식이 아니라 실제 Gutenberg 블록으로 저장됩니다. 새 기사도 기본 글 메뉴로 작성합니다.
- **월간강진 편집 정보** 메타 상자에서 글쓴이·사진가·보조 사진·인물·장소·호 id·SEO 제목·설명·예시 표시를 수정합니다. JSON 기사 id는 같은 상자에서 확인할 수 있습니다.
- Gutenberg 패턴 **월간강진 편집**에 사진 2장·3장·모자이크·띠·인물·전체 너비·겹침·분할 패턴이 있습니다. WordPress 미디어에서 사진과 alt·캡션을 넣습니다. 본문 사진은 확대 갤러리와 연결됩니다.
- **월간강진 · 지난 호**에서 호 제목·본문·요약·표지·권호·발행월·기사 id 목록을 수정합니다. 초안 상태의 호는 공개되지 않습니다.
- **월간강진 운영 → 홈·발행 정보**에서 주요·추천 기사 id, 주요 사진, 섹션 순서, 가격, 연락처, SNS, 발행·등록 정보를 수정합니다. 빈 주요 사진은 기사 대표 사진을 사용합니다.
- 소개 문안은 공개 WordPress 페이지 slug `about`으로 작성하면 기본 소개 대신 해당 본문을 표시합니다. 정책은 부모 페이지 `policies` 아래 `privacy`, `terms`, `email`, `subscription`, `refund` 페이지를 공개하면 기본 준비 문안 대신 표시합니다. 정책·판매 조건·위탁업체·법적 운영 주체·시행일은 실제 운영자가 개시 전에 확정합니다. 준비 문안을 확정된 법률 문서로 취급하지 않습니다.
- SEO 플러그인을 추가한다면 이 테마의 description·OG·JSON-LD와 중복되지 않도록 하나의 출처만 출력하게 조정합니다. 현재 테마 자체는 canonical·OG·Article/Organization 구조화 데이터를 출력합니다.

## 접수와 개인정보

`POST /wp-json/monthly-gangjin/v1/inquiries`는 공유 프런트엔드 계약의 개인·기관·광고·일반 문의 JSON을 받습니다. 개인정보는 `wp_mg_inquiries` 별도 테이블에 저장하며 실제 접두어는 WordPress 설치 설정을 따릅니다. 공개 `/content` API에는 접수·초안·미래 예약이 없습니다. 응답은 접수 참조 번호와 안내만 반환합니다.

서버는 필수 항목·형식·길이·동의·빈 honeypot·작성 시각·UUID 요청 키를 검증합니다. 같은 UUID와 같은 내용은 같은 접수 번호를 반환하며 다른 내용은 409입니다. IP를 원문 저장하지 않고 단기 HMAC 해시별 10분 10회 제한을 적용합니다. 원본 주소로 `REMOTE_ADDR`만 사용하므로 프록시 설정에서 방문자 주소를 신뢰할 수 있게 복원하지 않은 경우 여러 방문자가 한 제한을 공유할 수 있습니다. 무조건적인 `X-Forwarded-For`/`CF-Connecting-IP` 신뢰로 우회하지 않습니다. 같은 출처의 Origin을 확인하며 공개 양식에는 WordPress 로그인 nonce가 필요하지 않습니다.

**월간강진 운영 → 접수 관리**는 `manage_options` 관리자가 열람합니다. 상태 변경·영구 삭제·가져오기·설정·내보내기는 WordPress nonce와 권한을 함께 확인합니다. 접수 성공은 결제·구독 확정이 아닙니다. 카드 결제는 구현하지 않으며 담당자가 접수함을 확인합니다. **홈·발행 정보 → 접수 알림 메일**은 기본값이 꺼짐입니다. 실제 SMTP/호스팅 메일 전송 설정과 수신 이메일을 확인한 후 켭니다. WordPress `wp_mail`로 접수 참조 번호·종류·비공개 접수함 주소만 전송하며 신청자 연락처·주소·본문은 메일에 포함하지 않습니다. 접수함에 알림 꺼짐/전송 처리 성공/전송 처리 실패 상태를 표시합니다. 처리 성공은 메일 서버가 실제 전달하거나 수신자가 받은 것을 증명하지 않습니다. 실제 수신을 별도로 검증해야 합니다.

상태는 접수 → 확인 중 → 연락완료 → 견적발송 → 계약진행 → 구독중 → 처리 완료/종료로 관리합니다. 필수 순서 강제는 하지 않으므로 실제 진행 상태를 선택합니다. 구독중·계약진행·견적발송 상태는 자동 삭제하지 않습니다. 플러그인은 처리 완료·종료의 마지막 상태 변경 후 1년이 지난 접수를 일일 WP-Cron 작업에서 삭제합니다. WP-Cron은 실제 실행이 있어야 작동하므로 ChemiCloud에서 기존 정상 cron 호출 방식을 확인하고 `wp cron event run mg_delete_completed_inquiries` 또는 cPanel의 기존 WP-Cron 경로로 실제 실행을 검증합니다. 사이트 방문만으로 정시 실행을 보장하지 않습니다. 접수·확인 중 기록, 백업·서버 로그·법정 보관이 필요한 별도 거래 기록의 보관·폐기는 운영자가 따로 관리합니다. 삭제된 접수는 공개 내보내기로 복구할 수 없습니다.

## 원본 서버·Cloudflare와 도메인 전환

1. ChemiCloud 테스트 환경에서 아래 수용 검사를 끝낸 뒤 원본의 실제 문서 루트·SSL·DB 백업을 확인합니다. 인증·편집·접수 API는 페이지 캐시에서 제외합니다. `/wp-admin/*`, `/wp-login.php`, `/wp-json/monthly-gangjin/v1/inquiries`와 모든 POST를 캐시하지 않습니다. `Cache Everything` 같은 기존 규칙이 적용된다면 이 경로의 우선순위를 확인합니다.
2. 실제 도메인이 기존 GitHub Pages 미리보기에 연결돼 있으면 기존 DNS값과 GitHub custom-domain 설정을 기록합니다. DNS는 ChemiCloud 해당 서비스 화면에 표시된 실제 원본 IP·호스트로만 변경합니다. GitHub Pages의 프로젝트 경로(`/repository/`)가 기존 공개 주소였다면 실제 사용 중인 구주소에 대해 새 루트 경로로 301 이전 계획을 따로 마련합니다. GitHub 소유자 기준은 `gangjinfocus`이며 다른 소유자 저장소로 대체하지 않습니다.
3. Cloudflare는 기존 정상 DNS·프록시 설정을 보존하고 필요한 도메인의 원본만 전환합니다. 원본 SSL을 먼저 발급·검증한 뒤 Full (strict) 적용 여부를 확인합니다. Flexible 방식으로 HTTPS를 억지로 만들지 않습니다. `www`/루트의 대표 주소를 하나로 확정하고 기존 충돌 리디렉션을 확인합니다.
4. WordPress siteurl/homeurl을 실제 주소로 바꾼 뒤 JSON 미디어가 이전 임시 도메인을 참조하면 WordPress의 안전한 URL 치환 도구와 백업을 사용해 DB를 옮깁니다. 일회용 SSO·세션 URL은 저장하지 않습니다. WordPress 이미지 URL은 임시 도메인 문자열을 하드코딩하지 않고 미디어 라이브러리와 테마 URI에서 생성됩니다.
5. 공개 홈페이지·기사·분류·호·이미지의 실제 URL, canonical·OG·사이트맵·robots·301, 4개 양식 접수·접수함 상태 변경을 새 도메인에서 다시 확인합니다. 완료 전 기존 미리보기와 백업을 유지합니다. DNS 전파·인증서·외부 서비스 반영 대기는 완료로 보고하지 않습니다.
6. 장애 시 기록한 기존 DNS와 원본을 복원하고 새로 들어온 접수가 있다면 사라지지 않도록 DB를 먼저 보존합니다. WordPress 원본·Cloudflare 중 실제 실패 경로만 수정합니다.

## 검증 기록과 운영 수용 검사

2026-10-07 로컬에서 공식 WordPress 7.1.3, 공식 SQLite Database Integration 3.0.2 테스트 drop-in, PHP 8.4.26으로 실제 코드를 실행했습니다. SQLite drop-in은 **테스트에만** 사용했으며 운영 ChemiCloud MySQL에 설치하도록 제안하지 않습니다. `test-results/wp-runtime/`의 설치·DB·인증 쿠키·접수 fixture는 Git 제외 대상입니다. 저장소에는 테스트 코드만 포함합니다.

- PHP 소스·통합 테스트 전체 문법 검사 통과.
- `wordpress/tests/runtime-smoke.php`: 60개 검사 통과. 콘텐츠·미디어 재가져오기 중복 방지, native draft/future/지난 예약, 미래 호 날짜를 가진 공개 예시의 공개 상태, 공개 내보내기, 호·설정·사진 출처, 이미지 원격/경로 거절, 4개 실제 REST 양식, 영속 접수 DB, 요청 재시도/충돌·동의·honeypot·Origin·횟수 제한·권한·nonce를 확인. 메일 기본 꺼짐·개인정보 배제·처리 성공/실패 기록과 구독중 보존·만료 종료 접수 삭제·미해결 접수 보존도 확인. 메일 시험은 `pre_wp_mail`을 사용하는 로컬 fixture이며 외부 전송·실수신 시험은 하지 않음.
- `wordpress/tests/http-smoke.mjs`: 56개 검사 통과(변경 없는 공개 45개 검사 재사용 + 마지막 관리자 11개 검사). 17개 실제 PHP 페이지, 공유 CSS/JS/폰트, native Gutenberg 사진 배치·출처 링크와 확대 갤러리, 비공개 글 404, 공개 API의 접수 정보 배제, 익명 관리자 차단, 로그인 관리자 접수함, 잘못된 nonce 거절, 견적발송·계약진행·구독중·처리 완료의 정상 nonce 저장과 재조회 확인.

ChemiCloud/MySQL·실제 도메인·SSL·Cloudflare·정시 WP-Cron·실배송·결제는 아직 운영 환경 검증 전입니다. 운영 개시 전 이 항목을 실제 주소에서 확인해야 합니다. 로컬 테스트 통과를 운영 배포 완료로 해석하지 않습니다.

공식 참고: [WordPress REST routes와 권한](https://developer.wordpress.org/rest-api/extending-the-rest-api/routes-and-endpoints/), [WordPress native post API](https://developer.wordpress.org/reference/functions/wp_insert_post/), [WordPress cron](https://developer.wordpress.org/plugins/cron/), [SQLite 테스트 drop-in](https://wordpress.org/plugins/sqlite-database-integration/).
