<?php
defined('ABSPATH') || exit;
add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', array('search-form','gallery','caption','style','script','navigation-widgets'));
    add_theme_support('responsive-embeds');
    add_theme_support('align-wide');
    add_theme_support('editor-styles');
    add_editor_style(array('fonts/fonts.css','assets/site.css','assets/wordpress.css'));
});
add_action('wp_enqueue_scripts', function () {
    $version = wp_get_theme()->get('Version');
    wp_enqueue_style('mg-fonts', get_stylesheet_directory_uri() . '/fonts/fonts.css', array(), $version);
    wp_enqueue_style('mg-site', get_stylesheet_directory_uri() . '/assets/site.css', array('mg-fonts'), $version);
    wp_enqueue_style('mg-wordpress', get_stylesheet_directory_uri() . '/assets/wordpress.css', array('mg-site'), $version);
    wp_enqueue_script('mg-site', get_stylesheet_directory_uri() . '/assets/site.js', array(), $version, array('strategy' => 'defer', 'in_footer' => true));
});

function mg_theme_settings() { return function_exists('mg_settings') ? mg_settings() : array('name' => '월간강진','englishName' => 'MONTHLY GANGJIN','tagline' => '강진을 더 깊이, 일상을 더 가까이.','email' => 'gjfnews365@gmail.com','heroArticleIds' => array(),'featuredArticleIds' => array(),'footer' => array(),'social' => array()); }
function mg_theme_url($path = '') { return home_url('/' . ltrim($path, '/')); }
function mg_theme_image($src, $alt, $attrs = '') {
    if (is_array($src)) { $alt = $src['alt'] ?? $alt; $src = $src['src'] ?? ''; }
    if (!$src) return '<div class="image-missing" role="img" aria-label="사진 준비 중">사진 준비 중</div>';
    if (function_exists('mg_safe_image_url')) $src = mg_safe_image_url($src);
    if (!$src) return '';
    return '<img src="' . esc_url($src) . '" alt="' . esc_attr($alt) . '" ' . $attrs . '>';
}
function mg_theme_meta($post) { return get_post_meta($post->ID, '_mg_article', true) ?: array(); }
function mg_theme_photo($post) { $meta = mg_theme_meta($post); return get_the_post_thumbnail_url($post, 'full') ?: ($meta['primaryImage'] ?? ''); }
function mg_theme_wordmark() { $settings = mg_theme_settings(); return '<a class="wordmark" href="' . esc_url(home_url('/')) . '" aria-label="' . esc_attr($settings['name']) . ' 홈"><span class="wordmark-ko">' . esc_html($settings['name']) . '</span><span class="wordmark-en">MONTHLY GANGJIN <span>—</span> CULTURE &amp; LIFE</span></a>'; }
function mg_theme_eyebrow($label) { return '<div class="eyebrow"><span></span>' . esc_html($label) . '</div>'; }
function mg_theme_button($label, $path, $class = '') { return '<a class="button ' . esc_attr($class) . '" href="' . esc_url(mg_theme_url($path)) . '">' . esc_html($label) . ' <span aria-hidden="true">↗</span></a>'; }
function mg_theme_page_heading($label, $title, $description = '') { echo '<header class="page-heading" data-reveal>' . mg_theme_eyebrow($label) . '<h1>' . esc_html($title) . '</h1>' . ($description ? '<p>' . esc_html($description) . '</p>' : '') . '</header>'; }
function mg_theme_card($post, $index = 0) {
    $meta = mg_theme_meta($post); $categories = get_the_category($post->ID); $category = $categories ? $categories[0] : null;
    echo '<article class="story-card" data-reveal><a class="card-photo" href="' . esc_url(get_permalink($post)) . '" aria-label="' . esc_attr(get_the_title($post)) . '">' . mg_theme_image(mg_theme_photo($post), get_the_title($post), 'loading="lazy" decoding="async"');
    if (!empty($meta['secondaryImage'])) echo mg_theme_image($meta['secondaryImage'], get_the_title($post), 'class="alternate-photo" loading="lazy" decoding="async"');
    echo '<span class="photo-arrow" aria-hidden="true">↗</span></a><div class="card-meta">' . ($category ? '<a href="' . esc_url(get_category_link($category)) . '">' . esc_html($category->name) . '</a>' : '<span>강진 이야기</span>') . '<span>' . esc_html(str_pad($index + 1, 2, '0', STR_PAD_LEFT)) . '</span></div><h3><a href="' . esc_url(get_permalink($post)) . '">' . esc_html(get_the_title($post)) . '</a></h3><p>' . esc_html($post->post_excerpt) . '</p><div class="byline">' . esc_html($meta['author'] ?? '월간강진 편집부') . ' <span>·</span> ' . esc_html(get_the_date('Y.m.d', $post)) . '</div></article>';
}
function mg_theme_cards($posts, $class = '') { echo '<div class="story-grid ' . esc_attr($class) . '">'; foreach ($posts as $index => $post) mg_theme_card($post, $index); echo '</div>'; }
function mg_theme_selected_posts($ids, $fallback, $limit) {
    $selected = array();
    foreach ($ids as $id) {
        $posts = get_posts(array('post_type' => 'post', 'post_status' => 'publish', 'meta_key' => '_mg_source_id', 'meta_value' => $id, 'numberposts' => 1));
        if (!$posts && preg_match('/^wp-([0-9]+)$/', $id, $match)) { $native = get_post((int) $match[1]); if ($native && $native->post_type === 'post' && $native->post_status === 'publish') $posts = array($native); }
        if ($posts) $selected[] = $posts[0];
    }
    return array_slice($selected ?: $fallback, 0, $limit);
}

