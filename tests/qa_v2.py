import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
OUT_DIR = Path(__file__).resolve().parents[1] / "tmp"
OUT_DIR.mkdir(exist_ok=True)


def stub_refresh(page, calls):
    def handler(route):
        calls.append(route.request.post_data or "")
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                {
                    "ok": True,
                    "checked": 0,
                    "updated": 0,
                    "attention": 0,
                    "failed": 0,
                    "skippedFresh": 18,
                    "remaining": 0,
                }
            ),
        )

    page.route("**/api/auto-refresh", handler)


def filter_select(page, label):
    return page.locator(".filter-bar label").filter(has_text=label).locator("select")


with sync_playwright() as playwright:
    viewer_email = "viewer-privacy-qa@example.com"
    owner_api = playwright.request.new_context(base_url=BASE_URL)
    allowed = owner_api.post("/api/admin/viewers", data={"email": viewer_email})
    assert allowed.ok, allowed.text()
    viewer_api = playwright.request.new_context(
        base_url=BASE_URL,
        extra_http_headers={
            "oai-authenticated-user-id": "viewer-privacy-qa",
            "oai-authenticated-user-email": viewer_email,
        },
    )
    shared_response = viewer_api.get("/api/dashboard")
    assert shared_response.ok, shared_response.text()
    shared_payload = shared_response.json()
    assert shared_payload["role"] == "viewer"
    assert shared_payload["progress"] == []
    assert shared_payload["tracking"] == []
    assert shared_payload["sourceChecks"] == []
    assert shared_payload["changes"] == []
    private_keys = {"fit", "fitReason", "nextAction", "notes"}
    assert all(not private_keys.intersection(item) for item in shared_payload["scholarships"])
    assert viewer_api.get("/api/admin/viewers").status == 403
    removed = owner_api.delete("/api/admin/viewers", data={"email": viewer_email})
    assert removed.ok, removed.text()
    viewer_api.dispose()
    owner_api.dispose()

    browser = playwright.chromium.launch(headless=True)
    desktop = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = desktop.new_page()
    refresh_calls = []
    console_errors = []
    progress_requests = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on(
        "request",
        lambda request: progress_requests.append(request.post_data)
        if request.url.endswith("/api/progress") and request.method == "POST"
        else None,
    )
    stub_refresh(page, refresh_calls)

    page.goto(BASE_URL, wait_until="networkidle")
    page.get_by_role("heading", name="CSE Scholarship Command Center").wait_for()
    page.screenshot(path=OUT_DIR / "dashboard-v3-desktop.png", full_page=True)

    discovery = {
        "heading": page.get_by_role("heading", name="CSE Scholarship Command Center").inner_text(),
        "addFeature": page.get_by_role("heading", name="Add Scholarship tracking").is_visible(),
        "filterCount": page.locator(".filter-bar select").count(),
        "autoRefreshRequested": len(refresh_calls) > 0,
    }
    assert discovery["addFeature"]
    assert discovery["filterCount"] == 7
    assert discovery["autoRefreshRequested"]

    page.get_by_role("button", name="Manage access").click()
    page.get_by_role("heading", name="Viewer access").wait_for()
    assert page.get_by_text("No viewers allowed yet").is_visible()
    page.get_by_role("button", name="Close access administration").last.click()

    total_before = page.locator("tbody tr").count()
    filter_select(page, "Area").select_option(label="Cybersecurity")
    page.wait_for_timeout(150)
    filtered_count = page.locator("tbody tr").count()
    assert 0 < filtered_count < total_before
    page.get_by_role("button", name="Reset filters").click()

    test_name = f"Codex QA Future Fellowship {time.time_ns()}"
    note_value = f"Persistence QA note {time.time_ns()}"
    add_box = page.get_by_label("Official scholarship link or name")
    add_box.fill(test_name)
    page.get_by_role("button", name="Track scholarship").click()
    page.get_by_role("heading", name=test_name).wait_for()
    page.get_by_role("button", name="Close details").click()

    add_box.fill(test_name)
    page.get_by_role("button", name="Track scholarship").click()
    page.get_by_text("You are already tracking this scholarship.").wait_for()
    page.get_by_role("button", name="Close details").click()

    page.get_by_role("button", name=f"Open {test_name} details").click()
    cv_row = page.locator(".checklist-row").filter(has_text="CV")
    cv_row.locator("select").select_option("Ready")
    notes = page.get_by_placeholder("Contacts, essay angles, portal details, interview notes…")
    notes.fill(note_value)
    page.get_by_text("Unsaved changes").wait_for()
    with page.expect_response(lambda response: response.url.endswith("/api/progress") and response.request.method == "POST") as save_info:
        page.get_by_role("button", name="Save private notes").click()
    assert save_info.value.ok
    page.get_by_text("Saved securely").wait_for()

    page.reload(wait_until="networkidle")
    page.get_by_role("button", name=f"Open {test_name} details").click()
    assert page.locator(".checklist-row").filter(has_text="CV").locator("select").input_value() == "Ready"
    assert page.get_by_placeholder("Contacts, essay angles, portal details, interview notes…").input_value() == note_value, progress_requests

    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Remove", exact=True).click()
    filter_select(page, "Tracking").select_option("Archived")
    page.get_by_label("Search scholarships").fill(test_name)
    page.get_by_role("button", name=f"Open {test_name} details").wait_for()
    page.get_by_role("button", name=f"Open {test_name} details").click()
    page.get_by_role("button", name="Restore", exact=True).click()
    page.get_by_role("button", name="Remove", exact=True).wait_for()
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Remove", exact=True).click()

    desktop.close()

    mobile = browser.new_context(viewport={"width": 390, "height": 844})
    mobile_page = mobile.new_page()
    mobile_refresh_calls = []
    stub_refresh(mobile_page, mobile_refresh_calls)
    mobile_page.goto(BASE_URL, wait_until="networkidle")
    mobile_page.get_by_role("heading", name="Add Scholarship tracking").wait_for()
    radar = mobile_page.locator(".mission-radar")
    ring = mobile_page.locator(".radar-ring-one")
    sweep = mobile_page.locator(".radar-sweep")
    radar_box = radar.bounding_box()
    assert radar_box is not None
    assert abs(radar_box["width"] - radar_box["height"]) <= 1
    assert radar_box["width"] >= 110
    assert ring.evaluate("node => getComputedStyle(node).display") != "none"
    sweep_transform_before = sweep.evaluate("node => getComputedStyle(node).transform")
    mobile_page.wait_for_timeout(350)
    sweep_transform_after = sweep.evaluate("node => getComputedStyle(node).transform")
    assert sweep_transform_before != sweep_transform_after
    mobile_page.screenshot(path=OUT_DIR / "dashboard-v3-mobile.png", full_page=True)
    no_horizontal_overflow = mobile_page.evaluate(
        "document.documentElement.scrollWidth <= window.innerWidth + 1"
    )
    assert no_horizontal_overflow
    assert mobile_page.get_by_role("button", name="Track scholarship").is_visible()
    mobile.close()
    browser.close()

    assert not console_errors, console_errors
    print(
        json.dumps(
            {
                **discovery,
                "areaFilterRows": filtered_count,
                "totalRows": total_before,
                "duplicateCheck": "passed",
                "persistenceReload": "passed",
                "archiveRestore": "passed",
                "mobileOverflow": not no_horizontal_overflow,
                "mobileRadar": "circular, visible and animating",
                "viewerPrivacy": "private fields and records absent",
                "consoleErrors": console_errors,
            },
            indent=2,
        )
    )
