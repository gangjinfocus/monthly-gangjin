<?php
defined('ABSPATH') || exit;

function mg_settings() {
    return array_merge(array('name' => '월간강진', 'englishName' => 'MONTHLY GANGJIN', 'tagline' => '강진의 사람, 공간, 삶을 기록합니다.', 'email' => 'gjfnews365@gmail.com', 'singlePrice' => 10000, 'annualPrice' => 100000, 'heroArticleIds' => array(), 'featuredArticleIds' => array(), 'heroImages' => array(), 'sectionOrder' => array(), 'footer' => array(), 'social' => array()), get_option('mg_settings', array()));
}

function mg_safe_image_url($src) {
    if (!is_string($src)) return '';
    if (preg_match('~^/images/([A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:webp|jpe?g|png))$~i', $src, $match)) return get_stylesheet_directory_uri() . '/images/' . $match[1];
    $theme_images = get_stylesheet_directory_uri() . '/images/';
    if (str_starts_with($src, $theme_images) && preg_match('~^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:webp|jpe?g|png)$~i', substr($src, strlen($theme_images)))) return esc_url_raw($src);
    $uploads = wp_upload_dir();
    $parsed = wp_parse_url($src);
    $base = wp_parse_url($uploads['baseurl']);
    if ($parsed && $base && ($parsed['scheme'] ?? '') === ($base['scheme'] ?? '') && ($parsed['host'] ?? '') === ($base['host'] ?? '') && ($parsed['port'] ?? null) === ($base['port'] ?? null) && str_starts_with($parsed['path'] ?? '', rtrim($base['path'] ?? '', '/') . '/') && !isset($parsed['query']) && !isset($parsed['fragment']) && !str_contains(rawurldecode($parsed['path'] ?? ''), '..')) return esc_url_raw($src);
    return '';
}

function mg_import_image($image) {
    if (is_string($image)) $image = array('src' => $image);
    if (!is_array($image) || empty($image['src'])) return array('src' => '', 'alt' => '', 'caption' => '', 'credit' => '');
    $src = (string) $image['src'];
    $clean = array('src' => mg_safe_image_url($src), 'alt' => sanitize_text_field($image['alt'] ?? ''), 'caption' => sanitize_text_field($image['caption'] ?? ''), 'credit' => sanitize_text_field($image['credit'] ?? ''));
    foreach (array('id','license','description') as $field) if (isset($image[$field]) && is_scalar($image[$field])) $clean[$field] = sanitize_text_field($image[$field]);
    foreach (array('source','licenseUrl') as $field) if (isset($image[$field]) && is_scalar($image[$field])) $clean[$field] = esc_url_raw($image[$field], array('https','http'));
    if (!$clean['src']) return new WP_Error('mg_image', '허용되지 않은 이미지 경로입니다. /images/ 아래의 로컬 이미지 또는 현재 사이트의 미디어 URL만 사용하세요.');
    if (!str_starts_with($src, '/images/')) return $clean;
    $existing = get_posts(array('post_type' => 'attachment', 'post_status' => 'inherit', 'meta_key' => '_mg_source_image', 'meta_value' => $src, 'numberposts' => 1));
    if ($existing) {
        $clean['src'] = wp_get_attachment_url($existing[0]->ID);
        return $clean;
    }
    // Read only packaged, local files. No URL downloads, ZIP extraction, or arbitrary filesystem paths.
    $root = realpath(get_stylesheet_directory() . '/images');
    $path = realpath(get_stylesheet_directory() . $src);
    if (!$root || !$path || !str_starts_with($path, $root . DIRECTORY_SEPARATOR) || !is_file($path) || filesize($path) > 12582912) return new WP_Error('mg_image_missing', '테마의 images 폴더에 필요한 이미지가 없거나 너무 큽니다.');
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';
    $checked = wp_check_filetype_and_ext($path, basename($path), array('jpg|jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'));
    if (empty($checked['type']) || !str_starts_with($checked['type'], 'image/')) return new WP_Error('mg_image_type', '지원하지 않는 이미지입니다.');
    $bytes = file_get_contents($path);
    if ($bytes === false) return new WP_Error('mg_image_read', '이미지를 읽을 수 없습니다.');
    $upload = wp_upload_bits(basename($path), null, $bytes);
    if ($upload['error']) return new WP_Error('mg_image_upload', '이미지를 미디어 라이브러리에 저장하지 못했습니다.');
    $attachment = wp_insert_attachment(array('post_mime_type' => $checked['type'], 'post_title' => $clean['alt'] ?: pathinfo($path, PATHINFO_FILENAME), 'post_content' => '', 'post_status' => 'inherit'), $upload['file'], 0, true);
    if (is_wp_error($attachment)) return $attachment;
    wp_update_attachment_metadata($attachment, wp_generate_attachment_metadata($attachment, $upload['file']));
    update_post_meta($attachment, '_mg_source_image', $src);
    update_post_meta($attachment, '_wp_attachment_image_alt', $clean['alt']);
    $clean['src'] = wp_get_attachment_url($attachment);
    return $clean;
}

