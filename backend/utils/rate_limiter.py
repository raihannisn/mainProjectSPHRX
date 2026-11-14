from collections import OrderedDict, deque
from threading import Lock
from time import monotonic
from typing import Optional


class InMemoryRateLimiter:
    def __init__(self, limit: int, window_seconds: int, max_clients: int = 5000):
        self.limit = limit
        self.window_seconds = window_seconds
        self.max_clients = max_clients
        self._requests = OrderedDict()
        self._lock = Lock()

    def allow(self, client_key: str, now: Optional[float] = None) -> bool:
        current_time = monotonic() if now is None else now
        cutoff = current_time - self.window_seconds

        with self._lock:
            timestamps = self._requests.get(client_key)
            if timestamps is None:
                timestamps = deque()
                self._requests[client_key] = timestamps
            else:
                while timestamps and timestamps[0] <= cutoff:
                    timestamps.popleft()
                self._requests.move_to_end(client_key)

            if len(timestamps) >= self.limit:
                return False

            timestamps.append(current_time)
            while len(self._requests) > self.max_clients:
                self._requests.popitem(last=False)
            return True
