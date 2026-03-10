from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from jinja2 import Environment, FileSystemLoader, select_autoescape

if TYPE_CHECKING:
    from app.models.briefing import Briefing

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"


class ReportFormatter:
    """Formatter utility for server-side HTML report generation."""

    def __init__(self) -> None:
        self._env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(
                enabled_extensions=("html", "xml"), default_for_string=True
            ),
        )

    def render_base(self, title: str, body: str) -> str:
        """Render a minimal page that extends base.html.

        Useful for simple dev/health pages. The body string is treated as
        plain text — it will be HTML-escaped automatically.
        """
        src = (
            '{% extends "base.html" %}'
            "{% block title %}{{ _title }}{% endblock %}"
            "{% block content %}"
            '<main style="max-width: 800px; margin: 2rem auto; padding: 0 1rem;">'
            "<h1>{{ _title }}</h1>"
            '<div style="margin-top: 1rem;">{{ _body }}</div>'
            '<footer style="margin-top: 2rem; font-size: 0.875rem; color: #6b7280;">'
            "Generated at: {{ _generated_at }}"
            "</footer>"
            "</main>"
            "{% endblock %}"
        )
        return self._env.from_string(src).render(
            _title=title,
            _body=body,
            _generated_at=self.generated_timestamp(),
        )

    def build_report_view_model(self, briefing: Briefing) -> dict:
        """Transform a Briefing ORM record into a template-ready view model."""
        sorted_points = sorted(briefing.points, key=lambda p: p.display_order)
        key_points = [p.content for p in sorted_points if p.type == "key_point"]
        risks = [p.content for p in sorted_points if p.type == "risk"]
        metrics = [{"name": m.name.title(), "value": m.value} for m in briefing.metrics]

        generated_display = (
            briefing.generated_at.strftime("%B %d, %Y at %H:%M UTC")
            if briefing.generated_at
            else self.generated_timestamp()
        )

        return {
            "report_title": f"{briefing.company_name} ({briefing.ticker}) — Briefing Report",
            "company": {
                "name": briefing.company_name,
                "ticker": briefing.ticker,
                "sector": briefing.sector,
                "analyst": briefing.analyst_name,
            },
            "summary": briefing.summary,
            "recommendation": briefing.recommendation,
            "key_points": key_points,
            "risks": risks,
            "metrics": metrics,
            "has_metrics": bool(metrics),
            "generated_at": generated_display,
        }

    def render_report(self, briefing: Briefing) -> str:
        """Render the full HTML report for a briefing."""
        view_model = self.build_report_view_model(briefing)
        template = self._env.get_template("report.html")
        return template.render(**view_model)

    @staticmethod
    def generated_timestamp() -> str:
        return datetime.now(timezone.utc).isoformat()
