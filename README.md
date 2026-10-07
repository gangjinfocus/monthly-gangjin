# 월간 강진 · MONTHLY GANGJIN

유명한 강진보다, 살아 있는 강진을 기록합니다.

GitHub: https://github.com/gangjinfocus/monthly-gangjin

GitHub Pages: https://gangjinfocus.github.io/monthly-gangjin/

## 운영 단계

GitHub Pages에서 공개되는 것은 기사·검색·아카이브·정책·모션을 갖춘 정적 사이트입니다. **GitHub Pages 자체에는 관리자 서버나 DB가 없습니다.** API를 연결하지 않은 공개 사이트는 구독·문의 접수를 완료했다고 표시하지 않고 편집부 이메일 연결을 안내합니다. 도메인만 연결해도 공개 화면은 운영할 수 있지만, 관리자·DB 접수 기능의 정식 운영에는 아래 서버 또는 WordPress 설치가 필요합니다.

운영 기능은 Node 24 서버 + SQLite로 구현되어 있습니다. 별도 외부 DB 가입 없이 기사·발행호·홈페이지 편집·개인 및 기관 구독·광고문의·사진 업로드·예약발행을 관리합니다. ChemiCloud로 이전할 때는 동봉된 WordPress 테마·플러그인과 공개 콘텐츠 JSON 가져오기를 사용합니다. WordPress 설치에는 Node 서버가 필요하지 않습니다.

## 로컬 실행

Node.js 24.11 이상을 설치한 환경에서:

```sh
npm ci
cp .env.example .env
npm run check
npm test
npm run build
npm run init-admin
npm start
```

`.env.example`을 참고하여 실제 서버의 환경변수를 지정합니다. `.env` 파일을 사용할 때는 `node --env-file=.env server/index.mjs`로 시작합니다. 비밀번호는 CLI의 비공개 입력을 사용합니다. 환경변수·비밀번호·DB·구독자 데이터는 GitHub에 올리지 않습니다.

공개 화면: http://localhost:4173/ / 관리자: http://localhost:4173/admin/

운영 서버의 데이터 디렉터리를 영속 디스크에 보관하고, 외부 HTTPS 프록시와 환경변수를 설정해야 합니다. ChemiCloud의 Node 지원 버전은 실제 cPanel에서 확인해야 합니다. Node 24가 없다면 Node 서버 대신 제공된 WordPress 패키지를 사용합니다.

## 편집

관리자에서 기사 목록의 새 기사/수정을 선택합니다. 제목·부제·기자·촬영자·카테고리·태그·SEO·발행 상태와 사진 블록을 등록합니다. 업로드한 JPEG/PNG/WebP는 웹용 WebP 크기별 파일로 변환됩니다. 사진 블록은 전체폭, 2장, 3장, 모자이크, 가로 스트립, 인물, 겹침, 텍스트/사진 조합을 지원합니다.

홈페이지 Hero·추천기사·섹션 순서·가격·SNS·발행정보는 설정에서 바꿉니다. 구독/문의는 관리자 접수 목록에서 상태를 관리합니다. 외부 이메일 알림은 환경변수로 연결하며, 메일 실패로 DB 접수가 사라지지 않습니다. 초기 결제는 운영자가 접수를 확인한 뒤 별도로 안내하는 방식입니다.

## 사진과 초기 기사

8개 기사와 2027년 1월 VOL.01은 **창간호 편집 구성 예시**입니다. 허위 인터뷰를 작성하지 않았습니다. 공개 자료 사진은 강진의 기록 사진이며 현재의 촬영을 주장하지 않습니다. 28장 사진의 작성자·원문·라이선스는 `data/image-credits.json`과 공개 사이트의 출처 페이지에 기록됩니다. 실제 취재 기사와 사용 동의를 받은 최신 사진으로 교체하십시오. 폰트는 로컬 Noto Serif KR, SIL Open Font License입니다.

## 배포·도메인·이전

- [GitHub / Cloudflare 도메인 연결](docs/DEPLOYMENT.md)
- [ChemiCloud WordPress 이전](docs/WORDPRESS.md)
- [구현 및 검증 상태](docs/RELEASE-STATUS.md)

개인정보처리방침·약관·환불/구독해지 안내는 운영 기준의 초안입니다. 발행인·편집인·주소·사업자/정기간행물 등록번호·ISSN·전화번호·개인정보 담당자·보유기간·반품 및 환불 기준을 실제 정보로 확정하고 출시 전 검토해야 합니다. PG·카카오 JavaScript 키·SNS URL·분석/검색 인증은 계약 또는 실제 계정 값이 있을 때 연결합니다.