add_filter('document_title_parts', function ($parts) {
    $route = get_query_var('mg_route');
    $titles = array('archive' => '지난 호', 'subscribe' => '정기 구독', 'institutions' => '기관 구독', 'advertise' => '광고·협업', 'about' => '매거진 소개', 'search' => '이야기 찾기', 'contact' => '문의하기', 'policy' => '정책 안내', 'credits' => '사진 출처와 라이선스');
    if ($route && isset($titles[$route])) $parts['title'] = $titles[$route];
    if (is_singular('post')) { $meta = mg_theme_meta(get_post()); if (!empty($meta['seo']['title'])) $parts['title'] = $meta['seo']['title']; }
    $parts['site'] = mg_theme_settings()['name']; return $parts;
});
add_filter('wp_robots', function ($robots) { if (get_query_var('mg_route') === 'search' || is_search()) { $robots['noindex'] = true; unset($robots['max-image-preview']); } return $robots; });
add_action('wp_head', function () {
    $settings = mg_theme_settings(); $description = $settings['tagline']; $image = '';
    global $wp;
    $canonical = is_singular() ? get_permalink() : home_url('/' . ($wp->request ?? '') . (empty($wp->request) ? '' : '/'));
    if (is_singular('post')) { $meta = mg_theme_meta(get_post()); $description = $meta['seo']['description'] ?? get_the_excerpt(); $image = mg_theme_photo(get_post()); }
    if (is_category()) $description = wp_strip_all_tags(category_description());
    if (!is_singular()) echo '<link rel="canonical" href="' . esc_url($canonical) . '">';
    echo '<meta name="description" content="' . esc_attr($description) . '"><meta property="og:locale" content="ko_KR"><meta property="og:title" content="' . esc_attr(wp_get_document_title()) . '"><meta property="og:description" content="' . esc_attr($description) . '"><meta property="og:url" content="' . esc_url($canonical) . '"><meta property="og:type" content="' . (is_singular('post') ? 'article' : 'website') . '"><meta name="twitter:card" content="summary_large_image">';
    if ($image) echo '<meta property="og:image" content="' . esc_url($image) . '">';
    $schema = array('@context' => 'https://schema.org', '@type' => 'Organization', 'name' => $settings['name'], 'url' => home_url('/'), 'email' => $settings['email']);
    if (is_singular('post')) $schema = array('@context' => 'https://schema.org', '@type' => 'Article', 'headline' => get_the_title(), 'description' => $description, 'datePublished' => get_the_date('c'), 'dateModified' => get_the_modified_date('c'), 'author' => array('@type' => 'Person', 'name' => $meta['author'] ?? $settings['name']), 'publisher' => array('@type' => 'Organization', 'name' => $settings['name']), 'mainEntityOfPage' => $canonical, 'image' => $image ? array($image) : array());
    echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) . '</script>';
});

// Decorate native Gutenberg output for the shared magazine layout and gallery without replacing editor content.
add_filter('render_block', function ($html, $block) {
    if (is_admin()) return $html;
    if (in_array($block['blockName'], array('core/paragraph','core/heading','core/quote'), true)) {
        $processor = new WP_HTML_Tag_Processor($html);
        if ($processor->next_tag()) $processor->add_class('prose');
        return $processor->get_updated_html();
    }
    if ($block['blockName'] === 'core/group' && preg_match('/\bmg-layout-(image|pair|trio|mosaic|strip|portrait|full|overlap|split)\b/', $block['attrs']['className'] ?? '', $match)) {
        $processor = new WP_HTML_Tag_Processor($html);
        if ($processor->next_tag()) { $processor->add_class('article-images'); $processor->add_class('layout-' . $match[1]); }
        return $processor->get_updated_html();
    }
    if ($block['blockName'] === 'core/image' && !preg_match('~<a\b[^>]*>\s*<img\b~i', $html)) {
        $processor = new WP_HTML_Tag_Processor($html);
        if ($processor->next_tag('IMG')) {
            $src = $processor->get_attribute('src'); $alt = $processor->get_attribute('alt') ?: '';
            if ($src) {
                $caption = ''; if (preg_match('/<figcaption[^>]*>(.*?)<\/figcaption>/is', $html, $match)) $caption = wp_strip_all_tags($match[1]);
                $html = preg_replace_callback('/<img\b[^>]*>/i', function ($match) use ($src, $alt, $caption) { return '<button type="button" class="gallery-trigger" data-gallery-src="' . esc_url($src) . '" data-gallery-alt="' . esc_attr($alt) . '" data-gallery-caption="' . esc_attr($caption) . '" aria-label="사진 크게 보기: ' . esc_attr($alt) . '">' . $match[0] . '<span class="enlarge" aria-hidden="true">+</span></button>'; }, $html, 1);
            }
        }
    }
    return $html;
}, 10, 2);