function mg_find_source_post($type, $id) {
    $items = get_posts(array('post_type' => $type, 'post_status' => array('publish','future','draft','pending','private','trash'), 'meta_key' => '_mg_source_id', 'meta_value' => $id, 'numberposts' => 1));
    return $items ? $items[0]->ID : 0;
}

function mg_content_image_html($image) {
    $caption = trim(($image['caption'] ?? '') . (!empty($image['credit']) ? ' · ' . $image['credit'] : ''));
    $links = (!empty($image['source']) ? ' · <a href="' . esc_url($image['source']) . '" target="_blank" rel="noopener noreferrer">원본</a>' : '') . (!empty($image['licenseUrl']) ? ' · <a href="' . esc_url($image['licenseUrl']) . '" target="_blank" rel="noopener noreferrer">' . esc_html($image['license'] ?? '라이선스') . '</a>' : '');
    return '<!-- wp:image {"sizeSlug":"large"} --><figure class="wp-block-image size-large"><img src="' . esc_url($image['src']) . '" alt="' . esc_attr($image['alt'] ?? '') . '" loading="lazy" decoding="async"/>' . ($caption || $links ? '<figcaption>' . esc_html($caption) . $links . '</figcaption>' : '') . '</figure><!-- /wp:image -->';
}

function mg_blocks_to_content($blocks) {
    $html = '';
    foreach ($blocks as $block) {
        $type = $block['type'] ?? 'paragraph';
        $text = esc_html($block['text'] ?? '');
        if ($type === 'paragraph') $html .= '<!-- wp:paragraph --><p>' . $text . '</p><!-- /wp:paragraph -->';
        elseif ($type === 'heading') $html .= '<!-- wp:heading --><h2 class="wp-block-heading">' . $text . '</h2><!-- /wp:heading -->';
        elseif ($type === 'quote') $html .= '<!-- wp:quote --><blockquote class="wp-block-quote"><!-- wp:paragraph --><p>' . $text . '</p><!-- /wp:paragraph --></blockquote><!-- /wp:quote -->';
        else {
            $inner = '';
            foreach ($block['images'] ?? array() as $image) $inner .= mg_content_image_html($image);
            $class = 'mg-layout mg-layout-' . $type . ' image-layout layout-' . $type;
            $html .= '<!-- wp:group ' . wp_json_encode(array('className' => $class, 'layout' => array('type' => 'default'))) . ' --><div class="wp-block-group ' . esc_attr($class) . '">' . $inner . ($text ? '<!-- wp:paragraph --><p>' . $text . '</p><!-- /wp:paragraph -->' : '') . '</div><!-- /wp:group -->';
        }
    }
    return $html;
}

