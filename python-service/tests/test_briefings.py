import uuid

from fastapi.testclient import TestClient

VALID_PAYLOAD = {
    "companyName": "Acme Holdings",
    "ticker": "acme",
    "sector": "Industrial Technology",
    "analystName": "Jane Doe",
    "summary": (
        "Acme is benefiting from strong enterprise demand and improving operating leverage, "
        "though customer concentration remains a near-term risk."
    ),
    "recommendation": "Monitor for margin expansion and customer diversification before increasing exposure.",
    "keyPoints": [
        "Revenue grew 18% year-over-year in the latest quarter.",
        "Management raised full-year guidance.",
        "Enterprise subscriptions now account for 62% of recurring revenue.",
    ],
    "risks": [
        "Top two customers account for 41% of total revenue.",
        "International expansion may pressure margins over the next two quarters.",
    ],
    "metrics": [
        {"name": "Revenue Growth", "value": "18%"},
        {"name": "Operating Margin", "value": "22.4%"},
        {"name": "P/E Ratio", "value": "28.1x"},
    ],
}


def test_create_briefing_success(client: TestClient) -> None:
    response = client.post("/briefings", json=VALID_PAYLOAD)

    assert response.status_code == 201
    data = response.json()
    assert data["companyName"] == "Acme Holdings"
    assert data["sector"] == "Industrial Technology"
    assert data["analystName"] == "Jane Doe"
    assert data["isGenerated"] is False
    assert data["generatedAt"] is None
    assert len(data["keyPoints"]) == 3
    assert len(data["risks"]) == 2
    assert len(data["metrics"]) == 3
    assert "id" in data
    # id must be a valid UUID string
    uuid.UUID(data["id"])


def test_create_briefing_normalizes_ticker(client: TestClient) -> None:
    response = client.post("/briefings", json=VALID_PAYLOAD)

    assert response.status_code == 201
    assert response.json()["ticker"] == "ACME"


def test_create_briefing_validation_too_few_key_points(client: TestClient) -> None:
    payload = {**VALID_PAYLOAD, "keyPoints": ["Only one point."]}
    response = client.post("/briefings", json=payload)

    assert response.status_code == 422


def test_create_briefing_validation_no_risks(client: TestClient) -> None:
    payload = {**VALID_PAYLOAD, "risks": []}
    response = client.post("/briefings", json=payload)

    assert response.status_code == 422


def test_create_briefing_validation_duplicate_metric_names(client: TestClient) -> None:
    payload = {
        **VALID_PAYLOAD,
        "metrics": [
            {"name": "Revenue Growth", "value": "18%"},
            {"name": "Revenue Growth", "value": "25%"},
        ],
    }
    response = client.post("/briefings", json=payload)

    assert response.status_code == 422


def test_get_briefing_success(client: TestClient) -> None:
    create_response = client.post("/briefings", json=VALID_PAYLOAD)
    assert create_response.status_code == 201
    briefing_id = create_response.json()["id"]

    response = client.get(f"/briefings/{briefing_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == briefing_id
    assert data["companyName"] == "Acme Holdings"
    assert data["ticker"] == "ACME"
    assert len(data["keyPoints"]) == 3
    assert len(data["risks"]) == 2
    assert len(data["metrics"]) == 3


def test_get_briefing_not_found(client: TestClient) -> None:
    response = client.get(f"/briefings/{uuid.uuid4()}")

    assert response.status_code == 404


def test_generate_briefing_success(client: TestClient) -> None:
    create_response = client.post("/briefings", json=VALID_PAYLOAD)
    briefing_id = create_response.json()["id"]

    response = client.post(f"/briefings/{briefing_id}/generate")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == briefing_id
    assert data["generated"] is True
    assert data["generatedAt"] is not None


def test_generate_marks_briefing_as_generated(client: TestClient) -> None:
    create_response = client.post("/briefings", json=VALID_PAYLOAD)
    briefing_id = create_response.json()["id"]
    client.post(f"/briefings/{briefing_id}/generate")

    response = client.get(f"/briefings/{briefing_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["isGenerated"] is True
    assert data["generatedAt"] is not None


def test_generate_briefing_not_found(client: TestClient) -> None:
    response = client.post(f"/briefings/{uuid.uuid4()}/generate")

    assert response.status_code == 404


def test_get_html_success(client: TestClient) -> None:
    create_response = client.post("/briefings", json=VALID_PAYLOAD)
    briefing_id = create_response.json()["id"]
    client.post(f"/briefings/{briefing_id}/generate")

    response = client.get(f"/briefings/{briefing_id}/html")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    body = response.text
    assert "Acme Holdings" in body
    assert "ACME" in body
    assert "Jane Doe" in body
    assert "Revenue grew 18%" in body
    assert "Top two customers" in body
    assert "Revenue Growth" in body or "Revenue Growth".title() in body


def test_get_html_not_generated(client: TestClient) -> None:
    create_response = client.post("/briefings", json=VALID_PAYLOAD)
    briefing_id = create_response.json()["id"]

    response = client.get(f"/briefings/{briefing_id}/html")

    assert response.status_code == 404


def test_list_briefings_empty(client: TestClient) -> None:
    response = client.get("/briefings")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_list_briefings_returns_all(client: TestClient) -> None:
    client.post("/briefings", json=VALID_PAYLOAD)
    client.post("/briefings", json={**VALID_PAYLOAD, "ticker": "XYZ"})

    response = client.get("/briefings")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    for item in data["items"]:
        uuid.UUID(item["id"])
