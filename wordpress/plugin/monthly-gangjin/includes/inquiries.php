<?php
defined('ABSPATH') || exit;

function mg_install_inquiries() {
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $collation = $wpdb->get_charset_collate();
    dbDelta("CREATE TABLE {$wpdb->prefix}mg_inquiries (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        reference varchar(36) NOT NULL,
        idem_hash char(64) NOT NULL,
        payload_hash char(64) NOT NULL,
        type varchar(20) NOT NULL,
        payload longtext NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'new',
        notification_status varchar(20) NOT NULL DEFAULT 'disabled',
        notification_error varchar(255) NOT NULL DEFAULT '',
        created_at datetime NOT NULL,
        updated_at datetime NOT NULL,
        PRIMARY KEY  (id),
        UNIQUE KEY idem_hash (idem_hash),
        UNIQUE KEY reference (reference),
        KEY status_created (status,created_at)
    ) $collation;");
    dbDelta("CREATE TABLE {$wpdb->prefix}mg_rate_limits (
        bucket char(64) NOT NULL,
        hits int unsigned NOT NULL DEFAULT 1,
        expires_at bigint unsigned NOT NULL,
        PRIMARY KEY  (bucket),
        KEY expires_at (expires_at)
    ) $collation;");
}

function mg_inquiry_error($message, $status = 400) {
    return new WP_Error('mg_inquiry_error', $message, array('status' => $status));
}