function mg_validate_content($data) {
    if (!is_array($data) || ($data['version'] ?? 0) !== 1 || !is_array($data['articles'] ?? null) || !is_array($data['categories'] ?? null) || !is_array($data['issues'] ?? null)) return new WP_Error('mg_format', 'version 1 콘텐츠 JSON이 필요합니다.');
    if (count($data['articles']) > 5000 || count($data['issues']) > 1000) return new WP_Error('mg_size', '한 번에 가져올 수 있는 콘텐츠 수를 초과했습니다.');
    $ids = array(); $slugs = array();
    foreach (array_merge($data['articles'], $data['issues']) as $item) {
        if (!is_array($item) || !is_string($item['id'] ?? null) || !preg_match('/^[a-zA-Z0-9_-]{1,100}$/', $item['id']) || empty($item['title'])) return new WP_Error('mg_item', '콘텐츠의 id와 제목을 확인해 주세요.');
        if (isset($ids[$item['id']])) return new WP_Error('mg_duplicate', '콘텐츠 id가 중복됩니다.');
        $ids[$item['id']] = true;
    }
    foreach ($data['articles'] as $item) {
        $slug = $item['slug'] ?? '';
        if (!is_string($slug) || !preg_match('/^[a-z0-9][a-z0-9-]{0,190}$/', $slug) || isset($slugs[$slug])) return new WP_Error('mg_slug', '글의 slug가 잘못되었거나 중복됩니다.');
        $slugs[$slug] = true;
        if (!in_array($item['status'] ?? '', array('published','draft','scheduled'), true)) return new WP_Error('mg_status', '발행 상태를 확인해 주세요.');
        $date = $item['status'] === 'scheduled' ? ($item['publishAt'] ?? '') : ($item['date'] ?? '');
        if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}(?:T[0-9:.+-]+Z?)?$/', $date) || strtotime($date) === false) return new WP_Error('mg_date', '발행 일시를 확인해 주세요.');
        if (!is_array($item['blocks'] ?? null)) return new WP_Error('mg_blocks', '본문 블록이 필요합니다.');
        foreach ($item['blocks'] as $block) {
            if (!is_array($block) || !in_array($block['type'] ?? '', array('paragraph','heading','quote','image','pair','trio','mosaic','strip','portrait','full','overlap','split'), true)) return new WP_Error('mg_blocks', '지원하지 않는 본문 블록입니다.');
        }
        $collision = get_page_by_path($slug, OBJECT, 'post');
        if ($collision && get_post_meta($collision->ID, '_mg_source_id', true) !== $item['id']) return new WP_Error('mg_collision', '같은 slug의 다른 WordPress 글이 있습니다. 기존 URL을 먼저 확인해 주세요.');
    }
    foreach ($data['categories'] as $category) {
        if (!is_array($category) || empty($category['name']) || !preg_match('/^[a-z0-9][a-z0-9-]{0,100}$/', $category['slug'] ?? '')) return new WP_Error('mg_category', '분류 이름과 slug를 확인해 주세요.');
    }
    // Validate every image before writing content. Remote hosts and relative traversal fail closed.
    $check = function ($value) use (&$check) {
        if (!is_array($value)) return true;
        foreach ($value as $key => $child) {
            if (in_array($key, array('src','primaryImage','secondaryImage','cover'), true) && is_string($child) && $child !== '' && !mg_safe_image_url($child)) return false;
            if (is_array($child) && !$check($child)) return false;
        }
        return true;
    };
    return $check($data) ? true : new WP_Error('mg_images', '허용되지 않은 이미지 URL이 있습니다. 외부 이미지는 다운로드하지 않습니다.');
}

