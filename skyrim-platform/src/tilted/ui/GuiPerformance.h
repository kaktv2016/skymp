#pragma once
#include <algorithm>
#include <array>
#include <chrono>
#include <cstdlib>
#include <mutex>
#include <vector>
#include <spdlog/spdlog.h>

// Opt-in CPU diagnostics only. No GPU timing or end-to-end latency claims.
namespace GuiPerformance {
using Clock = std::chrono::steady_clock;
enum Metric { FrameInterval, RenderCpu, PaintCpu, UploadCpu, TextureWait,
              CommandCpu, Count };
inline bool Enabled() {
  static const bool enabled = [] { const auto p = std::getenv("FROSTVEIL_GUI_PROFILE");
    return p && std::string(p) == "1"; }();
  return enabled;
}
struct Samples {
  std::array<double, 4096> values{};
  size_t count = 0;
  double total = 0;
  size_t stalls = 0;
};
inline void Record(Metric metric, double ms, bool flush = false) {
  static std::mutex mutex;
  static std::array<Samples, Count> samples;
  static auto last = Clock::now();
  std::lock_guard<std::mutex> lock(mutex);
  auto& sample = samples[metric];
  sample.values[sample.count++ % sample.values.size()] = ms;
  sample.total += ms;
  if (ms > 100) ++sample.stalls;
  const auto now = Clock::now();
  if (!flush || now - last < std::chrono::seconds(5)) return;
  const double seconds = std::chrono::duration<double>(now - last).count();
  const char* names[] = {"frame_interval", "render_cpu", "paint_cpu", "upload_cpu", "texture_wait", "command_cpu"};
  for (size_t i = 0; i < Count; ++i) {
    auto& s = samples[i];
    if (!s.count) continue;
    const size_t size = (std::min)(s.count, s.values.size());
    std::vector<double> sorted(s.values.begin(), s.values.begin() + size);
    std::sort(sorted.begin(), sorted.end());
    spdlog::info("[FV-GUI-PROFILE] metric={} count={} hz={} avg_ms={} p95_ms={} p99_ms={} over100ms={}",
      names[i], s.count, s.count / seconds, s.total / s.count,
      sorted[(size - 1) * 95 / 100], sorted[(size - 1) * 99 / 100], s.stalls);
    s = Samples{};
  }
  last = now;
}
struct Timer {
  Metric metric;
  bool enabled;
  Clock::time_point start;
  explicit Timer(Metric m) : metric(m), enabled(Enabled()) {
    if (enabled) start = Clock::now();
  }
  ~Timer() {
    if (enabled) Record(metric, std::chrono::duration<double, std::milli>(Clock::now() - start).count(), metric == RenderCpu);
  }
};
inline void Frame() {
  if (!Enabled()) return;
  static auto last = Clock::now(); // render thread only
  const auto now = Clock::now();
  Record(FrameInterval, std::chrono::duration<double, std::milli>(now - last).count());
  last = now;
}
} // namespace GuiPerformance
