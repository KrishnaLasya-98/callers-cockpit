"""Read-only public deployment check; never creates or edits demo data."""
import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frontend", default="https://callers-cockpit-ui.vercel.app")
    parser.add_argument("--backend", default="https://callers-cockpit.onrender.com")
    parser.add_argument("--expect-version", help="Reject a healthy API running the wrong source revision")
    args = parser.parse_args()
    checks = [("Frontend", args.frontend.rstrip("/"), None)]
    for label, base in (("Render", args.backend.rstrip("/")),
                        ("Vercel proxy", args.frontend.rstrip("/") + "/api")):
        for path, kind in (("/health", dict), ("/leads", list), ("/calls", list)):
            checks.append((label + path, base + path, kind))
    failures = 0
    for label, url, kind in checks:
        try:
            with urlopen(url, timeout=60) as response:
                content = response.read()
                if kind:
                    data = json.loads(content)
                    if not isinstance(data, kind):
                        raise ValueError("Unexpected JSON type")
                    if kind is dict and data.get("status") != "ok":
                        raise ValueError("Health is not ok")
                    if kind is dict and args.expect_version and data.get("version") != args.expect_version:
                        raise ValueError("Expected API version " + args.expect_version + "; got " + str(data.get("version")))
                    detail = "health ok" if kind is dict else f"{len(data)} rows"
                else:
                    if b"Caller's Cockpit" not in content:
                        raise ValueError("Unexpected frontend page")
                    detail = "app HTML"
            print(f"PASS {label}: {detail}")
        except (HTTPError, URLError, ValueError, TimeoutError) as exc:
            failures += 1
            print(f"FAIL {label}: {exc}")
    if args.expect_version:
        for asset, marker in (("/app.js", "cockpit.draft.v3"), ("/domain.js", "Cockpit")):
            try:
                with urlopen(args.frontend.rstrip("/") + asset, timeout=60) as response:
                    if marker not in response.read().decode("utf-8"):
                        raise ValueError("Updated frontend asset missing")
                print("PASS Frontend asset " + asset)
            except (HTTPError, URLError, ValueError, TimeoutError) as exc:
                failures += 1
                print("FAIL Frontend asset " + asset + ": " + str(exc))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
