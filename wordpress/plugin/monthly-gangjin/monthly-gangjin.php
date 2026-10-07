<?php
/**
 * Plugin Name: Monthly Gangjin Publishing
 * Description: Native magazine content migration and private subscription/inquiry management.
 * Version: 1.0.0
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * License: GPL-2.0-or-later
 */
defined('ABSPATH') || exit;
define('MG_PLUGIN_DIR', plugin_dir_path(__FILE__));
require_once MG_PLUGIN_DIR . 'includes/content.php';
require_once MG_PLUGIN_DIR . 'includes/inquiries.php';
require_once MG_PLUGIN_DIR . 'includes/admin.php';

function mg_register_content_types() {
    register_post_type('mg_issue', array(
        'labels' => array('name' => '월간강진 · 지난 호', 'singular_name' => '지난 호', 'add_new_item' => '새 호 추가'),
        'public' => true, 'show_in_rest' => true, 'menu_icon' => 'dashicons-book',
        'has_archive' => false, 'rewrite' => array('slug' => 'issues', 'with_front' => false),
        'supports' => array('title', 'editor', 'thumbnail', 'excerpt', 'custom-fields'),
    ));
    add_rewrite_rule('^archive/?$', 'index.php?mg_route=archive', 'top');
    foreach (array('subscribe','institutions','advertise','about','search','contact','credits') as $route) {
        add_rewrite_rule('^' . $route . '/?$', 'index.php?mg_route=' . $route, 'top');
    }
    add_rewrite_rule('^policies/(privacy|terms|email|subscription|refund)/?$', 'index.php?mg_route=policy&mg_policy=$matches[1]', 'top');
}
add_action('init', 'mg_register_content_types');
add_filter('query_vars', function ($vars) { return array_merge($vars, array('mg_route','mg_policy')); });
add_action('template_redirect', function () {
    if (get_query_var('mg_route')) {
        global $wp_query;
        $wp_query->is_404 = false;
        status_header(200);
    }
});

function mg_install() {
    mg_register_content_types();
    mg_install_inquiries();
    if (!wp_next_scheduled('mg_delete_completed_inquiries')) wp_schedule_event(time() + 3600, 'daily', 'mg_delete_completed_inquiries');
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'mg_install');
register_deactivation_hook(__FILE__, function () { flush_rewrite_rules(); wp_clear_scheduled_hook('mg_delete_completed_inquiries'); });
add_action('mg_delete_completed_inquiries', function () {
    global $wpdb;
    $cutoff = gmdate('Y-m-d H:i:s', time() - YEAR_IN_SECONDS);
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->prefix}mg_inquiries WHERE status IN ('completed','closed') AND updated_at < %s", $cutoff));
});

add_action('rest_api_init', function () {
    register_rest_route('monthly-gangjin/v1', '/inquiries', array(
        'methods' => 'POST', 'callback' => 'mg_receive_inquiry', 'permission_callback' => '__return_true',
    ));
    register_rest_route('monthly-gangjin/v1', '/content', array(
        'methods' => 'GET', 'callback' => function () { return rest_ensure_response(mg_export_content()); },
        'permission_callback' => '__return_true',
    ));
});

add_action('init', function () {
    if (!function_exists('register_block_pattern')) return;
    register_block_pattern_category('monthly-gangjin', array('label' => '월간강진 편집'));
    $patterns = array(
        'pair' => array('사진 두 장', 2), 'trio' => array('사진 세 장', 3),
        'mosaic' => array('사진 모자이크', 3), 'strip' => array('가로 사진 띠', 3),
        'portrait' => array('인물 사진', 1), 'full' => array('전체 너비 사진', 1),
        'overlap' => array('사진 겹침', 2), 'split' => array('사진과 글', 2),
    );
    foreach ($patterns as $type => $definition) {
        $inner = '';
        for ($i = 0; $i < $definition[1]; $i++) $inner .= '<!-- wp:image {"sizeSlug":"large"} --><figure class="wp-block-image size-large"><img alt="사진 설명을 입력하세요"/><figcaption>사진 설명 · 사진 제공</figcaption></figure><!-- /wp:image -->';
        register_block_pattern('monthly-gangjin/' . $type, array(
            'title' => $definition[0], 'categories' => array('monthly-gangjin'),
            'content' => '<!-- wp:group {"className":"mg-layout mg-layout-' . $type . ' image-layout layout-' . $type . '","layout":{"type":"default"}} --><div class="wp-block-group mg-layout mg-layout-' . $type . ' image-layout layout-' . $type . '">' . $inner . '</div><!-- /wp:group -->',
        ));
    }
});
