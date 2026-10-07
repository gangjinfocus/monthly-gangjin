<?php
defined('ABSPATH') || exit;
$settings = mg_theme_settings();
if (in_array($route, array('subscribe','institutions','advertise','contact'), true)) {
    require get_stylesheet_directory() . '/templates/forms.php';
} elseif ($route === 'archive') {
    mg_theme_page_heading('THE ARCHIVE', '시간을 모은 책장.', '한 달씩 쌓아온 우리의 기록, 다시 펼쳐보세요.');
    $issues = get_posts(array('post_type' => 'mg_issue','post_status' => 'publish','numberposts' => -1));
    usort($issues, function ($a, $b) { return strcmp((get_post_meta($b->ID, '_mg_issue', true)['month'] ?? ''), (get_post_meta($a->ID, '_mg_issue', true)['month'] ?? '')); });
    echo '<section class="section"><div class="archive-grid">';
    foreach ($issues as $post) { $issue = get_post_meta($post->ID, '_mg_issue', true) ?: array(); ?>
    <article class="archive-card" data-reveal><a href="<?php echo esc_url(get_permalink($post)); ?>"><?php echo mg_theme_image($issue['cover'] ?? get_the_post_thumbnail_url($post, 'full'), get_the_title($post) . ' 표지', 'loading="lazy"'); ?><span class="archive-spine">MONTHLY GANGJIN</span></a><div class="card-meta"><span>VOL. <?php echo esc_html($issue['volume'] ?? ''); ?></span><span><?php echo esc_html($issue['month'] ?? ''); ?></span></div><h2><a href="<?php echo esc_url(get_permalink($post)); ?>"><?php echo esc_html(get_the_title($post)); ?></a></h2><p><?php echo esc_html($post->post_excerpt); ?></p><?php if (!empty($issue['isDemo'])) echo '<small>시연용 호</small>'; ?></article>
    <?php } if (!$issues) echo '<p>아직 공개된 호가 없습니다.</p>'; echo '</div></section>';
} elseif ($route === 'search') {
    $articles = get_posts(array('post_type' => 'post','post_status' => 'publish','numberposts' => -1));
    $categories = get_categories(array('hide_empty' => false,'exclude' => (int) get_option('default_category')));
    mg_theme_page_heading('FIND YOUR STORY', '어떤 강진을 찾으세요?'); ?>
    <section class="section search-section"><form class="search-form" role="search" data-search><label class="sr-only" for="story-search">이야기 검색</label><input id="story-search" name="q" type="search" maxlength="100" placeholder="이야기, 사람, 장소를 검색하세요" autocomplete="off"><button type="submit" aria-label="검색">↗</button></form><div class="search-filters" role="group" aria-label="카테고리 필터"><button type="button" class="active" data-filter="all" aria-pressed="true">전체</button><?php foreach ($categories as $category) echo '<button type="button" data-filter="' . esc_attr($category->slug) . '" aria-pressed="false">' . esc_html($category->name) . '</button>'; ?></div><p class="search-count" role="status" aria-live="polite" data-search-count>이야기 <?php echo count($articles); ?>편</p><div class="story-grid" data-search-results><?php foreach ($articles as $index => $post) { $meta = mg_theme_meta($post); $cats = get_the_category($post->ID); $tags = wp_get_post_tags($post->ID, array('fields' => 'names')); $keywords = array_merge(array(get_the_title($post),$post->post_excerpt,$meta['author'] ?? ''),$tags,$meta['people'] ?? array(),$meta['places'] ?? array()); ?><div data-search-item data-category="<?php echo esc_attr($cats ? $cats[0]->slug : ''); ?>" data-keywords="<?php echo esc_attr(implode(' ', $keywords)); ?>"><?php mg_theme_card($post, $index); ?></div><?php } ?></div><div class="search-empty" hidden data-search-empty><h2>아직 만나지 못한 이야기예요.</h2><p>다른 단어나 카테고리로 다시 찾아보세요.</p><button type="button" data-search-reset>전체 이야기 보기 →</button></div></section>
    <?php
} elseif ($route === 'about') {
    mg_theme_page_heading('ABOUT THE MAGAZINE', '가까이 바라보고, 오래 기록합니다.', '강진의 속도로 읽는 지역 문화 매거진.');
    $page = get_page_by_path('about');
    if ($page && $page->post_status === 'publish') { echo '<section class="section mg-native-content">' . apply_filters('the_content', $page->post_content) . '</section>'; }
    else { $photo = get_posts(array('post_type' => 'post','post_status' => 'publish','numberposts' => 1)); ?>
    <?php if ($photo) echo '<section class="about-photo">' . mg_theme_image(mg_theme_photo($photo[0]), '강진의 일상을 담은 대표 풍경', 'loading="lazy"') . '</section>'; ?>
    <section class="section about-manifesto"><span>OUR PHILOSOPHY</span><div><h2>지역에는 아직<br><em>읽지 않은 이야기가 많습니다.</em></h2><p>익숙한 골목을 낯설게 바라보고, 쉽게 지나치는 일상에서 가치를 발견합니다. 월간강진은 지역의 사람과 문화, 삶의 공간을 정성껏 기록합니다.</p><p>빠르게 흘러가는 소식 사이에서 잠시 멈춰 읽는 한 권. 지역을 방문하는 사람에게는 새로운 길이 되고, 이곳에 사는 사람에게는 자기 동네를 다시 만나는 시간이 되기를 바랍니다.</p><div class="values-grid"><div><b>01</b><h3>사람을 먼저</h3><p>이야기의 중심에는 언제나 사람이 있습니다.</p></div><div><b>02</b><h3>천천히, 깊게</h3><p>지역의 맥락과 시간을 함께 바라봅니다.</p></div><div><b>03</b><h3>함께 만드는 기록</h3><p>독자의 시선과 지역의 목소리를 담습니다.</p></div></div><?php echo mg_theme_button('편집부에 이야기 전하기', 'contact/', 'dark'); ?></div></section>
    <?php }
} elseif ($route === 'credits') {
    mg_theme_page_heading('PHOTO CREDITS', '사진 출처와 라이선스', '사진은 예시 기사의 대표 이미지입니다. 크기 조절·WebP 변환이 적용되었습니다.');
    echo '<section class="section policy-content">';
    foreach (get_option('mg_image_credits', array()) as $image) {
        echo '<h2>' . esc_html($image['alt'] ?? '') . '</h2><p>' . esc_html($image['credit'] ?? '') . ' · ' . esc_html($image['license'] ?? '') . '</p><p>';
        if (!empty($image['source'])) echo '<a href="' . esc_url($image['source']) . '" target="_blank" rel="noopener noreferrer">원본 출처 ↗</a> ';
        if (!empty($image['licenseUrl'])) echo '<a href="' . esc_url($image['licenseUrl']) . '" target="_blank" rel="noopener noreferrer">라이선스 ↗</a>';
        echo '</p>';
    }
    echo '</section>';
} elseif ($route === 'policy') {
    $policy = get_query_var('mg_policy');
    $policies = array(
        'privacy' => array('개인정보 처리방침', array('수집 목적과 항목' => '구독·기관·광고 신청 및 문의 응대를 위해 각 양식의 이름, 연락처, 이메일, 배송 주소와 신청 내용을 동의 후 수집합니다. 수집 정보는 공개 콘텐츠와 분리된 비공개 접수함에 저장되며 관리자만 열람합니다.', '보유 기간과 삭제' => '처리 완료·종료 상태의 접수 정보는 마지막 상태 변경일부터 1년 뒤 정기 삭제 대상으로 처리합니다. 신규·확인 중 접수는 담당자가 처리 후 상태를 갱신해야 합니다. 백업의 보관·폐기 주기는 운영자가 별도로 관리합니다.', '제공·위탁과 권리 행사' => '배송·결제·이메일 위탁 업체와 법적 운영 주체는 실제 서비스 개시 전에 확정하여 공개합니다. 개인정보 열람·정정·삭제·동의 철회는 편집부 이메일로 요청할 수 있습니다.', '접속과 보안' => '문의는 HTTPS를 사용하는 실제 운영 사이트에서 접수합니다. 과도한 요청을 제한하기 위해 서버가 확인한 IP를 짧은 시간의 해시로 처리하며 원본 IP를 접수함에 저장하지 않습니다. 관리자 인증은 WordPress 쿠키와 권한 체계를 사용합니다.')),
        'terms' => array('이용약관', array('서비스의 범위' => '월간강진은 지역 문화와 생활 기사, 발행 호 안내, 구독 및 협업 상담을 제공합니다. 예시 표시가 있는 기사와 호는 실제 보도·발행물과 구분됩니다.', '콘텐츠 이용' => '기사와 사진의 저작권 및 라이선스를 존중해 주세요. 외부 출처 사진은 각 이미지 출처와 라이선스를 따릅니다. 상업적 재이용·재배포는 편집부와 협의해 주세요.', '신청과 계약' => '양식 접수는 구매 계약이나 결제 완료를 의미하지 않습니다. 실제 가격·일정·배송·판매 조건은 편집부 확인 후 안내합니다.')),
        'email' => array('이메일 무단수집 거부', array('이메일 주소 이용' => '게시된 이메일은 구독 상담·취재 제안·협업을 위해 제공합니다. 자동 수집 도구를 통한 무단 수집과 원치 않는 광고 전송을 거부합니다.', '문의 목적의 연락' => '발신자와 연락 목적을 명확히 적어 편집부 이메일로 연락해 주세요.')),
        'subscription' => array('구독 안내', array('신청과 배송' => '신청 접수 후 편집부가 시작 호·기간·배송지와 결제 방법을 확인합니다. 결제와 발송이 확정된 뒤 구독이 시작됩니다. 이 사이트의 양식은 결제를 진행하지 않습니다.', '가격과 발행 일정' => '단권·정기구독 가격, 배송비·발행일·품절 여부는 운영자가 확정한 정보를 기준으로 안내합니다. 예시 호는 판매용 발행물을 의미하지 않습니다.', '배송지 변경과 기관 구독' => '다음 발송 전 편집부 이메일로 배송지 변경을 요청해 주세요. 다수 부수·견적서·기관 배송은 기관 구독 상담을 이용해 주세요.')),
        'refund' => array('취소·환불 안내', array('취소 요청' => '편집부 이메일로 신청자 이름과 구독 정보를 보내주세요. 민감한 결제정보는 이메일에 적지 마세요. 결제·배송 상태를 확인한 뒤 취소를 처리합니다.', '발송과 파손' => '발송 전 취소·배송 후 반품·미배송 호의 구독 해지는 실제 판매 조건과 적용 법령을 기준으로 안내합니다. 파손·오배송은 상태를 확인할 수 있는 사진과 배송 정보를 보내주세요.', '운영 전 확인 사항' => '환불 계산·반품 주소·배송 비용·환급 기간은 실제 판매 정책을 확정한 후 명시합니다. 이 사이트에는 결제 기능이 없습니다.')),
    );
    if (isset($policies[$policy])) {
        mg_theme_page_heading('INFORMATION', $policies[$policy][0]);
        echo '<section class="section policy-content">';
        $page = get_page_by_path('policies/' . $policy);
        if ($page && $page->post_status === 'publish') echo apply_filters('the_content', $page->post_content);
        else { echo '<div class="policy-notice"><b>운영 준비 단계의 안내 문안</b><p>법적 운영 주체·위탁업체·등록 정보·시행일과 실제 판매 정책은 서비스 개시 전에 운영자가 확정해야 합니다.</p></div>'; $index = 0; foreach ($policies[$policy][1] as $title => $body) echo '<h2>' . ++$index . '. ' . esc_html($title) . '</h2><p>' . esc_html($body) . '</p>'; }
        echo '<div class="policy-contact"><span>편집부 문의</span><a href="mailto:' . esc_attr($settings['email']) . '">' . esc_html($settings['email']) . '</a></div><nav aria-label="정책 안내">';
        foreach ($policies as $slug => $definition) echo '<a href="' . esc_url(mg_theme_url('policies/' . $slug . '/')) . '">' . esc_html($definition[0]) . '</a>';
        echo '</nav></section>';
    }
}
