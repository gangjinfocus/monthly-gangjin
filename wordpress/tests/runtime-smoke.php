<?php
/** Local-only integration test. Uses an isolated WordPress installation passed as argv[1]. */
if (PHP_SAPI !== 'cli' || empty($argv[1]) || empty($argv[2])) { fwrite(STDERR, "Usage: php runtime-smoke.php ISOLATED_WORDPRESS_ROOT CONTENT_JSON\n"); exit(2); }
$root = realpath($argv[1]);
if (!$root || !str_contains(str_replace('\\', '/', $root), '/test-results/wp-runtime/')) { fwrite(STDERR, "An isolated test-results/wp-runtime WordPress root is required.\n"); exit(2); }
if (!is_file($root . '/wp-config.php')) {
    $config = "<?php\ndefine('DB_NAME','monthly_gangjin_test');\ndefine('DB_USER','');\ndefine('DB_PASSWORD','');\ndefine('DB_HOST','localhost');\ndefine('DB_CHARSET','utf8mb4');\ndefine('DB_COLLATE','');\ndefine('WP_HOME','http://127.0.0.1:4188');\ndefine('WP_SITEURL','http://127.0.0.1:4188');\ndefine('DISABLE_WP_CRON',true);\ndefine('WP_DEBUG',false);\ndefine('WP_HTTP_BLOCK_EXTERNAL',true);\n";
    foreach (array('AUTH_KEY','SECURE_AUTH_KEY','LOGGED_IN_KEY','NONCE_KEY','AUTH_SALT','SECURE_AUTH_SALT','LOGGED_IN_SALT','NONCE_SALT') as $key) $config .= "define('$key','" . bin2hex(random_bytes(32)) . "');\n";
    $config .= "\$table_prefix='wp_';\nif (!defined('ABSPATH')) define('ABSPATH',__DIR__.'/');\nrequire_once ABSPATH.'wp-settings.php';\n";
    file_put_contents($root . '/wp-config.php', $config);
}
define('WP_INSTALLING', true);
$_SERVER['HTTP_HOST'] = '127.0.0.1:4188'; $_SERVER['SERVER_NAME'] = '127.0.0.1'; $_SERVER['REQUEST_URI'] = '/'; $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require $root . '/wp-load.php';
add_filter('pre_wp_mail', '__return_true');
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
if (!is_blog_installed()) wp_install('Monthly Gangjin local test', 'test-editor', 'test@example.invalid', false, '', bin2hex(random_bytes(20)));
wp_set_current_user(get_user_by('login', 'test-editor')->ID);
update_option('timezone_string', 'Asia/Seoul');
update_option('permalink_structure', '/stories/%postname%/');
update_option('category_base', 'category');
switch_theme('monthly-gangjin');
$activation = activate_plugin('monthly-gangjin/monthly-gangjin.php');
if (is_wp_error($activation)) { fwrite(STDERR, "Plugin activation failed.\n"); exit(1); }
if (!function_exists('mg_import_content')) require WP_PLUGIN_DIR . '/monthly-gangjin/monthly-gangjin.php';
if (!function_exists('mg_theme_settings')) require get_stylesheet_directory() . '/functions.php';
$assertions = 0;
function mg_test_assert($condition, $label) { global $assertions; if (!$condition) { fwrite(STDERR, "FAIL: $label\n"); exit(1); } $assertions++; }
$content = json_decode(file_get_contents($argv[2]), true);
$result = mg_import_content($content);
if (is_wp_error($result)) { fwrite(STDERR, "Import failed: " . $result->get_error_message() . "\n"); exit(1); }
mg_test_assert(is_array($result), 'content import');
$before = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='post'");
$before_images = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='attachment'");
$result = mg_import_content($content);
mg_test_assert(!is_wp_error($result), 'idempotent reimport');
mg_test_assert($before === (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='post'"), 'no duplicate posts');
mg_test_assert($before_images === (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='attachment'"), 'no duplicate media');
$fixture = $content['articles'][0];
$fixture['id'] = 'test-draft'; $fixture['slug'] = 'test-draft'; $fixture['status'] = 'draft';
$future = $fixture; $future['id'] = 'test-future'; $future['slug'] = 'test-future'; $future['status'] = 'scheduled'; $future['publishAt'] = gmdate('c', time() + 86400);
$past = $fixture; $past['id'] = 'test-due'; $past['slug'] = 'test-due'; $past['status'] = 'scheduled'; $past['publishAt'] = gmdate('c', time() - 3600);
$content['articles'][] = $fixture; $content['articles'][] = $future; $content['articles'][] = $past;
mg_test_assert(!is_wp_error(mg_import_content($content)), 'draft and scheduled import');
mg_test_assert(get_post_status(mg_find_source_post('post','test-draft')) === 'draft', 'draft native status');
mg_test_assert(get_post_status(mg_find_source_post('post','test-future')) === 'future', 'future native status');
mg_test_assert(get_post_status(mg_find_source_post('post','test-due')) === 'publish', 'past schedule publishes');
$export = mg_export_content(); $ids = array_column($export['articles'],'id');
mg_test_assert(!in_array('test-draft',$ids,true) && !in_array('test-future',$ids,true) && in_array('test-due',$ids,true), 'public export excludes drafts and future');
mg_test_assert(count($export['issues']) === count($content['issues']), 'issues imported');
mg_test_assert(count($export['imageCredits']) === count($content['imageCredits']), 'image attribution preserved');
mg_test_assert(mg_settings()['email'] === $content['settings']['email'], 'settings imported');
mg_test_assert(mg_safe_image_url('https://example.invalid/a.jpg') === '', 'remote image blocked');
mg_test_assert(mg_safe_image_url('/images/../wp-config.php') === '', 'image traversal blocked');
mg_test_assert(mg_safe_image_url('/images/%2e%2e/a.webp') === '', 'encoded image traversal blocked');
mg_test_assert(count(mg_export_blocks(parse_blocks('<!-- wp:quote --><blockquote class="wp-block-quote"><!-- wp:paragraph --><p>A preserved quote</p><!-- /wp:paragraph --></blockquote><!-- /wp:quote -->'))) === 1, 'native quote export');
mg_test_assert(str_contains(mg_export_blocks(parse_blocks('<!-- wp:quote --><blockquote class="wp-block-quote"><!-- wp:paragraph --><p>A preserved quote</p><!-- /wp:paragraph --></blockquote><!-- /wp:quote -->'))[0]['text'], 'A preserved quote'), 'quote text preserved');
$base = array('name' => 'Test Fixture','phone' => '010-0000-0000','email' => 'fixture@example.invalid','consent' => true,'website' => '', 'startedAt' => (time()-10)*1000);
$types = array('personal' => array('address' => 'TEST ONLY','startMonth' => '2026-11','notes' => 'fixture'), 'institution' => array('organization' => 'Test Organization','department' => 'Test','address' => 'TEST ONLY','copies' => '3','duration' => '12','quotation' => true,'notes' => ''), 'advertising' => array('organization' => 'Test Organization','adType' => 'print','budget' => 'undecided','message' => 'TEST ONLY'), 'contact' => array('message' => 'TEST ONLY'));
foreach ($types as $type => $fields) {
    $payload = array_merge($base,$fields,array('type'=>$type,'idempotencyKey'=>wp_generate_uuid4()));
    $_SERVER['REMOTE_ADDR'] = '127.0.0.' . (count($types) + array_search($type,array_keys($types),true) + 1);
    $request = new WP_REST_Request('POST','/monthly-gangjin/v1/inquiries'); $request->set_header('Content-Type','application/json'); $request->set_body(wp_json_encode($payload));
    $response = rest_do_request($request);
    mg_test_assert($response->get_status() === 201, "$type accepted through REST");
    $receipt = $response->get_data();
    mg_test_assert(isset($receipt['reference']) && !isset($receipt['email']) && !isset($receipt['payload']), "$type private receipt");
    mg_test_assert(rest_do_request($request)->get_status() === 200, "$type idempotent retry");
    $payload['name'] = 'Changed'; $request->set_body(wp_json_encode($payload));
    mg_test_assert(rest_do_request($request)->get_status() === 409, "$type conflict rejected");
    $payload['idempotencyKey'] = wp_generate_uuid4(); $payload['consent'] = false; $request->set_body(wp_json_encode($payload));
    mg_test_assert(rest_do_request($request)->get_status() === 400, "$type no consent rejected");
}
$payload = array_merge($base,array('type'=>'contact','message'=>'TEST ONLY','idempotencyKey'=>wp_generate_uuid4(),'website'=>'bot'));
$_SERVER['REMOTE_ADDR'] = '127.0.0.99';
$request = new WP_REST_Request('POST','/monthly-gangjin/v1/inquiries'); $request->set_header('Content-Type','application/json'); $request->set_body(wp_json_encode($payload));
mg_test_assert(rest_do_request($request)->get_status() === 400, 'honeypot rejected');
$payload['website'] = ''; $request->set_body(wp_json_encode($payload)); $request->set_header('Origin','https://example.invalid');
mg_test_assert(rest_do_request($request)->get_status() === 403, 'foreign origin rejected');
$request->set_header('Origin','');
for ($i=0;$i<10;$i++) rest_do_request($request);
mg_test_assert(rest_do_request($request)->get_status() === 429, 'rate limit enforced');
mg_test_assert((int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}mg_inquiries") >= 4, 'private persistence');
mg_test_assert(wp_verify_nonce(wp_create_nonce('mg_settings'),'mg_settings') === 1 && !wp_verify_nonce('invalid','mg_settings'), 'native admin nonce validation');
wp_set_current_user(0);
mg_test_assert(is_wp_error(mg_import_content($content)), 'unauthorized import rejected');
wp_set_current_user(get_user_by('login','test-editor')->ID);
$token = WP_Session_Tokens::get_instance(get_current_user_id())->create(time()+3600);
$_COOKIE[LOGGED_IN_COOKIE] = wp_generate_auth_cookie(get_current_user_id(), time()+3600, 'logged_in', $token);
$inquiry_id = (int) $wpdb->get_var("SELECT MIN(id) FROM {$wpdb->prefix}mg_inquiries");
$auth = array('cookie' => LOGGED_IN_COOKIE . '=' . $_COOKIE[LOGGED_IN_COOKIE] . '; ' . AUTH_COOKIE . '=' . wp_generate_auth_cookie(get_current_user_id(),time()+3600,'auth',$token), 'statusNonce' => wp_create_nonce('mg_status_' . $inquiry_id),'inquiryId' => $inquiry_id);
file_put_contents(dirname($root) . '/http-auth.json', wp_json_encode($auth));
flush_rewrite_rules(false);
file_put_contents(dirname($root) . '/smoke-result.json', wp_json_encode(array('assertions'=>$assertions,'posts'=>$before,'media'=>$before_images,'wordpress'=>$GLOBALS['wp_version'],'php'=>PHP_VERSION),JSON_PRETTY_PRINT));
echo "PASS: $assertions WordPress integration assertions; native posts, media, schedules, export and private REST inquiries.\n";
