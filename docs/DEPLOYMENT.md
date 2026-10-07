# GitHub와 도메인 연결

계정 `gangjinfocus`, 저장소 `monthly-gangjin`. 이메일 `gjfnews365@gmail.com`은 도메인이 아닙니다. 대표 도메인은 `gangjinmag.com`이며 Cloudflare에 등록되어 있습니다.

## GitHub Pages

`main`에 푸시하면 `.github/workflows/pages.yml`이 구문·테스트·의존성 취약점·WordPress PHP 문법을 확인하고 공개 사이트를 빌드/배포합니다. Pages 소스는 GitHub Actions입니다. 대표 URL은 `https://gangjinmag.com/`입니다. 기존 GitHub Pages 주소는 맞춤 도메인으로 이동합니다. 워크플로 성공과 공개 페이지 응답을 함께 확인하십시오.

정적 미리보기에는 DB 서버가 없습니다. 실제 DB 접수를 사용하려면 HTTPS API 서버와 `PUBLIC_API_BASE` 및 서버의 허용 Origin을 설정하고 재배포해야 합니다. 문의·관리자는 실제 운영 서버 또는 WordPress에서 동작합니다.

## Cloudflare에서 GitHub 도메인 연결

실제 도메인을 소유한 뒤, GitHub Settings → Pages → Custom domain에 대표 주소를 먼저 설정합니다. 저장소 Actions Variables를 다음처럼 지정합니다.

| 변수 | 값 |
|---|---|
| CUSTOM_DOMAIN | `gangjinmag.com` |
| SITE_URL | `https://gangjinmag.com` |
| BASE_PATH | `/` |
| PUBLIC_API_BASE | 운영 API 전체 주소. 없으면 비워두기 |

현재 설정은 `node scripts/github-ops.mjs pages`로 확인합니다. 인증서가 발급되면 `node scripts/github-ops.mjs enforce-https`로 HTTPS를 강제합니다.

재배포하면 도메인 경로에 맞는 기사·이미지·canonical·sitemap을 생성합니다. DNS만 변경하고 경로 설정을 빠뜨리지 마십시오.

Cloudflare DNS 값은 GitHub 공식 문서 기준입니다.

| 이름 | 타입 | 값 |
|---|---|---|
| @ | A | 185.199.108.153 |
| @ | A | 185.199.109.153 |
| @ | A | 185.199.110.153 |
| @ | A | 185.199.111.153 |
| www | CNAME | gangjinfocus.github.io |

초기 DNS 확인과 GitHub 인증서 발급 동안 DNS only를 사용합니다. GitHub 인증서 발급 뒤 Enforce HTTPS를 켜고 대표 도메인과 www 이동을 확인합니다. 도메인 소유 검증의 TXT 값은 실제 GitHub 계정 화면에서 제공되는 고유 값을 사용하며 임의로 만들지 않습니다. 이메일의 MX/TXT는 변경하지 않습니다. 개인정보를 저장하는 API와 관리자는 HTTPS를 필수로 사용합니다.

GitHub 공식 근거: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## ChemiCloud 이전

정식 운영을 WordPress로 옮길 때는 `WORDPRESS.md`대로 별도 검증 설치에 테마·플러그인·공개 콘텐츠를 넣고, 접수 DB와 관리자 기능을 확인합니다. 실제 ChemiCloud 서비스의 cPanel → General Information에 표시된 서버 IP를 사용합니다. 현재 대상 서비스/도메인이 미정이므로 ChemiCloud A 레코드 IP를 임의로 안내하지 않습니다.

Cloudflare @/www를 해당 서비스 IP로 변경하고 SSL/리디렉션·기사 주소·이미지·검색·실제 테스트 접수·관리자 조회를 확인한 뒤 전환합니다. Full (strict)는 유효한 원본 인증서가 설치된 이후 사용합니다. 기존 GitHub 사이트의 `/monthly-gangjin/` 경로를 공개 링크로 사용했다면 새 주소로의 이동 안내도 마련합니다.

ChemiCloud 고객 계정은 `https://chemicloud.com/clientarea.php`, WordPress 관리자는 기존 cPanel WP Toolkit / Softaculous SSO를 사용합니다. 기존 다른 사이트를 덮어쓰지 않습니다.

Node 서버를 먼저 사용할 경우 실제 계정에서 Node 24 및 영속 디스크 사용 가능 여부를 확인합니다. https://chemicloud.com/kb/article/how-to-set-up-node-js-application-in-cpanel/