function mg_validate_inquiry($input) {
    if (!is_array($input) || ($input['consent'] ?? null) !== true) return mg_inquiry_error('개인정보 수집·이용 동의가 필요합니다.');
    if (!empty($input['website'])) return mg_inquiry_error('요청을 확인할 수 없습니다.');
    $started = $input['startedAt'] ?? null;
    if (!is_numeric($started)) return mg_inquiry_error('양식을 다시 열어 주세요.');
    $started = (float) $started;
    if ($started > 100000000000) $started /= 1000;
    if (time() - $started < 2 || time() - $started > 86400) return mg_inquiry_error('양식을 다시 확인한 뒤 제출해 주세요.');
    if (!is_string($input['idempotencyKey'] ?? null) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i', $input['idempotencyKey'])) return mg_inquiry_error('요청 식별자가 올바르지 않습니다.');
    $fields = array(
        'personal' => array('name','phone','email','address','startMonth','notes'),
        'institution' => array('organization','department','name','phone','email','address','copies','duration','quotation','notes'),
        'advertising' => array('organization','name','phone','email','adType','budget','message'),
        'contact' => array('name','email','message'),
    );
    $type = $input['type'] ?? '';
    if (!is_string($type) || !isset($fields[$type])) return mg_inquiry_error('문의 종류가 올바르지 않습니다.');
    $required = array(
        'personal' => array('name','phone','email','address','startMonth'),
        'institution' => array('organization','name','phone','email','address','copies','duration'),
        'advertising' => array('organization','name','phone','email','adType','message'),
        'contact' => array('name','email','message'),
    );
    $clean = array('type' => $type, 'consent' => true);
    foreach ($fields[$type] as $field) {
        $value = $input[$field] ?? '';
        if ($field === 'quotation') {
            if (!is_bool($value) && $value !== '') return mg_inquiry_error('견적서 선택을 확인해 주세요.');
            $clean[$field] = $value === true;
            continue;
        }
        if (!is_scalar($value)) return mg_inquiry_error('입력 값이 올바르지 않습니다.');
        $value = trim((string) $value);
        $max = in_array($field, array('notes','message'), true) ? 5000 : ($field === 'address' ? 500 : 200);
        if (strlen($value) > $max * 4) return mg_inquiry_error('입력 내용이 너무 깁니다.');
        if (in_array($field, $required[$type], true) && $value === '') return mg_inquiry_error('필수 항목을 모두 입력해 주세요.');
        if ($field === 'email' && !is_email($value)) return mg_inquiry_error('이메일 주소를 확인해 주세요.');
        if ($field === 'phone' && !preg_match('/^[+0-9() .-]{7,30}$/', $value)) return mg_inquiry_error('연락처를 확인해 주세요.');
        if ($field === 'startMonth' && !preg_match('/^20[0-9]{2}-(0[1-9]|1[0-2])$/', $value)) return mg_inquiry_error('구독 시작월을 확인해 주세요.');
        if ($field === 'copies' && (!ctype_digit($value) || (int) $value < 1 || (int) $value > 10000)) return mg_inquiry_error('부수는 1~10,000 사이로 입력해 주세요.');
        if ($field === 'duration' && !in_array($value, array('6','12','24'), true)) return mg_inquiry_error('구독 기간을 확인해 주세요.');
        if ($field === 'adType' && !in_array($value, array('print','online','branded','other'), true)) return mg_inquiry_error('광고 유형을 확인해 주세요.');
        if ($field === 'budget' && !in_array($value, array('','undecided','under-500k','500k-1m','1m-3m','over-3m'), true)) return mg_inquiry_error('예산 범위를 확인해 주세요.');
        $clean[$field] = in_array($field, array('notes','message','address'), true) ? sanitize_textarea_field($value) : sanitize_text_field($value);
    }
    return $clean;
}

function mg_receive_inquiry(WP_REST_Request $request) {
    global $wpdb;
    if (strlen($request->get_body()) > 40000) return mg_inquiry_error('요청이 너무 큽니다.', 413);
    $origin = $request->get_header('origin');
    if ($origin) {
        $actual = wp_parse_url($origin);
        $site = wp_parse_url(home_url());
        if (!$actual || strtolower($actual['host'] ?? '') !== strtolower($site['host'] ?? '') || ($actual['scheme'] ?? '') !== ($site['scheme'] ?? '') || ($actual['port'] ?? null) !== ($site['port'] ?? null)) return mg_inquiry_error('이 사이트의 양식에서 제출해 주세요.', 403);
    }
    // Only REMOTE_ADDR is trusted. Proxy headers are spoofable without a configured trusted proxy.
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $now = time();
    $bucket = hash_hmac('sha256', $ip . '|' . floor($now / 600), wp_salt('nonce'));
    $table = $wpdb->prefix . 'mg_rate_limits';
    $counted = $wpdb->query($wpdb->prepare("INSERT INTO $table (bucket,hits,expires_at) VALUES (%s,1,%d) ON DUPLICATE KEY UPDATE hits=hits+1", $bucket, $now + 1200));
    if ($counted === false) return mg_inquiry_error('접수 서비스에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.', 503);
    $hits = (int) $wpdb->get_var($wpdb->prepare("SELECT hits FROM $table WHERE bucket=%s", $bucket));
    $wpdb->query($wpdb->prepare("DELETE FROM $table WHERE expires_at < %d", $now));
    if ($hits > 10) {
        $response = new WP_REST_Response(array('message' => '요청이 많습니다. 10분 뒤 다시 시도해 주세요.'), 429);
        $response->header('Retry-After', '600');
        return $response;
    }
    $input = $request->get_json_params();
    $payload = mg_validate_inquiry($input);
    if (is_wp_error($payload)) return $payload;
    $idem = hash_hmac('sha256', strtolower($input['idempotencyKey']), wp_salt('auth'));
    $encoded = wp_json_encode($payload, JSON_UNESCAPED_UNICODE);
    $hash = hash_hmac('sha256', $encoded, wp_salt('auth'));
    $table = $wpdb->prefix . 'mg_inquiries';
    $existing = $wpdb->get_row($wpdb->prepare("SELECT reference,payload_hash FROM $table WHERE idem_hash=%s", $idem));
    if ($existing) {
        if (!hash_equals($existing->payload_hash, $hash)) return mg_inquiry_error('같은 요청 식별자로 내용을 바꿀 수 없습니다.', 409);
        return mg_inquiry_receipt($existing->reference, 200);
    }
    $reference = wp_generate_uuid4();
    $created = current_time('mysql', true);
    $saved = $wpdb->insert($table, array('reference' => $reference, 'idem_hash' => $idem, 'payload_hash' => $hash, 'type' => $payload['type'], 'payload' => $encoded, 'status' => 'new', 'created_at' => $created, 'updated_at' => $created));
    if ($saved === false) {
        // A simultaneous retry may have won the unique key. Never create a second row.
        $existing = $wpdb->get_row($wpdb->prepare("SELECT reference,payload_hash FROM $table WHERE idem_hash=%s", $idem));
        if ($existing && hash_equals($existing->payload_hash, $hash)) return mg_inquiry_receipt($existing->reference, 200);
        return mg_inquiry_error($existing ? '동일 요청의 내용이 다릅니다.' : '저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', $existing ? 409 : 503);
    }
    mg_notify_inquiry((int) $wpdb->insert_id, $reference, $payload['type']);
    return mg_inquiry_receipt($reference, 201);
}

function mg_notify_inquiry($id, $reference, $type) {
    global $wpdb;
    $options = get_option('mg_notifications', array('enabled' => false, 'email' => ''));
    if (empty($options['enabled']) || !is_email($options['email'] ?? '')) return;
    // Notifications contain no applicant contact/address/message. Administrators open the private inbox.
    $subject = '[월간강진] 새 접수 ' . $reference;
    $message = "새 문의가 접수되었습니다.\n종류: " . $type . "\n참조: " . $reference . "\n비공개 접수함: " . admin_url('admin.php?page=mg-dashboard') . "\n\n이 메일은 구독/결제 확정을 의미하지 않습니다.";
    $accepted = wp_mail($options['email'], $subject, $message);
    $wpdb->update($wpdb->prefix . 'mg_inquiries', array('notification_status' => $accepted ? 'accepted' : 'failed', 'notification_error' => $accepted ? '' : 'mail_transport_rejected'), array('id' => $id));
}

function mg_inquiry_receipt($reference, $status) {
    $response = new WP_REST_Response(array('id' => $reference, 'reference' => $reference, 'message' => '문의가 접수되었습니다. 담당자가 확인 후 연락드립니다.'), $status);
    $response->header('Cache-Control', 'no-store, private');
    return $response;
}
