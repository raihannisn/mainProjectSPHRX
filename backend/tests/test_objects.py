import json
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

OBJECT_SERVICE_PATH = Path(__file__).resolve().parents[1] / "services" / "object_service.py"
OBJECT_SERVICE_SPEC = importlib.util.spec_from_file_location("object_service_under_test", OBJECT_SERVICE_PATH)
object_service = importlib.util.module_from_spec(OBJECT_SERVICE_SPEC)
OBJECT_SERVICE_SPEC.loader.exec_module(object_service)


class ObjectCatalogRouteTests(unittest.TestCase):
    def test_list_returns_canonical_records_once(self):
        catalog = {
            "rcw-36": {"id": "rcw-36", "name": "RCW 36", "ra": 134.8, "dec": -43.7},
            "rcw": {"id": "rcw-36", "name": "RCW 36 alias", "ra": 134.8, "dec": -43.7},
            "mars": {"name": "Mars"},
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            catalog_path = Path(temp_dir) / "catalog.json"
            catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
            with patch.object(object_service, "OBJECT_CATALOG_PATH", catalog_path):
                result = object_service.get_object_catalog()

        self.assertEqual([record["id"] for record in result], ["rcw-36", "mars"])
        self.assertEqual(result[0]["name"], "RCW 36")
        self.assertNotIn("ra", result[1])


if __name__ == "__main__":
    unittest.main()