function mg_import_content($data) {
    if (!current_user_can('manage_options')) return new WP_Error('mg_permission', '관리자 권한이 필요합니다.');
    $validated = mg_validate_content($data);
    if (is_wp_error($validated)) return $validated;
    $category_ids = array();
    foreach ($data['categories'] as $category) {
        $term = get_term_by('slug', $category['slug'], 'category');
        $values = array('slug' => $category['slug'], 'description' => sanitize_textarea_field($category['description'] ?? ''));
        $result = $term ? wp_update_term($term->term_id, 'category', array_merge($values, array('name' => sanitize_text_field($category['name'])))) : wp_insert_term(sanitize_text_field($category['name']), 'category', $values);
        if (is_wp_error($result)) return $result;
        $category_ids[$category['slug']] = (int) $result['term_id'];
    }
    foreach ($data['issues'] as $issue) {
        $cover = mg_import_image($issue['cover'] ?? '');
        if (is_wp_error($cover)) return $cover;
        $id = wp_insert_post(array('ID' => mg_find_source_post('mg_issue', $issue['id']), 'post_type' => 'mg_issue', 'post_title' => sanitize_text_field($issue['title']), 'post_name' => $issue['id'], 'post_content' => '<!-- wp:paragraph --><p>' . esc_html($issue['description'] ?? '') . '</p><!-- /wp:paragraph -->', 'post_excerpt' => sanitize_textarea_field($issue['description'] ?? ''), 'post_status' => 'publish'), true);
        if (is_wp_error($id)) return $id;
        $issue['cover'] = $cover['src'];
        update_post_meta($id, '_mg_source_id', $issue['id']);
        update_post_meta($id, '_mg_issue', $issue);
    }
    $counts = array('published' => 0, 'draft' => 0, 'scheduled' => 0);
    foreach ($data['articles'] as $article) {
        foreach (array('primaryImage','secondaryImage') as $key) {
            $image = mg_import_image($article[$key] ?? '');
            if (is_wp_error($image)) return $image;
            $article[$key] = $image['src'];
        }
        foreach ($article['images'] ?? array() as $index => $image) {
            $image = mg_import_image($image);
            if (is_wp_error($image)) return $image;
            $article['images'][$index] = $image;
        }
        foreach ($article['blocks'] as $index => $block) {
            foreach ($block['images'] ?? array() as $image_index => $image) {
                $image = mg_import_image($image);
                if (is_wp_error($image)) return $image;
                $article['blocks'][$index]['images'][$image_index] = $image;
            }
        }
        $scheduled = $article['status'] === 'scheduled';
        $date_string = $scheduled ? $article['publishAt'] : $article['date'];
        // Date-only publication dates use the WordPress site timezone; ISO datetimes preserve offsets.
        try { $date = new DateTimeImmutable($date_string, wp_timezone()); } catch (Exception $e) { return new WP_Error('mg_date', '발행 일시를 처리할 수 없습니다.'); }
        $gmt = $date->setTimezone(new DateTimeZone('UTC'));
        $status = $article['status'] === 'draft' ? 'draft' : ($scheduled && $gmt->getTimestamp() > time() ? 'future' : 'publish');
        if ($article['status'] === 'published' && $gmt->getTimestamp() > time()) {
            // A future nominal issue date is not a schedule. Keep it separately and preserve
            // the declared published state with a truthful native publication timestamp.
            $article['editorialDate'] = $article['date'];
            $date = new DateTimeImmutable('now', wp_timezone());
            $gmt = $date->setTimezone(new DateTimeZone('UTC'));
        }
        $id = wp_insert_post(array('ID' => mg_find_source_post('post', $article['id']), 'post_type' => 'post', 'post_title' => sanitize_text_field($article['title']), 'post_name' => $article['slug'], 'post_content' => mg_blocks_to_content($article['blocks']), 'post_excerpt' => sanitize_textarea_field($article['subtitle'] ?? ''), 'post_status' => $status, 'post_date' => $date->setTimezone(wp_timezone())->format('Y-m-d H:i:s'), 'post_date_gmt' => $gmt->format('Y-m-d H:i:s'), 'post_category' => isset($category_ids[$article['category']]) ? array($category_ids[$article['category']]) : array()), true);
        if (is_wp_error($id)) return $id;
        wp_set_post_tags($id, array_map('sanitize_text_field', $article['tags'] ?? array()), false);
        update_post_meta($id, '_mg_source_id', $article['id']);
        update_post_meta($id, '_mg_article', $article);
        $attachment = attachment_url_to_postid($article['primaryImage']);
        if ($attachment) set_post_thumbnail($id, $attachment);
        $counts[$status === 'future' ? 'scheduled' : ($status === 'draft' ? 'draft' : 'published')]++;
    }
    if (isset($data['settings']) && is_array($data['settings'])) update_option('mg_settings', mg_clean_settings($data['settings']), false);
    if (isset($data['imageCredits']) && is_array($data['imageCredits'])) {
        $credits = array(); foreach ($data['imageCredits'] as $image) { $image = mg_import_image($image); if (is_wp_error($image)) return $image; $credits[] = $image; }
        update_option('mg_image_credits', $credits, false);
    }
    update_option('mg_last_import', array('at' => current_time('mysql'), 'counts' => $counts), false);
    return $counts;
}

function mg_clean_settings($input) {
    $settings = mg_settings();
    foreach (array('name','englishName','tagline') as $key) if (isset($input[$key]) && is_scalar($input[$key])) $settings[$key] = sanitize_text_field($input[$key]);
    if (isset($input['email']) && is_email($input['email'])) $settings['email'] = sanitize_email($input['email']);
    foreach (array('singlePrice','annualPrice') as $key) if (isset($input[$key]) && is_numeric($input[$key])) $settings[$key] = max(0, (int) $input[$key]);
    foreach (array('heroArticleIds','featuredArticleIds','sectionOrder') as $key) if (isset($input[$key]) && is_array($input[$key])) $settings[$key] = array_values(array_filter(array_map('sanitize_key', $input[$key])));
    if (isset($input['heroImages']) && is_array($input['heroImages'])) $settings['heroImages'] = array_values(array_filter(array_map(function ($image) { return is_array($image) ? array('src' => mg_safe_image_url($image['src'] ?? ''), 'alt' => sanitize_text_field($image['alt'] ?? ''), 'caption' => sanitize_text_field($image['caption'] ?? ''), 'credit' => sanitize_text_field($image['credit'] ?? '')) : mg_safe_image_url($image); }, $input['heroImages'])));
    foreach (array('publisher','editor','address','businessNumber','registrationNumber','issn','phone') as $key) if (isset($input['footer'][$key]) && is_scalar($input['footer'][$key])) $settings['footer'][$key] = sanitize_text_field($input['footer'][$key]);
    foreach (array('instagram','youtube','facebook') as $key) if (isset($input['social'][$key]) && is_scalar($input['social'][$key])) $settings['social'][$key] = esc_url_raw($input['social'][$key], array('https'));
    return $settings;
}

