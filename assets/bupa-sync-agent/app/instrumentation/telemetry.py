"""OpenTelemetry instrumentation for the BUPA Sync Agent."""

import os
from typing import Optional

from opentelemetry import metrics, trace
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
)
from opentelemetry.sdk.metrics.export import (
    ConsoleMetricExporter,
    PeriodicExportingMetricReader,
)

SERVICE_NAME = "bupa-sync-agent"
SERVICE_VERSION = "1.0.0"

# Module-level references for instrumentation
_tracer: Optional[trace.Tracer] = None
_meter: Optional[metrics.Meter] = None
_token_counter = None
_approval_rate_gauge = None
_initialized = False


def setup_telemetry() -> None:
    """Initialize OpenTelemetry tracing and metrics.

    Sets up:
    - Tracer provider with console exporter (or OTLP if configured)
    - Meter provider with token usage counter and approval rate gauge
    - Resource attributes for service identification
    """
    global _tracer, _meter, _token_counter, _approval_rate_gauge, _initialized

    if _initialized:
        return

    resource = Resource.create(
        {
            "service.name": SERVICE_NAME,
            "service.version": SERVICE_VERSION,
            "deployment.environment": os.environ.get("DEPLOYMENT_ENV", "development"),
        }
    )

    # --- Tracing ---
    tracer_provider = TracerProvider(resource=resource)

    # Use OTLP exporter if endpoint is configured, otherwise console
    otlp_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if otlp_endpoint:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
                OTLPSpanExporter,
            )

            span_exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
        except ImportError:
            span_exporter = ConsoleSpanExporter()
    else:
        span_exporter = ConsoleSpanExporter()

    tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
    trace.set_tracer_provider(tracer_provider)
    _tracer = trace.get_tracer(SERVICE_NAME, SERVICE_VERSION)

    # --- Metrics ---
    metric_reader = PeriodicExportingMetricReader(
        ConsoleMetricExporter(),
        export_interval_millis=60000,
    )
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)
    _meter = metrics.get_meter(SERVICE_NAME, SERVICE_VERSION)

    # Token usage counter
    _token_counter = _meter.create_counter(
        name="llm.token.usage",
        description="Number of LLM tokens consumed",
        unit="tokens",
    )

    # Approval rate gauge (callback-based)
    _approval_rate_gauge = _meter.create_up_down_counter(
        name="agent.approval.rate",
        description="Tracks approved vs rejected fix proposals",
        unit="proposals",
    )

    _initialized = True


def get_tracer() -> trace.Tracer:
    """Get the configured tracer instance.

    Returns:
        OpenTelemetry Tracer.
    """
    global _tracer
    if _tracer is None:
        setup_telemetry()
    return _tracer


def get_meter() -> metrics.Meter:
    """Get the configured meter instance.

    Returns:
        OpenTelemetry Meter.
    """
    global _meter
    if _meter is None:
        setup_telemetry()
    return _meter


def create_milestone_span(milestone: str, attributes: Optional[dict] = None):
    """Create a span for an agent milestone (M3, M4, etc.).

    Used to track key processing milestones:
    - M3: Error classification complete
    - M4: Fix proposal generated

    Args:
        milestone: Milestone identifier (e.g. "M3", "M4")
        attributes: Optional additional span attributes.

    Returns:
        A context manager span.
    """
    tracer = get_tracer()
    span_attributes = {"milestone": milestone}
    if attributes:
        span_attributes.update(attributes)
    return tracer.start_as_current_span(
        name=f"agent.milestone.{milestone}",
        attributes=span_attributes,
    )


def record_token_usage(
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    model: str = "unknown",
) -> None:
    """Record LLM token usage metrics.

    Args:
        prompt_tokens: Number of prompt/input tokens.
        completion_tokens: Number of completion/output tokens.
        model: The model identifier.
    """
    global _token_counter
    if _token_counter is None:
        setup_telemetry()

    _token_counter.add(
        prompt_tokens,
        attributes={"token.type": "prompt", "model": model},
    )
    _token_counter.add(
        completion_tokens,
        attributes={"token.type": "completion", "model": model},
    )


def record_approval(approved: bool) -> None:
    """Record a fix proposal approval/rejection.

    Args:
        approved: True if the proposal was approved, False if rejected.
    """
    global _approval_rate_gauge
    if _approval_rate_gauge is None:
        setup_telemetry()

    _approval_rate_gauge.add(
        1 if approved else -1,
        attributes={"decision": "approved" if approved else "rejected"},
    )
