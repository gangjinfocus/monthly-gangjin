<?php
defined('ABSPATH') || exit;

add_action('admin_menu', function () {
    add_menu_page('월간강진 운영', '월간강진 운영', 'manage_options', 'mg-dashboard', 'mg_admin_page', 'dashicons-book-alt', 25);
});

function mg_admin_page() {
    if (!current_user_can('manage_options')) return;
    global $wpdb;
    $settings = mg_settings();
    $tab = sanitize_key($_GET['tab'] ?? 'inquiries');
    echo '<div class="wrap"><h1>월간강진 운영</h1><nav class="nav-tab-wrapper">';
    foreach (array('inquiries' => '접수 관리', 'content' => '콘텐츠 가져오기', 'settings' => '홈·발행 정보') as $key => $label) echo '<a class="nav-tab' . ($key === $tab ? ' nav-tab-active' : '') . '" href="' . esc_url(admin_url('admin.php?page=mg-dashboard&tab=' . $key)) . '">' . esc_html($label) . '</a>';
    echo '</nav>';
    if (isset($_GET['saved'])) echo '<div class="notice notice-success"><p>저장했습니다.</p></div>';
    if ($tab === 'content') {
        echo '<h2>공개 콘텐츠 JSON 가져오기</h2><p>동일 id는 갱신됩니다. 가져오기는 해당 글의 기존 편집 내용을 대체하므로 먼저 백업하세요. 원본의 draft와 scheduled 상태는 유지됩니다. 공개 내보내기에는 공개 글만 포함됩니다.</p><form method="post" enctype="multipart/form-data" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('mg_import');
        echo '<input type="hidden" name="action" value="mg_import"><input type="file" name="content" accept="application/json,.json" required><p><label><input type="checkbox" name="confirm" value="1" required> 백업했으며 같은 id의 글을 갱신하는 데 동의합니다.</label></p>';
        submit_button('가져오기'); echo '</form><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('mg_export');
        echo '<input type="hidden" name="action" value="mg_export">'; submit_button('공개 콘텐츠 내보내기', 'secondary'); echo '</form>';
        $last = get_option('mg_last_import');
        if ($last) echo '<p>최근 가져오기: ' . esc_html($last['at']) . ' · 공개 ' . (int) $last['counts']['published'] . ' / 초안 ' . (int) $last['counts']['draft'] . ' / 예약 ' . (int) $last['counts']['scheduled'] . '</p>';
    } elseif ($tab === 'settings') {
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">'; wp_nonce_field('mg_settings');
        echo '<input type="hidden" name="action" value="mg_settings"><table class="form-table">';
        foreach (array('name' => '제호', 'englishName' => '영문 제호', 'tagline' => '소개 문구', 'email' => '문의 이메일', 'singlePrice' => '단권 가격', 'annualPrice' => '연간 가격') as $key => $label) {
            echo '<tr><th><label for="mg-' . esc_attr($key) . '">' . esc_html($label) . '</label></th><td><input class="regular-text" id="mg-' . esc_attr($key) . '" name="settings[' . esc_attr($key) . ']" type="' . (str_contains($key, 'Price') ? 'number' : ($key === 'email' ? 'email' : 'text')) . '" value="' . esc_attr($settings[$key]) . '"></td></tr>';
        }
        foreach (array('heroArticleIds' => '홈 주요 기사 id', 'featuredArticleIds' => '추천 기사 id', 'sectionOrder' => '홈 섹션 slug 순서') as $key => $label) echo '<tr><th>' . esc_html($label) . '</th><td><input class="large-text" name="settings[' . esc_attr($key) . ']" value="' . esc_attr(implode(',', $settings[$key])) . '"><p class="description">쉼표로 구분합니다. 기사 id는 글 편집 화면에서 확인합니다.</p></td></tr>';
        $hero_lines = array_map(function ($image) { return is_array($image) ? ($image['src'] ?? '') . '|' . ($image['alt'] ?? '') : $image; }, $settings['heroImages']);
        echo '<tr><th>홈 주요 사진</th><td><textarea class="large-text" rows="4" name="heroImages">' . esc_textarea(implode("\n", $hero_lines)) . '</textarea><p class="description">한 줄에 현재 사이트 미디어 URL|사진 설명. 빈 값이면 기사 대표 사진을 사용합니다.</p></td></tr>';
        foreach (array('publisher' => '발행인', 'editor' => '편집인', 'address' => '발행소 주소', 'businessNumber' => '사업자등록번호', 'registrationNumber' => '등록번호', 'issn' => 'ISSN', 'phone' => '전화') as $key => $label) echo '<tr><th>' . esc_html($label) . '</th><td><input class="regular-text" name="settings[footer][' . esc_attr($key) . ']" value="' . esc_attr($settings['footer'][$key] ?? '') . '"></td></tr>';
        foreach (array('instagram','youtube','facebook') as $key) echo '<tr><th>' . esc_html($key) . '</th><td><input class="regular-text" type="url" name="settings[social][' . esc_attr($key) . ']" value="' . esc_attr($settings['social'][$key] ?? '') . '"></td></tr>';
        $notifications = get_option('mg_notifications', array('enabled' => false,'email' => ''));
        echo '<tr><th>접수 알림 메일</th><td><label><input type="checkbox" name="notifyEnabled" value="1"' . checked(!empty($notifications['enabled']), true, false) . '> 활성화</label><p><label>실제 알림 수신 이메일 <input class="regular-text" type="email" name="notifyEmail" value="' . esc_attr($notifications['email']) . '"></label></p><p class="description">기본값은 꺼짐입니다. 실제 메일 전송 설정·수신을 먼저 확인하세요. 메일에는 신청자 개인정보를 포함하지 않습니다. wp_mail 처리 성공은 실제 수신 확인을 의미하지 않습니다.</p></td></tr>';
        echo '</table>'; submit_button(); echo '</form>';
    } else {
        nocache_headers();
        $page = max(1, (int) ($_GET['paged'] ?? 1));
        $table = $wpdb->prefix . 'mg_inquiries';
        $rows = $wpdb->get_results($wpdb->prepare("SELECT id,reference,type,payload,status,notification_status,notification_error,created_at FROM $table ORDER BY id DESC LIMIT 30 OFFSET %d", ($page - 1) * 30));
        $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM $table");
        echo '<h2>개인정보가 포함된 비공개 접수함</h2><p>관리자만 열람할 수 있습니다. 결제 완료 또는 구독 확정을 의미하지 않습니다. 접수 내용을 공개 글·저장소·로그에 복사하지 마세요.</p><table class="widefat striped"><thead><tr><th>접수 번호 / UTC 일시</th><th>종류</th><th>내용</th><th>상태</th></tr></thead><tbody>';
        foreach ($rows as $row) {
            echo '<tr><td>' . esc_html($row->reference) . '<br>' . esc_html($row->created_at) . '</td><td>' . esc_html($row->type) . '</td><td><details><summary>접수 내용 열기</summary><dl>';
            foreach (json_decode($row->payload, true) ?: array() as $key => $value) echo '<dt><strong>' . esc_html($key) . '</strong></dt><dd style="white-space:pre-wrap">' . esc_html(is_bool($value) ? ($value ? '예' : '아니오') : (string) $value) . '</dd>';
            echo '</dl></details></td><td><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">'; wp_nonce_field('mg_status_' . $row->id);
            echo '<input type="hidden" name="action" value="mg_status"><input type="hidden" name="id" value="' . (int) $row->id . '"><select name="status">';
            foreach (mg_inquiry_statuses() as $status => $label) echo '<option value="' . esc_attr($status) . '"' . selected($row->status, $status, false) . '>' . esc_html($label) . '</option>';
            $notification_labels = array('disabled' => '메일 알림 꺼짐', 'accepted' => '메일 전송 처리 성공 · 실제 수신 미확인', 'failed' => '메일 전송 처리 실패 · SMTP 설정 확인');
            echo '</select><button type="submit" class="button">저장</button></form><p>' . esc_html($notification_labels[$row->notification_status] ?? '메일 상태 미확인') . '</p><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">'; wp_nonce_field('mg_delete_' . $row->id);
            echo '<input type="hidden" name="action" value="mg_delete"><input type="hidden" name="id" value="' . (int) $row->id . '"><label><input type="checkbox" name="confirm" value="1" required> 영구 삭제 확인</label><button class="button" type="submit">삭제</button></form></td></tr>';
        }
        if (!$rows) echo '<tr><td colspan="4">접수된 문의가 없습니다.</td></tr>';
        echo '</tbody></table>';
        $links = paginate_links(array('base' => add_query_arg('paged', '%#%', admin_url('admin.php?page=mg-dashboard')), 'current' => $page, 'total' => max(1, (int) ceil($total / 30))));
        echo wp_kses_post($links);
    }
    echo '</div>';
}