function mg_public_article($post) {
    $article = get_post_meta($post->ID, '_mg_article', true);
    if (!is_array($article)) $article = array();
    $categories = get_the_category($post->ID);
    $article = array_merge($article, array('id' => get_post_meta($post->ID, '_mg_source_id', true) ?: 'wp-' . $post->ID, 'slug' => $post->post_name, 'title' => get_the_title($post), 'subtitle' => $post->post_excerpt, 'category' => $categories ? $categories[0]->slug : '', 'date' => get_post_time('c', false, $post), 'status' => 'published', 'publishAt' => null, 'tags' => wp_get_post_tags($post->ID, array('fields' => 'names'))));
    if (has_post_thumbnail($post)) $article['primaryImage'] = get_the_post_thumbnail_url($post, 'full');
    $article['blocks'] = mg_export_blocks(parse_blocks($post->post_content));
    return $article;
}

function mg_export_blocks($blocks) {
    $result = array();
    foreach ($blocks as $block) {
        $name = $block['blockName'];
        if (in_array($name, array('core/paragraph','core/heading','core/quote'), true)) $result[] = array('type' => $name === 'core/paragraph' ? 'paragraph' : ($name === 'core/heading' ? 'heading' : 'quote'), 'text' => trim(wp_strip_all_tags($name === 'core/quote' ? render_block($block) : $block['innerHTML'])));
        elseif ($name === 'core/image') {
            $src = ''; $alt = ''; $caption = '';
            if (preg_match('/<img[^>]+src="([^"]+)"/i', $block['innerHTML'], $match)) $src = html_entity_decode($match[1], ENT_QUOTES, 'UTF-8');
            if (preg_match('/<img[^>]+alt="([^"]*)"/i', $block['innerHTML'], $match)) $alt = html_entity_decode($match[1], ENT_QUOTES, 'UTF-8');
            if (preg_match('/<figcaption[^>]*>(.*?)<\/figcaption>/is', $block['innerHTML'], $match)) $caption = wp_strip_all_tags($match[1]);
            if ($src) $result[] = array('type' => 'image', 'images' => array(array('src' => $src, 'alt' => $alt, 'caption' => $caption, 'credit' => '')));
        } elseif (!empty($block['innerBlocks'])) {
            $inner = mg_export_blocks($block['innerBlocks']);
            if (preg_match('/\bmg-layout-(image|pair|trio|mosaic|strip|portrait|full|overlap|split)\b/', $block['attrs']['className'] ?? '', $match)) {
                $images = array(); $text = array();
                foreach ($inner as $child) { foreach ($child['images'] ?? array() as $image) $images[] = $image; if (!empty($child['text'])) $text[] = $child['text']; }
                $result[] = array('type' => $match[1], 'images' => $images, 'text' => implode("\n", $text));
            } else $result = array_merge($result, $inner);
        } elseif (trim(wp_strip_all_tags($block['innerHTML']))) $result[] = array('type' => 'paragraph', 'text' => trim(wp_strip_all_tags($block['innerHTML'])));
    }
    return $result;
}

function mg_export_content() {
    $categories = array();
    foreach (get_categories(array('hide_empty' => false)) as $category) $categories[] = array('slug' => $category->slug, 'name' => $category->name, 'description' => $category->description);
    $articles = array_map('mg_public_article', get_posts(array('post_type' => 'post', 'post_status' => 'publish', 'numberposts' => -1, 'orderby' => 'date', 'order' => 'DESC')));
    $public_ids = array_column($articles, 'id');
    $issues = array();
    foreach (get_posts(array('post_type' => 'mg_issue', 'post_status' => 'publish', 'numberposts' => -1)) as $post) {
        $issue = get_post_meta($post->ID, '_mg_issue', true);
        if (!is_array($issue)) $issue = array('id' => $post->post_name, 'volume' => '', 'month' => '', 'cover' => get_the_post_thumbnail_url($post, 'full'), 'articleIds' => array(), 'isDemo' => false);
        $issue['title'] = get_the_title($post); $issue['description'] = $post->post_excerpt;
        $issue['articleIds'] = array_values(array_intersect($issue['articleIds'] ?? array(), $public_ids));
        $issues[] = $issue;
    }
    $settings = mg_settings();
    foreach (array('heroArticleIds','featuredArticleIds') as $key) $settings[$key] = array_values(array_intersect($settings[$key], $public_ids));
    usort($issues, function ($a, $b) { return strcmp($b['month'] ?? '', $a['month'] ?? ''); });
    return array('version' => 1, 'settings' => $settings, 'categories' => $categories, 'articles' => $articles, 'issues' => $issues, 'imageCredits' => get_option('mg_image_credits', array()));
}
