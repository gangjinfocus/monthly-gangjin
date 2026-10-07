<?php
defined('ABSPATH') || exit;
get_header();
$route = get_query_var('mg_route');
if ($route) {
    require get_stylesheet_directory() . '/templates/routes.php';
} elseif (is_singular('post')) {
    while (have_posts()) { the_post(); $meta = mg_theme_meta(get_post()); $categories = get_the_category(); ?>
    <article class="article-page"><header class="article-heading" data-reveal><div class="article-topline"><?php if ($categories) { ?><a href="<?php echo esc_url(get_category_link($categories[0])); ?>"><?php echo esc_html($categories[0]->name); ?></a><?php } ?><span>MONTHLY GANGJIN</span></div><h1><?php the_title(); ?></h1><p class="article-subtitle"><?php echo esc_html(get_the_excerpt()); ?></p><div class="article-byline"><span>글 <?php echo esc_html($meta['author'] ?? '월간강진 편집부'); if (!empty($meta['photographer'])) echo ' · 사진 ' . esc_html($meta['photographer']); ?></span><time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('Y.m.d')); ?></time></div><?php if (!empty($meta['isDemo'])) { ?><p class="demo-note">편집·디자인 시연을 위한 예시 기사입니다. 실제 인터뷰나 취재 보도가 아닙니다. 사진은 대표 이미지입니다.</p><?php } ?></header><figure class="article-lead-photo"><?php echo mg_theme_image(mg_theme_photo(get_post()), get_the_title(), 'fetchpriority="high" decoding="async"'); if (!empty($meta['images'][0]['credit'])) echo '<figcaption>© ' . esc_html($meta['images'][0]['credit']) . '</figcaption>'; ?></figure><div class="article-body"><?php the_content(); ?></div><footer class="article-bottom"><div class="article-tags"><?php foreach (get_the_tags() ?: array() as $tag) echo '<a href="' . esc_url(mg_theme_url('search/?q=' . rawurlencode($tag->name))) . '">#' . esc_html($tag->name) . '</a>'; ?></div><div class="share-row"><span>이 이야기를 나누세요</span><button type="button" data-share="native" data-title="<?php echo esc_attr(get_the_title()); ?>">공유하기 ↗</button><button type="button" data-share="copy">링크 복사</button><span role="status" data-share-status></span></div></footer></article>
    <?php $related = get_posts(array('post_type' => 'post','post_status' => 'publish','post__not_in' => array(get_the_ID()),'numberposts' => 3)); ?><section class="section"><div class="section-heading"><h2>함께 읽을 <em>이야기</em></h2></div><?php mg_theme_cards($related); ?></section><?php }
} elseif (is_singular('mg_issue')) {
    while (have_posts()) { the_post(); require get_stylesheet_directory() . '/templates/issue.php'; }
} elseif (is_home() || is_front_page()) {
    require get_stylesheet_directory() . '/templates/home.php';
} elseif (is_category() || is_tag() || is_archive() || is_search()) {
    mg_theme_page_heading('OUR STORIES', is_search() ? '검색: ' . get_search_query() : single_term_title('', false), is_category() ? wp_strip_all_tags(category_description()) : '');
    echo '<section class="section listing-section">';
    if (have_posts()) { global $wp_query; mg_theme_cards($wp_query->posts); echo '<nav class="mg-native-pagination" aria-label="목록 페이지">' . wp_kses_post(get_the_posts_pagination()) . '</nav>'; } else echo '<p>아직 공개된 이야기가 없습니다.</p>';
    echo '</section>';
} elseif (is_page()) {
    while (have_posts()) { the_post(); mg_theme_page_heading('MONTHLY GANGJIN', get_the_title()); echo '<section class="section mg-native-content">'; the_content(); echo '</section>'; }
} else {
    echo '<section class="not-found">' . mg_theme_eyebrow('404 / A PAGE NOT FOUND') . '<h1>잠시 길을<br><em>벗어났네요.</em></h1><p>페이지가 옮겨졌거나 공개되지 않았습니다.</p>' . mg_theme_button('첫 페이지로 돌아가기', '', 'dark') . '</section>';
}
get_footer();
