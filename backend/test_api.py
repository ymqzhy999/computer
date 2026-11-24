from __future__ import annotations

import json
import socket
import subprocess
import sys
import time
import unittest
import urllib.error
import urllib.request

def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])

PORT = free_port()
BASE = f"http://127.0.0.1:{PORT}"


class CatalogApiTests(unittest.TestCase):
    server: subprocess.Popen[bytes]

    @classmethod
    def setUpClass(cls) -> None:
        cls.server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(PORT), "--log-level", "error"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        for _ in range(60):
            try:
                urllib.request.urlopen(f"{BASE}/api/prices/health", timeout=0.5).read()
                return
            except (urllib.error.URLError, TimeoutError):
                time.sleep(0.1)
        cls.server.terminate()
        raise RuntimeError("test API did not start")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.terminate()
        cls.server.wait(timeout=8)

    def request(self, path: str, method: str = "GET", body: dict | None = None) -> tuple[int, dict]:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(
            f"{BASE}{path}",
            data=data,
            method=method,
            headers={"Content-Type": "application/json"} if data else {},
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read().decode("utf-8"))

    def test_health_is_honest_about_archive_mode(self) -> None:
        status, body = self.request("/api/prices/health")
        self.assertEqual(status, 200)
        self.assertIn("adapter", body)
        self.assertIn("configured", body)
        self.assertTrue(body["catalogUpdatedAt"])
        if not body["configured"]:
            self.assertEqual(body["adapter"], "archive-only")
            self.assertIn("未配置", body["message"])

    def test_catalog_stats_add_up(self) -> None:
        status, body = self.request("/api/catalog/stats")
        self.assertEqual(status, 200)
        self.assertGreater(body["total"], 100)
        self.assertEqual(body["priced"] + body["unpriced"], body["total"])
        self.assertEqual(sum(body["byCategory"].values()), body["total"])
        self.assertGreaterEqual(body["coverage"], 0.9)
        self.assertLessEqual(body["live"], body["priced"])

    def test_catalog_search_and_detail(self) -> None:
        status, page = self.request("/api/catalog?q=7800X3D&limit=5")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(page["total"], 1)
        self.assertTrue(all("7800X3D" in item["model"] for item in page["items"]))
        product_id = page["items"][0]["id"]
        detail_status, detail = self.request(f"/api/catalog/{product_id}")
        self.assertEqual(detail_status, 200)
        self.assertEqual(detail["id"], product_id)

    def test_unknown_product_returns_404(self) -> None:
        status, body = self.request("/api/catalog/not-a-real-sku")
        self.assertEqual(status, 404)
        self.assertIn("detail", body)

    def test_quote_endpoint_never_invents_quotes(self) -> None:
        status, body = self.request(
            "/api/prices/quotes",
            method="POST",
            body={"productIds": ["cpu-amd-r7-7800x3d", "missing-sku"], "region": "CN", "currency": "CNY"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["quotes"], [])
        self.assertTrue(body["warnings"])
        self.assertEqual(body["adapter"], "archive-only")


if __name__ == "__main__":
    unittest.main()