function mg_admin_authorize($nonce) {
    if (!current_user_can('manage_options')) wp_die('관리자 권한이 필요합니다.', '', array('response' => 403));
    check_admin_referer($nonce);
}
function mg_admin_redirect($tab) { wp_safe_redirect(admin_url('admin.php?page=mg-dashboard&saved=1&tab=' . $tab)); exit; }
function mg_inquiry_statuses() { return array('new' => '접수', 'reviewing' => '확인 중', 'contacted' => '연락완료', 'quoted' => '견적발송', 'contracting' => '계약진행', 'active' => '구독중', 'completed' => '처리 완료', 'closed' => '종료'); }

add_action('admin_post_mg_settings', function () {
    mg_admin_authorize('mg_settings');
    $input = wp_unslash($_POST['settings'] ?? array());
    foreach (array('heroArticleIds','featuredArticleIds','sectionOrder') as $key) $input[$key] = array_map('trim', explode(',', $input[$key] ?? ''));
    $input['heroImages'] = array();
    foreach (preg_split('/\r?\n/', wp_unslash($_POST['heroImages'] ?? '')) as $line) { if (!trim($line)) continue; $parts = explode('|', $line, 2); $input['heroImages'][] = array('src' => trim($parts[0]), 'alt' => trim($parts[1] ?? '')); }
    update_option('mg_settings', mg_clean_settings($input), false);
    $notify_email = sanitize_email(wp_unslash($_POST['notifyEmail'] ?? ''));
    $notify_enabled = ($_POST['notifyEnabled'] ?? '') === '1';
    if ($notify_enabled && !is_email($notify_email)) wp_die('알림 수신 이메일을 확인해 주세요.');
    update_option('mg_notifications', array('enabled' => $notify_enabled, 'email' => $notify_email), false);
    mg_admin_redirect('settings');
});
add_action('admin_post_mg_import', function () {
    mg_admin_authorize('mg_import');
    if (($_POST['confirm'] ?? '') !== '1') wp_die('백업·갱신 확인이 필요합니다.');
    $file = $_FILES['content'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] > 20971520 || !is_uploaded_file($file['tmp_name'])) wp_die('20MB 이하 JSON 파일을 선택해 주세요.');
    $content = json_decode(file_get_contents($file['tmp_name']), true);
    if (json_last_error() !== JSON_ERROR_NONE) wp_die('JSON 파일을 읽을 수 없습니다.');
    $result = mg_import_content($content);
    if (is_wp_error($result)) wp_die(esc_html($result->get_error_message()) . ' 실패 전에 일부 항목이 저장되었을 수 있습니다. 문제를 해결한 뒤 같은 JSON을 다시 가져오면 동일 id를 갱신합니다.');
    mg_admin_redirect('content');
});
add_action('admin_post_mg_export', function () {
    mg_admin_authorize('mg_export');
    nocache_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="monthly-gangjin-public-content.json"');
    echo wp_json_encode(mg_export_content(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
});
add_action('admin_post_mg_status', function () {
    $id = absint($_POST['id'] ?? 0); mg_admin_authorize('mg_status_' . $id);
    $status = sanitize_key($_POST['status'] ?? '');
    if (!array_key_exists($status, mg_inquiry_statuses())) wp_die('상태가 올바르지 않습니다.');
    global $wpdb;
    if ($wpdb->update($wpdb->prefix . 'mg_inquiries', array('status' => $status, 'updated_at' => current_time('mysql', true)), array('id' => $id)) === false) wp_die('저장하지 못했습니다.');
    mg_admin_redirect('inquiries');
});
add_action('admin_post_mg_delete', function () {
    $id = absint($_POST['id'] ?? 0); mg_admin_authorize('mg_delete_' . $id);
    if (($_POST['confirm'] ?? '') !== '1') wp_die('영구 삭제 확인이 필요합니다.');
    global $wpdb;
    if ($wpdb->delete($wpdb->prefix . 'mg_inquiries', array('id' => $id)) === false) wp_die('삭제하지 못했습니다.');
    mg_admin_redirect('inquiries');
});

add_action('add_meta_boxes', function () {
    add_meta_box('mg-editorial', '월간강진 편집 정보', 'mg_editorial_box', array('post','mg_issue'), 'normal', 'default');
});
add_action('save_post_post', function ($id) {
    if (!wp_is_post_revision($id) && !get_post_meta($id, '_mg_source_id', true)) update_post_meta($id, '_mg_source_id', 'wp-' . $id);
});
function mg_editorial_box($post) {
    wp_nonce_field('mg_editorial', 'mg_editorial_nonce');
    $issue = $post->post_type === 'mg_issue';
    $meta = get_post_meta($post->ID, $issue ? '_mg_issue' : '_mg_article', true) ?: array();
    echo '<p>외부 콘텐츠 id: <code>' . esc_html(get_post_meta($post->ID, '_mg_source_id', true) ?: 'wp-' . $post->ID) . '</code></p><p>제목·본문·요약·대표 사진·분류·태그·예약은 WordPress 기본 편집기를 사용합니다.</p>';
    $fields = $issue ? array('volume' => '권호', 'month' => '발행월 (YYYY-MM)', 'cover' => '표지: 현재 사이트 미디어 URL', 'articleIds' => '기사 id (쉼표 구분)') : array('author' => '글쓴이', 'photographer' => '사진', 'secondaryImage' => '보조 사진: 현재 사이트 미디어 URL', 'people' => '인물 (쉼표 구분)', 'places' => '장소 (쉼표 구분)', 'issueId' => '호 id', 'seoTitle' => '검색 제목', 'seoDescription' => '검색 설명');
    foreach ($fields as $key => $label) {
        $value = str_starts_with($key, 'seo') ? ($meta['seo'][$key === 'seoTitle' ? 'title' : 'description'] ?? '') : ($meta[$key] ?? '');
        if (is_array($value)) $value = implode(',', $value);
        echo '<p><label>' . esc_html($label) . '<br><input class="widefat" name="mg_editorial[' . esc_attr($key) . ']" value="' . esc_attr($value) . '"></label></p>';
    }
    echo '<p><label><input type="checkbox" name="mg_editorial[isDemo]" value="1"' . checked(!empty($meta['isDemo']), true, false) . '> 예시 콘텐츠 표시</label></p>';
}
add_action('save_post', function ($id, $post) {
    if (!in_array($post->post_type, array('post','mg_issue'), true) || wp_is_post_revision($id) || wp_is_post_autosave($id) || !current_user_can('edit_post', $id) || !isset($_POST['mg_editorial_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['mg_editorial_nonce'])), 'mg_editorial')) return;
    $input = wp_unslash($_POST['mg_editorial'] ?? array());
    $key = $post->post_type === 'mg_issue' ? '_mg_issue' : '_mg_article';
    $meta = get_post_meta($id, $key, true) ?: array();
    foreach (array('volume','month','author','photographer','issueId') as $field) if (isset($input[$field])) $meta[$field] = sanitize_text_field($input[$field]);
    foreach (array('cover','secondaryImage') as $field) if (isset($input[$field])) $meta[$field] = mg_safe_image_url($input[$field]);
    foreach (array('people','places','articleIds') as $field) if (isset($input[$field])) $meta[$field] = array_values(array_filter(array_map('sanitize_text_field', array_map('trim', explode(',', $input[$field])))));
    foreach (array('seoTitle' => 'title', 'seoDescription' => 'description') as $field => $seo_key) if (isset($input[$field])) $meta['seo'][$seo_key] = sanitize_text_field($input[$field]);
    $meta['isDemo'] = isset($input['isDemo']);
    update_post_meta($id, $key, $meta);
}, 10, 2);
