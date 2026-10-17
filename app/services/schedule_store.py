"""Thread-safe in-memory storage repository for Candidate Schedules (T11)."""

import threading

from app.schemas.scheduling import ScheduleResponse


class ScheduleStore:
    """Thread-safe registry for generated candidate schedule proposals."""

    def __init__(self) -> None:
        self._schedules: dict[str, ScheduleResponse] = {}
        self._lock = threading.Lock()

    def save(self, schedule: ScheduleResponse) -> ScheduleResponse:
        """Store a newly generated schedule proposal."""
        with self._lock:
            self._schedules[schedule.id] = schedule
            return schedule

    def get(self, schedule_id: str) -> ScheduleResponse | None:
        """Retrieve a schedule proposal by its unique identifier."""
        with self._lock:
            return self._schedules.get(schedule_id)

    def list_by_chc(self, chc_id: int) -> list[ScheduleResponse]:
        """List all schedule proposals associated with a specific CHC."""
        with self._lock:
            return [s for s in self._schedules.values() if s.chc_id == chc_id]

    def update(self, schedule: ScheduleResponse) -> ScheduleResponse:
        """Update an existing schedule proposal."""
        with self._lock:
            self._schedules[schedule.id] = schedule
            return schedule

    def clear(self) -> None:
        """Clear all stored schedules (primarily for test fixture cleanup)."""
        with self._lock:
            self._schedules.clear()


# Global singleton instance
schedule_store = ScheduleStore()
