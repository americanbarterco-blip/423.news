import unittest
from claudia_platforms import get_platform_connection, list_managed_platforms

class PlatformRegistryTests(unittest.TestCase):
    def test_only_423_inherits_legacy_connection(self):
        env = {
            "SUPABASE_URL": "https://423.example",
            "SUPABASE_SERVICE_ROLE_KEY": "legacy-key",
            "CLAUDIA_GITHUB_TOKEN": "github-token",
        }
        platforms = {p["id"]: p for p in list_managed_platforms(env)}
        self.assertTrue(platforms["423.news"]["database_connected"])
        self.assertFalse(platforms["808.news"]["database_connected"])
        self.assertFalse(platforms["let-us.farm"]["database_connected"])
        self.assertTrue(platforms["423.news"]["github_access_available"])

    def test_423_connection_preserves_legacy_table_scope(self):
        env = {"SUPABASE_URL": "https://423.example", "SUPABASE_SERVICE_ROLE_KEY": "key"}
        conn = get_platform_connection("423.news", env)
        self.assertIn("news_posts", conn["allowed_tables"])
        self.assertNotIn("auth.users", conn["allowed_tables"])
        self.assertEqual(conn["url"], "https://423.example")

    def test_other_tenant_requires_its_own_credentials_and_allowlist(self):
        env = {
            "SUPABASE_URL": "https://423.example",
            "SUPABASE_SERVICE_ROLE_KEY": "423-key",
            "CLAUDIA_PLATFORM_808_NEWS_SUPABASE_URL": "https://808.example",
            "CLAUDIA_PLATFORM_808_NEWS_SUPABASE_KEY": "808-key",
            "CLAUDIA_PLATFORM_808_NEWS_ALLOWED_TABLES": "news_posts, news_alerts, invalid-name!",
        }
        conn = get_platform_connection("808.news", env)
        self.assertEqual(conn["url"], "https://808.example")
        self.assertEqual(conn["key"], "808-key")
        self.assertEqual(conn["allowed_tables"], frozenset({"news_posts", "news_alerts"}))

    def test_unknown_or_unconfigured_platform_fails_closed(self):
        with self.assertRaises(ValueError):
            get_platform_connection("unknown.example", {})
        with self.assertRaises(RuntimeError):
            get_platform_connection("let-us.farm", {"SUPABASE_URL": "https://423.example", "SUPABASE_SERVICE_ROLE_KEY": "423-key"})

    def test_registry_never_returns_secrets(self):
        rows = list_managed_platforms({
            "CLAUDIA_PLATFORM_808_NEWS_SUPABASE_URL": "https://808.example",
            "CLAUDIA_PLATFORM_808_NEWS_SUPABASE_KEY": "do-not-return-this",
            "CLAUDIA_PLATFORM_808_NEWS_ALLOWED_TABLES": "news_posts",
        })
        self.assertNotIn("key", rows[1])
        self.assertNotIn("do-not-return-this", str(rows))

if __name__ == "__main__":
    unittest.main()
