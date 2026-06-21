"""The native Python tracer driver: sys.settrace hook -> one frame per line.

Only the user's compiled code (identified by filename) is traced; library
internals are skipped so the stream stays about the user's algorithm.
"""


class MaxStepsExceeded(RuntimeError):
    pass


class Tracer:
    def __init__(self, user_filename, serializer, stream, max_steps=10_000):
        self.user_filename = user_filename
        self.serializer = serializer
        self.stream = stream
        self.max_steps = max_steps

    def trace(self, frame, event, arg):
        if frame.f_code.co_filename != self.user_filename:
            return self.trace
        if event not in ("line", "call", "return", "exception"):
            return self.trace
        if self.stream.step >= self.max_steps:
            raise MaxStepsExceeded(f"max_steps={self.max_steps} exceeded")

        scope, heap = self.serializer.serialize_scope(frame.f_locals)
        return_value = None
        exception = None
        if event == "return" and arg is not None:
            return_value = self.serializer.value(arg, heap, 0)
        elif event == "exception" and arg is not None:
            exc_type, exc_val, _ = arg
            exception = {"type": getattr(exc_type, "__name__", str(exc_type)),
                         "message": str(exc_val)}

        self.stream.push(
            scope=scope,
            heap=heap,
            line=frame.f_lineno,
            func=frame.f_code.co_name,
            event=event,
            depth=self._depth(frame),
            return_value=return_value,
            exception=exception,
        )
        return self.trace

    @staticmethod
    def _depth(frame):
        depth = 0
        f = frame
        while f is not None:
            depth += 1
            f = f.f_back
        return depth
