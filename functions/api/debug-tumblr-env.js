// functions/api/debug-tumblr-env.js
// TEMPORARY diagnostic endpoint — checks that Tumblr secrets look sane
// without ever printing their actual values. Delete after debugging.

export async function onRequestGet(context) {
  const { env } = context;
  const keys = [
    "TUMBLR_CONSUMER_KEY",
    "TUMBLR_CONSUMER_SECRET",
    "TUMBLR_OAUTH_TOKEN",
    "TUMBLR_OAUTH_TOKEN_SECRET",
    "TUMBLR_BLOG_ID",
  ];

  const report = {};
  for (const key of keys) {
    const val = env[key] || "";
    report[key] = {
      present: !!val,
      length: val.length,
      has_leading_or_trailing_whitespace: val !== val.trim(),
      starts_with_https: val.startsWith("http"),
      first_char_code: val.length > 0 ? val.charCodeAt(0) : null,
      last_char_code: val.length > 0 ? val.charCodeAt(val.length - 1) : null,
    };
  }

  return new Response(JSON.stringify(report, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
